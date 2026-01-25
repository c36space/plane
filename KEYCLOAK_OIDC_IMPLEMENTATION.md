# Keycloak OIDC Authentication Implementation Summary

## Overview

This document summarizes the fixes applied to properly implement Keycloak OIDC authentication across the Plane application (web, admin, and space apps).

## Issues Fixed

### 1. Backend (API) - `/apps/api/plane/authentication/adapter/keycloak.py`

**Problems:**

- Missing `requests` module import (causing runtime errors)
- `set_token_data()` incorrectly calling parent's non-existent method
- `set_user_data()` incorrectly calling parent's non-existent method
- Unsafe name extraction from full_name string

**Fixes Applied:**

- Added `import requests` at the top
- Changed `super().set_token_data()` to direct assignment: `self.token_data = {...}`
- Changed `super().set_user_data()` to direct assignment: `self.user_data = {...}`
- Refactored name extraction to safely handle missing name components:
  ```python
  full_name = user_info_response.get("name", "")
  name_parts = full_name.split() if full_name else []
  first_name = user_info_response.get("given_name") or (name_parts[0] if name_parts else "")
  last_name = user_info_response.get("family_name") or (" ".join(name_parts[1:]) if len(name_parts) > 1 else "")
  ```
- Fixed timedelta integer conversion: `timedelta(seconds=int(expires_in))`

### 2. Backend Views - Keycloak Callback/Initiate Endpoints

**Problems:**

- Request object not marked as space/app context for proper redirect URI construction

**Fixes Applied:**

- Added `request.is_space = True` in `/apps/api/plane/authentication/views/space/keycloak.py` endpoints
- Added `request.is_space = False` in `/apps/api/plane/authentication/views/app/keycloak.py` endpoints
- This ensures proper redirect URI construction in the Keycloak provider:
  - Space: `/auth/keycloak/callback/space/`
  - App: `/auth/keycloak/callback/`

### 3. Frontend OAuth Configuration - Extended Config

#### `/apps/web/core/hooks/oauth/extended.tsx`

**Changes:**

- Implemented Keycloak provider in extended OAuth config
- Added proper configuration to show Keycloak button when enabled
- Button redirects to `/auth/keycloak/` endpoint with optional next_path

#### `/apps/space/core/hooks/oauth/extended.tsx`

**Changes:**

- Implemented Keycloak provider in space's extended OAuth config
- Button redirects to `/auth/keycloak/space/` endpoint for space auth flow

**Key Features:**

- Only shows Keycloak button if `config?.is_keycloak_enabled === true`
- Respects next_path query parameter for post-auth redirects
- Uses proper API_BASE_URL for endpoint construction

### 4. Frontend Button Display Logic

The auth button display is controlled by the `useOAuthConfig` hook which combines:

1. **Core providers** (`/core.tsx`): Google, GitHub, GitLab, Gitea
2. **Extended providers** (`/extended.tsx`): Keycloak

**Display Logic:**

- `isOAuthEnabled` = true if ANY provider is enabled
- `oAuthOptions` = array of all enabled providers
- The `OAuthOptions` component filters by `enabled` flag before rendering

This ensures:

- Only enabled providers show buttons
- Multiple providers can coexist (selective by env config)
- Each provider button only appears if configured

## Environment Variables Required

```env
# Enable Keycloak authentication
IS_KEYCLOAK_ENABLED=1

# Keycloak OIDC Configuration
KEYCLOAK_CLIENT_ID=plane-client
KEYCLOAK_CLIENT_SECRET=your-client-secret-from-keycloak
KEYCLOAK_BASE_URL=https://your-keycloak-domain/auth
KEYCLOAK_REALM=master

# Optional: Set issuer directly (alternative to KEYCLOAK_BASE_URL + KEYCLOAK_REALM)
KEYCLOAK_ISSUER=https://your-keycloak-domain/auth/realms/master
```

## Backend URL Routes

The following routes are automatically registered:

```
POST /auth/keycloak/                      # Initiate Keycloak OAuth for app
POST /auth/keycloak/callback/             # Keycloak OAuth callback for app
POST /auth/keycloak/space/                # Initiate Keycloak OAuth for space
POST /auth/keycloak/callback/space/       # Keycloak OAuth callback for space
```

## OIDC Flow Details

1. **Authorization Request**
   - User clicks "Sign in with Keycloak"
   - Redirects to Keycloak auth endpoint with:
     - client_id
     - redirect_uri (specific to app/space)
     - response_type=code
     - scope=openid profile email
     - state (for CSRF protection)

2. **Authorization Code Exchange**
   - Keycloak redirects back with `code` and `state`
   - Backend validates `state` parameter
   - Exchanges code for tokens at token endpoint:
     - access_token (for API calls)
     - refresh_token (for token renewal)
     - id_token (JWT with user info)
     - expires_in (token expiration in seconds)
     - refresh_expires_in (refresh token expiration)

3. **User Information Retrieval**
   - Fetches user info from Keycloak userinfo endpoint using access_token
   - Falls back to decoding id_token if userinfo fails
   - Extracts email, name, avatar, preferred_username

4. **Account Creation/Login**
   - Creates or updates user account in Plane
   - Links account with Keycloak provider_id (sub claim)
   - Automatically sets password (is_password_autoset=true)
   - Creates session and redirects to app

## Testing Checklist

- [ ] Set IS_KEYCLOAK_ENABLED=1 in .env
- [ ] Configure all KEYCLOAK\_\* variables
- [ ] Navigate to login page (/auth/signin or /auth/signup)
- [ ] Verify Keycloak button appears only when enabled
- [ ] Verify other auth buttons appear based on their config
- [ ] Click Keycloak button
- [ ] Verify redirect to Keycloak login page
- [ ] Complete Keycloak login
- [ ] Verify redirect back to Plane with user logged in
- [ ] Test with next_path parameter: /?next_path=/dashboard
- [ ] Verify proper redirect after auth
- [ ] Test on space app (/space-app/auth/signin)
- [ ] Test on admin/web app (/auth/signin)
- [ ] Test with invalid credentials (should show error)
- [ ] Test with missing email in Keycloak response (should fall back to id_token or preferred_username)
- [ ] Test token refresh functionality (if applicable)

## Files Modified

Backend:

- `/home/kalki/plane/apps/api/plane/authentication/adapter/keycloak.py`
- `/home/kalki/plane/apps/api/plane/authentication/views/app/keycloak.py`
- `/home/kalki/plane/apps/api/plane/authentication/views/space/keycloak.py`

Frontend:

- `/home/kalki/plane/apps/web/core/hooks/oauth/extended.tsx`
- `/home/kalki/plane/apps/space/core/hooks/oauth/extended.tsx`

Documentation:

- `/home/kalki/plane/apps/api/.env.example` (already had Keycloak config)

## Implementation Status

✅ **COMPLETED:**

- Backend OIDC flow implementation
- Token exchange and user data extraction
- Frontend button display logic for Keycloak
- Proper redirect URI handling for app and space
- State parameter validation for CSRF protection
- Error handling for missing email/configuration
- Token expiration tracking

⚠️ **OPTIONAL ENHANCEMENTS:**

- Token refresh flow (refresh_token usage)
- Keycloak user sync/provisioning
- Custom attribute mapping
- Logout integration with Keycloak

## Troubleshooting

### Button not appearing

- Check `IS_KEYCLOAK_ENABLED=1` in .env
- Restart backend server to reload config
- Check browser console for errors

### OAuth initiation fails

- Verify KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET are correct
- Check KEYCLOAK_BASE_URL format (should not have /auth at end if using BASE_URL)
- Verify Keycloak realm exists
- Check Keycloak client is configured with correct redirect URIs

### Callback fails

- Verify state parameter matches (CSRF check)
- Check authorization code is being sent
- Verify redirect_uri matches what's registered in Keycloak
- Check token endpoint is accessible
- Check userinfo endpoint is accessible

### User data missing

- Verify Keycloak realm has email scope configured
- Check user has email set in Keycloak
- Review logs for id_token decode errors

## Related Documentation

- Keycloak Admin Console: Configure OpenID Connect clients and scopes
- RFC 6749: OAuth 2.0 Authorization Framework
- OpenID Connect Core 1.0: OIDC protocol specification
