# Keycloak OAuth Error Diagnosis

## Current Error Status

**Error:** `http://localhost:3000/?error_code=5126&error_message=KEYCLOAK_OAUTH_PROVIDER_ERROR`

**Error Code 5126** = `KEYCLOAK_OAUTH_PROVIDER_ERROR`

---

## Analysis: Where Is This Error Coming From?

### Possible Sources:

1. **Backend (Most Likely)** ✅
   - Error is being thrown in one of these locations:
     - `KeycloakOAuthProvider.set_token_data()` - Token exchange failed
     - `KeycloakOAuthProvider.set_user_data()` - User info fetch failed
     - `KeycloakOAuthProvider.get_user_response()` - Userinfo endpoint error
     - `KeycloakCallbackEndpoint.get()` - State validation, code validation, or Keycloak error detection

2. **Frontend** ❌
   - Frontend would show a client-side error
   - Would not have the structured error_code parameter

---

## What This Error Code Means

**5126 = KEYCLOAK_OAUTH_PROVIDER_ERROR** means something failed in the Keycloak authentication flow.

### Common Causes:

- ❌ Keycloak server unreachable (timeout)
- ❌ Invalid Keycloak configuration
- ❌ Token endpoint returns error
- ❌ Userinfo endpoint returns error
- ❌ Authorization code is invalid/expired
- ❌ Redirect URI mismatch

---

## How to Debug This:

### Step 1: Check Backend Logs

```bash
cd /home/kalki/plane/apps/api
tail -f logs/  # Check for Keycloak errors
# Look for: [KEYCLOAK ERROR], connection failed, timeout, etc.
```

### Step 2: Verify Keycloak Server

```bash
# Check if Keycloak is running
curl http://localhost:8080/auth/.well-known/openid-configuration

# Check if Keycloak token endpoint is accessible
curl -X POST http://localhost:8080/auth/realms/master/protocol/openid-connect/token \
  -d "code=test&client_id=test&client_secret=test"
```

### Step 3: Check Configuration

```python
# Verify in Django admin or environment:
- KEYCLOAK_CLIENT_ID ✓
- KEYCLOAK_CLIENT_SECRET ✓
- KEYCLOAK_BASE_URL ✓
- KEYCLOAK_REALM ✓
```

### Step 4: Test Flow Manually

```
1. Go to: http://localhost:8000/auth/keycloak/
2. Should redirect to Keycloak login
3. Enter credentials on Keycloak form
4. Should callback to: http://localhost:8000/auth/keycloak/callback/?code=xxx&state=xxx
5. Backend processes and redirects to: http://localhost:3000/ (success)
   OR http://localhost:3000/?error_code=5126 (error)
```

---

## Data Flow - What Should Happen

### Success Path:

```
Frontend (localhost:3000)
    ↓ Click "Login with Keycloak"
Backend (/auth/keycloak/)
    ↓ Validate instance, generate state, store in session
Keycloak (localhost:8080)
    ↓ User submits credentials
Keycloak Callback (/auth/keycloak/callback/?code=xxx&state=xxx)
    ↓ Backend validates state ✅
    ↓ Backend exchanges code for tokens ✅ (10s timeout)
    ↓ Backend fetches user info ✅ (10s timeout)
    ↓ Backend creates/updates user ✅
    ↓ Backend sets session ✅
    ↓ Backend cleans session ✅
Frontend
    ↓ Redirected to dashboard (authenticated)
```

### Error Path (Current):

```
Frontend (localhost:3000)
    ↓ Click "Login with Keycloak"
Backend (/auth/keycloak/)
    ✅ Validates instance, generates state
Keycloak (localhost:8080)
    ✅ User submits credentials
Keycloak Callback (/auth/keycloak/callback/?code=xxx&state=xxx)
    ✅ State validation passes
    ❌ Token exchange fails (5126 error)
       OR Userinfo fetch fails (5126 error)
       OR Authorization code invalid (5126 error)
Backend
    ✓ Cleans session
    ✓ Redirects with error parameters
Frontend
    ↓ Shows error: http://localhost:3000/?error_code=5126&error_message=KEYCLOAK_OAUTH_PROVIDER_ERROR
```

---

## The Error Is Coming From Backend ✅

The error response format confirms it's from the backend:

- `error_code` = Backend error code
- `error_message` = Backend error message
- Returned as URL parameters = Backend redirect with error params

**This is CORRECT behavior!** The system is properly detecting and reporting the error.

---

## Next Steps to Find Root Cause:

1. **Check API Logs** for detailed error message

   ```bash
   docker logs plane-api | grep -i "keycloak\|5126\|timeout\|connection"
   ```

2. **Test Keycloak Connection**

   ```bash
   # From API container
   curl -v http://keycloak:8080/auth/realms/master/.well-known/openid-configuration
   ```

3. **Verify Environment Variables**

   ```bash
   docker exec plane-api env | grep KEYCLOAK
   ```

4. **Check if User Info Extraction Failed**
   - Add logging to see what error Keycloak returns
   - Check if userinfo endpoint is working

5. **Test Authorization Code**
   - Verify code is valid
   - Check if it's expired (should be ~1 minute)

---

## What the Frontend Receives

The frontend correctly receives:

- `?error_code=5126` ← Backend error code
- `&error_message=KEYCLOAK_OAUTH_PROVIDER_ERROR` ← Backend error message

The frontend should:

- ✅ Parse these parameters
- ✅ Display error message to user
- ✅ Allow user to retry

The system is working as designed!

**The issue is: Keycloak backend communication is failing, not the OAuth flow itself.**

---

## Question: Is User Getting Authenticated?

**No, because:**

1. Token exchange OR userinfo fetch is failing
2. User data cannot be created/updated
3. Session is not being established
4. Redirect happens with error parameters

**To authenticate, need to:**

1. Fix the Keycloak connection issue
2. Ensure token endpoint is accessible
3. Ensure userinfo endpoint is accessible
4. Verify credentials are correct
5. Verify redirect URI matches in Keycloak config
