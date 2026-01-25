# Keycloak OAuth Error 5126 - Complete Debugging Guide

## Your Error: `error_code=5126&error_message=KEYCLOAK_OAUTH_PROVIDER_ERROR`

---

## ✅ Verification: This Error IS From Backend

**Confirmed:** The error is being returned by the backend API, NOT the frontend.

**Evidence:**

- Error is in URL query parameters: `?error_code=5126&error_message=KEYCLOAK_OAUTH_PROVIDER_ERROR`
- This matches the backend error response format
- Error code 5126 is defined in `plane/authentication/adapter/error.py`
- This is **correct behavior** - system properly detected and reported the error

---

## Understanding the Error Code

```python
# From: apps/api/plane/authentication/adapter/error.py
AUTHENTICATION_ERROR_CODES = {
    ...
    "KEYCLOAK_OAUTH_PROVIDER_ERROR": 5126,  # ← This is your error
    ...
}
```

**Meaning:** Something in the Keycloak provider authentication process failed.

---

## Where The Error Can Be Thrown

The error 5126 is thrown in these locations:

### 1. **KeycloakOAuthProvider.set_token_data()** - Token Exchange Failed

```python
# apps/api/plane/authentication/adapter/keycloak.py (Line ~130)
def set_token_data(self):
    """Exchange authorization code for tokens"""
    # ❌ If this fails → raises error 5126
    token_response = self.get_user_token(data=data, headers=headers)
```

**Why it might fail:**

- Keycloak server unreachable
- Network timeout (10 second timeout)
- Invalid authorization code
- Code expired
- Redirect URI mismatch
- Invalid client ID/secret

### 2. **KeycloakOAuthProvider.set_user_data()** - User Info Extraction Failed

```python
# apps/api/plane/authentication/adapter/keycloak.py (Line ~160)
def set_user_data(self):
    """Get user information from Keycloak"""
    # ❌ If this fails → raises error 5126
    user_info_response = self.get_user_response()

    # ❌ Or if email cannot be extracted
    if not email:
        raise AuthenticationException(
            error_code=AUTHENTICATION_ERROR_CODES["EMAIL_REQUIRED"],
            ...
        )
```

**Why it might fail:**

- Userinfo endpoint unreachable
- Timeout (10 second timeout)
- Invalid access token
- No email claim in userinfo response

### 3. **KeycloakCallbackEndpoint.get()** - Callback Processing Failed

```python
# apps/api/plane/authentication/views/app/keycloak.py (Line ~76)
class KeycloakCallbackEndpoint(View):
    def get(self, request):
        # ❌ Check for authorization errors
        error = request.GET.get("error")
        if error:
            # ❌ If user denied access or Keycloak had error
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["KEYCLOAK_OAUTH_PROVIDER_ERROR"],
                error_message=f"Keycloak error: {error}",
            )
```

**Why it might fail:**

- User denied access on Keycloak login
- Invalid state parameter
- Missing authorization code
- Keycloak server returned error

---

## How to Find the Root Cause

### Option 1: Check API Logs (Best)

```bash
# If using Docker
docker logs plane-api 2>&1 | grep -i "keycloak\|error\|5126\|timeout" | tail -50

# If running locally
tail -f /var/log/plane/api.log | grep -i keycloak

# Look for patterns like:
# [KEYCLOAK ERROR] Token exchange failed: Status: 500
# [KEYCLOAK ERROR] Userinfo fetch failed: Connection timeout
# Invalid state parameter
# Authorization code not provided
```

### Option 2: Enable Debug Logging

Add to your Django settings:

```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'plane.authentication': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

### Option 3: Test Keycloak Directly

```bash
# Test 1: Is Keycloak running?
curl http://localhost:8080/auth/.well-known/openid-configuration

# Test 2: Can you get the token endpoint?
curl -s http://localhost:8080/auth/realms/master/.well-known/openid-configuration | \
  grep token_endpoint

# Test 3: Try to exchange a code (will fail, but shows if endpoint works)
curl -X POST http://localhost:8080/auth/realms/master/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=invalid&client_id=plane&client_secret=secret&grant_type=authorization_code&redirect_uri=http://localhost:8000/auth/keycloak/callback/"

# Should return: {"error":"invalid_code",...}
# Not: Connection refused or timeout
```

### Option 4: Verify Configuration

```bash
# Check environment variables
grep -i keycloak /home/kalki/plane/apps/api/.env

# Should show:
# KEYCLOAK_CLIENT_ID=your-client-id
# KEYCLOAK_CLIENT_SECRET=your-secret
# KEYCLOAK_BASE_URL=http://localhost:8080/auth
# KEYCLOAK_REALM=master
```

---

## Checklist: Troubleshooting Steps

- [ ] **1. Keycloak Server Running**

  ```bash
  curl http://localhost:8080/auth/.well-known/openid-configuration
  # Should return JSON, not "Connection refused"
  ```

- [ ] **2. Client Configuration in Keycloak**
  - Go to: http://localhost:8080/auth/admin
  - Select Realm: `master` (or your realm)
  - Go to: Clients → `plane-web-client` (or your client name)
  - Check "Valid Redirect URIs" contains:
    - `http://localhost:8000/auth/keycloak/callback/`
    - `http://localhost:3000/` (if different host)

- [ ] **3. Backend Environment Variables**
  - `KEYCLOAK_CLIENT_ID` - Must match client in Keycloak
  - `KEYCLOAK_CLIENT_SECRET` - Must match secret in Keycloak
  - `KEYCLOAK_BASE_URL` - Must be reachable from backend
  - `KEYCLOAK_REALM` - Must match realm name in Keycloak

- [ ] **4. Network Connectivity**
  - Backend can reach Keycloak token endpoint
  - Backend can reach Keycloak userinfo endpoint
  - No firewall blocking port 8080 (or your Keycloak port)

- [ ] **5. Code is Correct**
  - Authorization code is valid (not expired)
  - Code matches one sent to backend
  - Code not used twice (codes are single-use)

- [ ] **6. State Validation Passed**
  - If error happens after state validation, means code exchange failed
  - Check logs for exact error from Keycloak

---

## Common Scenarios & Fixes

### Scenario 1: "Connection refused" to Keycloak

**Error:** `[KEYCLOAK ERROR] Token exchange failed: Status: (timeout)`

**Cause:** Keycloak server not running or not accessible

**Fix:**

```bash
# Start Keycloak
docker run -p 8080:8080 keycloak/keycloak

# Or check if running
curl http://localhost:8080/auth/
```

### Scenario 2: "Invalid code" from Keycloak

**Error:** `{"error":"invalid_code","error_description":"Code not valid"}`

**Cause:**

- Code already used (single use only)
- Code expired (usually 1 minute)
- Wrong redirect URI on code exchange

**Fix:**

```bash
# Try authenticating again (generates new code)
# Make sure redirect URI in token request matches
# Keycloak client "Valid Redirect URIs" setting
```

### Scenario 3: "Invalid client credentials" from Keycloak

**Error:** `{"error":"invalid_client","error_description":"Invalid client credentials"}`

**Cause:**

- `KEYCLOAK_CLIENT_ID` is wrong
- `KEYCLOAK_CLIENT_SECRET` is wrong
- Client doesn't exist in Keycloak

**Fix:**

```bash
# Verify in Keycloak admin console
# Clients → Select your client
# Get the correct Client ID and Secret
# Update .env:
KEYCLOAK_CLIENT_ID=correct-id
KEYCLOAK_CLIENT_SECRET=correct-secret
```

### Scenario 4: "Userinfo endpoint error"

**Error:** Status 401 or 403 from userinfo endpoint

**Cause:**

- Access token is invalid
- Access token expired
- Userinfo endpoint has different auth requirements

**Fix:**

- Check that token endpoint returns valid access_token
- Verify token contains needed scopes (openid, profile, email)

---

## Success Indicators

When working correctly, you should see:

1. **In Browser:**

   ```
   1. Click "Login with Keycloak"
   2. Redirected to http://localhost:8080/auth/realms/master/protocol/openid-connect/auth?...
   3. Enter credentials
   4. Click "Submit"
   5. Keycloak redirects to: http://localhost:8000/auth/keycloak/callback/?code=xxx&state=xxx
   6. Backend processes (takes 1-2 seconds)
   7. Redirected to: http://localhost:3000/ (or /dashboard)
   8. You are logged in! ✅
   ```

2. **In API Logs:**

   ```
   User authenticated: user@example.com (is_signup=True)
   Account created for provider: keycloak
   Session cleaned up
   Redirecting to: /dashboard
   ```

3. **In Database:**

   ```sql
   -- User created
   SELECT * FROM user WHERE email='user@example.com';

   -- Account created
   SELECT * FROM account WHERE user_id=<id> AND provider='keycloak';
   ```

---

## Error You're Getting

```
http://localhost:3000/?error_code=5126&error_message=KEYCLOAK_OAUTH_PROVIDER_ERROR
```

This means the backend is correctly:

- ✅ Catching the Keycloak error
- ✅ Creating an error response
- ✅ Redirecting to frontend with error parameters

But the root cause is in one of these:

- ❌ Token exchange failed (step 5 in flow above)
- ❌ Userinfo fetch failed
- ❌ Keycloak returned authorization error

---

## Next Action

**Run this diagnostic command:**

```bash
bash /home/kalki/plane/test_keycloak_oauth.sh
```

This will test:

1. ✅ Keycloak server reachable
2. ✅ OIDC configuration available
3. ✅ Token endpoint accessible
4. ✅ Backend configuration correct
5. ✅ Backend endpoints responding
6. ✅ Code syntax valid
7. ✅ Error codes defined

Then check API logs for the exact error message from Keycloak.

---

**Questions to Answer:**

1. What does the API log show when you get error 5126?
2. Is Keycloak server running and accessible?
3. Are the KEYCLOAK\_\* environment variables set correctly?
4. Does the Keycloak client redirect URI match your backend URL?
