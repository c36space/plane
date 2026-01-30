# Python imports
import os
import jwt
import requests
from datetime import datetime, timedelta
from urllib.parse import urlencode
import pytz

# Module imports
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)


class KeycloakOAuthProvider(OauthAdapter):
    """Keycloak OIDC/OAuth2 adapter"""
    provider = "keycloak"
    
    def __init__(self, request, code=None, state=None, callback=None):
        # Get configuration values
        config_values = get_configuration_value([
            {
                "key": "KEYCLOAK_CLIENT_ID",
                "default": os.environ.get("KEYCLOAK_CLIENT_ID"),
            },
            {
                "key": "KEYCLOAK_CLIENT_SECRET",
                "default": os.environ.get("KEYCLOAK_CLIENT_SECRET"),
            },
            {
                "key": "KEYCLOAK_ISSUER",
                "default": os.environ.get("KEYCLOAK_ISSUER", ""),
            },
            {
                "key": "KEYCLOAK_REALM",
                "default": os.environ.get("KEYCLOAK_REALM", "master"),
            },
            {
                "key": "KEYCLOAK_BASE_URL",
                "default": os.environ.get("KEYCLOAK_BASE_URL", ""),
            },
            {
                "key": "KEYCLOAK_REDIRECT_PROTOCOL",
                "default": os.environ.get("KEYCLOAK_REDIRECT_PROTOCOL", "https"),
            },
        ])

        (
            KEYCLOAK_CLIENT_ID,
            KEYCLOAK_CLIENT_SECRET,
            KEYCLOAK_ISSUER,
            KEYCLOAK_REALM,
            KEYCLOAK_BASE_URL,
            KEYCLOAK_REDIRECT_PROTOCOL,
        ) = config_values

        if not all([KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET]):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["KEYCLOAK_OAUTH_PROVIDER_ERROR"],
                error_message="KEYCLOAK_NOT_CONFIGURED",
            )

        # Construct URLs for different purposes
        # Auth endpoint uses KEYCLOAK_ISSUER for browser access (localhost)
        if KEYCLOAK_ISSUER:
            auth_url = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/auth"
        elif KEYCLOAK_BASE_URL:
            auth_url = f"{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth"
        else:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["KEYCLOAK_OAUTH_PROVIDER_ERROR"],
                error_message="KEYCLOAK_BASE_URL_OR_ISSUER_REQUIRED",
            )
        
        # Token and userinfo endpoints use KEYCLOAK_BASE_URL for backend access (docker gateway IP)
        if KEYCLOAK_BASE_URL:
            token_url = f"{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
            userinfo_url = f"{KEYCLOAK_BASE_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo"
        elif KEYCLOAK_ISSUER:
            # Fallback to ISSUER if BASE_URL not set
            token_url = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/token"
            userinfo_url = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo"
        else:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["KEYCLOAK_OAUTH_PROVIDER_ERROR"],
                error_message="KEYCLOAK_BASE_URL_OR_ISSUER_REQUIRED",
            )

        # OIDC scopes
        scope = "openid profile email"

        # Build redirect URI based on request context
        # Use environment variable for protocol (defaults to HTTPS for production)
        protocol = KEYCLOAK_REDIRECT_PROTOCOL
        
        if hasattr(request, 'is_space') and request.is_space:
            redirect_uri = f"{protocol}://{request.get_host()}/auth/keycloak/callback/space/"
        else:
            redirect_uri = f"{protocol}://{request.get_host()}/auth/keycloak/callback/"

        # Build auth URL with parameters
        url_params = {
            "client_id": KEYCLOAK_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "state": state,
            "prompt": "login",  # Force login to get fresh credentials
        }
        
        full_auth_url = f"{auth_url}?{urlencode(url_params)}"

        super().__init__(
            request=request,
            provider=self.provider,
            client_id=KEYCLOAK_CLIENT_ID,
            scope=scope,
            redirect_uri=redirect_uri,
            auth_url=full_auth_url,
            token_url=token_url,
            userinfo_url=userinfo_url,
            client_secret=KEYCLOAK_CLIENT_SECRET,
            code=code,
            callback=callback,
        )

    @staticmethod
    def _get_request_is_secure(request):
        """
        Detect if the request is secure (HTTPS), considering reverse proxies.
        
        In production, Django is typically behind a reverse proxy (Nginx, Caddy, etc.)
        that terminates SSL. The proxy forwards the request via HTTP internally.
        
        This method checks:
        1. X-Forwarded-Proto header (set by reverse proxies)
        2. X-Forwarded-SSL header (alternative header)
        3. Cloudfront-Forwarded-Proto header (AWS CloudFront)
        4. request.is_secure() as fallback
        """
        # Check X-Forwarded-Proto header (most common for reverse proxies)
        forwarded_proto = request.headers.get('X-Forwarded-Proto', '').lower()
        if forwarded_proto in ('https', 'http'):
            return forwarded_proto == 'https'
        
        # Check X-Forwarded-SSL header (alternative)
        forwarded_ssl = request.headers.get('X-Forwarded-SSL', '').lower()
        if forwarded_ssl == 'on':
            return True
        
        # Check Cloudfront-Forwarded-Proto header (AWS CloudFront)
        cloudfront_proto = request.headers.get('CloudFront-Forwarded-Proto', '').lower()
        if cloudfront_proto in ('https', 'http'):
            return cloudfront_proto == 'https'
        
        # Fallback to Django's is_secure() method
        return request.is_secure()

    def set_token_data(self):
        """Exchange authorization code for tokens"""
        data = {
            "code": self.code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # Debug: Log token exchange details
        print(f"[KEYCLOAK DEBUG] Token exchange URL: {self.get_token_url()}")
        print(f"[KEYCLOAK DEBUG] Client ID: {self.client_id}")
        print(f"[KEYCLOAK DEBUG] Redirect URI: {self.redirect_uri}")
        
        token_response = self.get_user_token(data=data, headers=headers)
        
        # Parse ID token to get expiration
        id_token = token_response.get("id_token", "")
        expires_in = token_response.get("expires_in", 3600)
        refresh_expires_in = token_response.get("refresh_expires_in", 0)
        
        # Calculate token expiration times
        access_token_expired_at = datetime.now(pytz.utc) + timedelta(seconds=int(expires_in))
        
        if refresh_expires_in and int(refresh_expires_in) > 0:
            refresh_token_expired_at = datetime.now(pytz.utc) + timedelta(seconds=int(refresh_expires_in))
        else:
            refresh_token_expired_at = None

        # Set token data on the instance
        self.token_data = {
            "access_token": token_response.get("access_token"),
            "refresh_token": token_response.get("refresh_token"),
            "access_token_expired_at": access_token_expired_at,
            "refresh_token_expired_at": refresh_token_expired_at,
            "id_token": id_token,
        }

    def set_user_data(self):
        """Get user information from Keycloak"""
        user_info_response = self.get_user_response()
        
        # Extract email - check multiple possible fields
        email = (
            user_info_response.get("email") or
            user_info_response.get("preferred_username") or
            user_info_response.get("sub")  # Use subject as fallback
        )
        
        if not email:
            # Try to decode email from ID token
            if self.token_data and self.token_data.get("id_token"):
                try:
                    decoded = jwt.decode(
                        self.token_data["id_token"], 
                        options={"verify_signature": False}
                    )
                    email = decoded.get("email") or decoded.get("preferred_username")
                except Exception:
                    pass
        
        if not email:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["EMAIL_REQUIRED"],
                error_message="EMAIL_NOT_PROVIDED_BY_KEYCLOAK",
            )
        
        # Extract name safely
        full_name = user_info_response.get("name", "")
        name_parts = full_name.split() if full_name else []
        
        first_name = user_info_response.get("given_name") or (name_parts[0] if name_parts else "")
        last_name = user_info_response.get("family_name") or (" ".join(name_parts[1:]) if len(name_parts) > 1 else "")
        
        # Map Keycloak fields to Plane's expected format
        user_data = {
            "email": email,
            "user": {
                "avatar": user_info_response.get("picture", ""),
                "first_name": first_name,
                "last_name": last_name,
                "display_name": (
                    user_info_response.get("preferred_username") or 
                    user_info_response.get("name") or 
                    email.split("@")[0]
                ),
                "provider_id": user_info_response.get("sub", ""),  # Subject identifier
                "is_password_autoset": True,  # Since we're using OIDC
            },
        }
        
        # Set user data on the instance
        self.user_data = user_data
    
    def get_avatar_download_headers(self):
        """Keycloak might provide avatar via picture claim"""
        return {
            "Authorization": f"Bearer {self.token_data.get('access_token')}" if self.token_data else ""
        }
    
    def get_user_response(self):
        """Override to handle Keycloak-specific userinfo"""
        try:
            headers = {"Authorization": f"Bearer {self.token_data.get('access_token')}"}
            response = requests.get(self.get_user_info_url(), headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            # If userinfo endpoint fails, try to extract from ID token
            if self.token_data and self.token_data.get("id_token"):
                try:
                    decoded = jwt.decode(
                        self.token_data["id_token"],
                        options={"verify_signature": False}
                    )
                    return {
                        "sub": decoded.get("sub"),
                        "email": decoded.get("email"),
                        "preferred_username": decoded.get("preferred_username"),
                        "given_name": decoded.get("given_name"),
                        "family_name": decoded.get("family_name"),
                        "name": decoded.get("name"),
                        "picture": decoded.get("picture"),
                    }
                except Exception:
                    pass
            
            # Raise the original exception
            code = self.authentication_error_code()
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES[code], 
                error_message=str(code)
            )

    def authentication_error_code(self):
        return "KEYCLOAK_OAUTH_PROVIDER_ERROR"