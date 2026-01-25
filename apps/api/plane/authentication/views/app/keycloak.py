# Python imports
import uuid
from datetime import datetime, timedelta
import pytz

# Django import
from django.http import HttpResponseRedirect
from django.views import View
from django.utils.http import url_has_allowed_host_and_scheme

# Module imports
from plane.authentication.adapter.keycloak import KeycloakOAuthProvider
from plane.authentication.utils.login import user_login
from plane.authentication.utils.redirection_path import get_redirection_path
from plane.authentication.utils.user_auth_workflow import post_user_auth_workflow
from plane.license.models import Instance
from plane.authentication.utils.host import base_host
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)
from plane.utils.path_validator import get_safe_redirect_url, validate_next_path, get_allowed_hosts


class KeycloakOauthInitiateEndpoint(View):
    """Initiate Keycloak OAuth flow for app (app.c36space.com)"""
    
    def get(self, request):
        # Store the host for callback
        request.session["host"] = base_host(request=request, is_app=True)
        
        # Store next_path if provided and validate it
        next_path = request.GET.get("next_path")
        if next_path:
            request.session["next_path"] = validate_next_path(str(next_path))

        # Check instance configuration
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            params = exc.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)

        try:
            # Generate state parameter for CSRF protection
            state = uuid.uuid4().hex
            # Mark request as app (not space)
            request.is_space = False
            provider = KeycloakOAuthProvider(request=request, state=state)
            
            # Store state in session with timestamp for validation
            request.session["keycloak_state"] = state
            request.session["keycloak_state_created_at"] = str(datetime.now(pytz.utc))
            request.session.set_expiry(600)  # 10 minutes expiry
            
            # Get auth URL and redirect
            auth_url = provider.get_auth_url()
            return HttpResponseRedirect(auth_url)
            
        except AuthenticationException as e:
            params = e.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)


class KeycloakCallbackEndpoint(View):
    """Handle Keycloak OAuth callback for app (app.c36space.com)"""
    
    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state")
        error = request.GET.get("error")
        error_description = request.GET.get("error_description")
        next_path = request.session.get("next_path")

        # Check for authorization errors from Keycloak
        if error:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["KEYCLOAK_OAUTH_PROVIDER_ERROR"],
                error_message=f"Keycloak error: {error}",
            )
            if error_description:
                exc.error_message += f" - {error_description}"
            params = exc.get_error_dict()
            # Clean up session
            self._cleanup_session(request)
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)

        # Validate state parameter
        stored_state = request.session.get("keycloak_state", "")
        if not stored_state or state != stored_state:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["KEYCLOAK_OAUTH_PROVIDER_ERROR"],
                error_message="Invalid or expired state parameter",
            )
            params = exc.get_error_dict()
            # Clean up session
            self._cleanup_session(request)
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)
        
        # Check if authorization code is present
        if not code:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["KEYCLOAK_OAUTH_PROVIDER_ERROR"],
                error_message="Authorization code not provided",
            )
            params = exc.get_error_dict()
            # Clean up session
            self._cleanup_session(request)
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)
        
        try:
            # Create provider with callback for post-authentication workflow
            # Mark request as app (not space)
            request.is_space = False
            provider = KeycloakOAuthProvider(
                request=request, 
                code=code, 
                callback=post_user_auth_workflow
            )
            
            # Authenticate the user
            user = provider.authenticate()
            
            # Login the user and record device info
            user_login(request=request, user=user, is_app=True)
            
            # Get the redirection path
            if next_path:
                path = next_path
            else:
                path = get_redirection_path(user=user)
            
            # Clean up session
            self._cleanup_session(request)
            
            # Construct redirect URL
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=path, 
                params={}
            )
            return HttpResponseRedirect(url)
            
        except AuthenticationException as e:
            params = e.get_error_dict()
            # Clean up session
            self._cleanup_session(request)
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), 
                next_path=next_path, 
                params=params
            )
            return HttpResponseRedirect(url)
    
    def _cleanup_session(self, request):
        """Clean up Keycloak session data"""
        session_keys = ["keycloak_state", "keycloak_state_created_at", "next_path"]
        for key in session_keys:
            if key in request.session:
                del request.session[key]