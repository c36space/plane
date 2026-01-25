# Keycloak OIDC Implementation - Test & Validation Guide

## Pre-Implementation Checklist

- [ ] Keycloak server is running and accessible
- [ ] Realm is created in Keycloak
- [ ] OIDC client is created with correct settings
- [ ] Client credentials (ID & Secret) are obtained
- [ ] Redirect URIs are configured in Keycloak client
- [ ] Email scope is enabled in client scopes
- [ ] Test user account exists with valid email

## Code Changes Verification

Run these commands to verify all changes were applied correctly:

### 1. Backend Adapter Changes

```bash
# Verify requests import is added
grep "import requests" apps/api/plane/authentication/adapter/keycloak.py
# Expected: import requests

# Verify token_data is properly set
grep -A 5 "self.token_data = {" apps/api/plane/authentication/adapter/keycloak.py
# Expected: Should see dictionary assignment with tokens

# Verify user_data is properly set
grep -A 5 "self.user_data = {" apps/api/plane/authentication/adapter/keycloak.py
# Expected: Should see dictionary assignment with user info
```

### 2. Backend View Changes

```bash
# Verify app view marks request as non-space
grep "request.is_space = False" apps/api/plane/authentication/views/app/keycloak.py
# Expected: 2 occurrences (initiate and callback)

# Verify space view marks request as space
grep "request.is_space = True" apps/api/plane/authentication/views/space/keycloak.py
# Expected: 2 occurrences (initiate and callback)
```

### 3. Frontend Extended OAuth Config

```bash
# Verify web app has Keycloak in extended config
grep "is_keycloak_enabled" apps/web/core/hooks/oauth/extended.tsx
# Expected: 2 occurrences (check and enabled prop)

# Verify space app has Keycloak in extended config
grep "is_keycloak_enabled" apps/space/core/hooks/oauth/extended.tsx
# Expected: 2 occurrences (check and enabled prop)

# Verify both use correct API endpoints
grep "auth/keycloak" apps/web/core/hooks/oauth/extended.tsx
grep "auth/keycloak/space" apps/space/core/hooks/oauth/extended.tsx
```

## Manual Testing Procedure

### Phase 1: Configuration Verification

```bash
# 1. Check environment variables are loaded
curl http://localhost:8000/api/instances/ | jq '.is_keycloak_enabled'
# Expected output: true

# 2. Verify Keycloak configuration endpoint is accessible
curl https://your-keycloak-domain/auth/realms/your-realm/.well-known/openid-configuration
# Expected: JSON response with endpoints

# 3. Check that database is updated
sqlite3 db.sqlite3 "SELECT key, value FROM instance_configuration WHERE key LIKE 'IS_KEYCLOAK%';" 2>/dev/null || echo "Check via API instead"
```

### Phase 2: UI/Button Verification

#### On Web App (app.example.com)

1. **Navigate to Login Page**

   ```
   Go to: https://app.example.com/auth/signin
   ```

2. **Verify Button Appearance**
   - [ ] "Sign in with Keycloak" button appears
   - [ ] Button is clickable
   - [ ] Other OAuth buttons appear based on their configuration
   - [ ] Button styling matches other OAuth buttons

3. **Test Button Click**
   - [ ] Clicking button redirects to Keycloak login page
   - [ ] URL contains correct client_id
   - [ ] URL contains correct redirect_uri
   - [ ] State parameter is present in URL
   - [ ] Scope includes openid, profile, email

#### On Space App (space.example.com)

1. **Navigate to Login Page**

   ```
   Go to: https://space.example.com/auth/signin
   ```

2. **Verify Button Appearance**
   - [ ] "Sign in with Keycloak" button appears
   - [ ] Button behavior is same as web app

### Phase 3: OAuth Flow Testing

#### 3.1: Authorization Code Exchange

1. **Capture Authorization Code**
   - [ ] Enter valid Keycloak credentials on Keycloak login page
   - [ ] After successful login, verify redirect back to app
   - [ ] Check URL includes `code` parameter
   - [ ] Check URL includes `state` parameter

2. **Server-side Code Exchange**
   - [ ] Check backend logs for successful token request
   - [ ] Verify access_token is received in response
   - [ ] Verify refresh_token is received (if configured)
   - [ ] Verify id_token is received
   - [ ] Verify expires_in is numeric

#### 3.2: User Information Retrieval

1. **User Info Endpoint Call**
   - [ ] Check backend logs for userinfo request
   - [ ] Verify authorization header with access_token sent
   - [ ] Verify response includes email
   - [ ] Verify response includes name components
   - [ ] Verify response includes sub (subject identifier)

2. **Fallback ID Token Parsing** (test by disabling userinfo endpoint)
   - [ ] If userinfo fails, should fall back to id_token decode
   - [ ] Should extract email from id_token
   - [ ] Should extract name from id_token claims

#### 3.3: Account Creation/Login

1. **First Login (New User)**
   - [ ] User account created in Plane database
   - [ ] Email is correctly stored
   - [ ] First name is extracted (if available)
   - [ ] Last name is extracted (if available)
   - [ ] Display name is set
   - [ ] Password marked as auto-set (is_password_autoset=true)
   - [ ] Provider account linked (provider_id = sub)

2. **Subsequent Login (Existing User)**
   - [ ] User is found and logged in
   - [ ] Account information is updated
   - [ ] Same session behavior as password login

#### 3.4: Redirect After Auth

1. **Without next_path Parameter**
   - [ ] After login, redirected to default dashboard
   - [ ] URL is correct for app/space context

2. **With next_path Parameter**

   ```
   Go to: https://app.example.com/auth/signin?next_path=/settings
   Click Keycloak button → Authenticate → Should redirect to /settings
   ```

   - [ ] After login, redirected to specified next_path
   - [ ] next_path is properly validated (security check)

### Phase 4: Error Handling

#### 4.1: Configuration Errors

1. **Missing Keycloak Configuration**

   ```bash
   # Temporarily remove KEYCLOAK_CLIENT_SECRET
   IS_KEYCLOAK_ENABLED=1
   KEYCLOAK_CLIENT_ID=plane-client
   # Don't set KEYCLOAK_CLIENT_SECRET
   ```

   - [ ] Button doesn't appear or shows error
   - [ ] Error message is informative

2. **Invalid Base URL**

   ```bash
   KEYCLOAK_BASE_URL=https://invalid-domain.com/auth
   ```

   - [ ] Returns error when trying to get auth URL
   - [ ] Error is caught and displayed properly

#### 4.2: Keycloak Errors

1. **Invalid Credentials**
   - [ ] Enter wrong password in Keycloak
   - [ ] Keycloak shows error, doesn't redirect
   - [ ] Plane shows error message

2. **Redirected Without Code**
   - [ ] Keycloak denies scope request
   - [ ] Keycloak redirects with error parameter
   - [ ] Plane shows appropriate error

3. **State Parameter Mismatch**
   - [ ] Manually alter state parameter in URL
   - [ ] Plane rejects the callback with CSRF error

#### 4.3: Data Extraction Errors

1. **Missing Email**
   - [ ] Create Keycloak user without email
   - [ ] Attempt login
   - [ ] Should show "Email not provided" error

2. **Missing Name**
   - [ ] Create user with only email (no name fields)
   - [ ] User should still create with email-derived display_name

### Phase 5: Multi-Provider Testing

1. **Enable Multiple Providers**

   ```bash
   IS_KEYCLOAK_ENABLED=1
   IS_GOOGLE_ENABLED=1
   IS_GITHUB_ENABLED=1
   ```

2. **Verify All Buttons Appear**
   - [ ] Keycloak button visible
   - [ ] Google button visible
   - [ ] GitHub button visible

3. **Test Each Provider Works**
   - [ ] Keycloak login works
   - [ ] Google login works
   - [ ] GitHub login works

4. **Same User, Different Providers**
   ```
   - User A logs in with Keycloak
   - Create same email user in Google
   - Try logging in with Google
   - Should either create new account or merge (based on config)
   ```

### Phase 6: Browser Testing

#### Desktop Browsers

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if applicable)
- [ ] Edge

#### Mobile Testing

- [ ] iOS Safari
- [ ] Android Chrome
- [ ] In-app browser (if applicable)

#### Test Scenarios for Each

1. **Fresh Login**
   - [ ] No cookies, no session
   - [ ] Complete OAuth flow

2. **Session Refresh**
   - [ ] Browser reopened (cookies still valid)
   - [ ] Should auto-login or show dashboard

3. **Private/Incognito Mode**
   - [ ] Complete OAuth flow
   - [ ] No persistent cookies

### Phase 7: Security Testing

1. **CSRF Protection**

   ```bash
   # Try to replay an old authorization code
   - [ ] Should fail (one-time use)

   # Try to use state from different session
   - [ ] Should fail (state mismatch)
   ```

2. **Token Security**
   - [ ] Access tokens not exposed in URLs
   - [ ] Tokens only sent in Authorization header
   - [ ] Tokens stored securely in database
   - [ ] Tokens not logged in plain text

3. **Redirect URL Validation**
   - [ ] Try arbitrary next_path: `?next_path=https://evil.com`
   - [ ] Should either fail or redirect to safe location

### Phase 8: Database Verification

```bash
# Check user was created
sqlite3 plane_db.sqlite3 << EOF
SELECT id, email, first_name, last_name, display_name FROM users WHERE email = 'test@example.com';
EOF

# Check account linking
sqlite3 plane_db.sqlite3 << EOF
SELECT user_id, provider, provider_account_id FROM account WHERE provider = 'keycloak';
EOF

# Check token storage (if applicable)
sqlite3 plane_db.sqlite3 << EOF
SELECT * FROM oauth_token WHERE provider = 'keycloak' LIMIT 1;
EOF
```

### Phase 9: Performance Testing

1. **Login Time Measurement**
   - [ ] Time from button click to dashboard load
   - [ ] Should be <5 seconds (typical)
   - [ ] Network requests show no obvious delays

2. **Load Testing** (if applicable)
   - [ ] Multiple simultaneous logins
   - [ ] No race conditions
   - [ ] No database connection issues

3. **Token Refresh** (if implemented)
   - [ ] Long session duration
   - [ ] Tokens refresh silently
   - [ ] No re-authentication needed for valid tokens

## Logs to Check

### Backend Logs

```bash
# Django logs
tail -f logs/django.log | grep -i keycloak

# Look for:
# - Authorization code request
# - Token exchange request
# - User info request
# - User creation/update
# - Successful authentication
# - Any errors or exceptions
```

### Frontend Logs

```javascript
// Browser console (F12)
// Look for:
// - OAuth button click events
// - Redirect to Keycloak
// - Redirect back from Keycloak
// - API calls for configuration
// - Any console errors
```

### Keycloak Logs

```bash
# Keycloak container logs (if Docker)
docker logs keycloak | grep -i "plane\|plane-client"

# Look for:
// - Client authentication success/failure
// - Authorization grant
// - Token issuance
// - Any access denied messages
```

## Regression Testing

After Keycloak implementation, test that other auth methods still work:

- [ ] Email/password login still works
- [ ] Magic link login still works
- [ ] Other OAuth providers still work
- [ ] Workspace creation still works
- [ ] Invitations still work
- [ ] Profile updates still work
- [ ] Logout functionality works
- [ ] Session management works

## Sign-off Checklist

- [ ] All code changes verified
- [ ] UI buttons appear correctly
- [ ] OAuth flow completes successfully
- [ ] User data is correctly extracted
- [ ] Accounts are created/linked properly
- [ ] Redirects work as expected
- [ ] Error handling is appropriate
- [ ] Multi-provider support verified
- [ ] Security best practices followed
- [ ] No regressions in other features
- [ ] Performance is acceptable
- [ ] All browser/device combinations work
- [ ] Documentation is complete
- [ ] Team is trained on new feature

## Post-Implementation Tasks

- [ ] Update user documentation
- [ ] Update admin documentation
- [ ] Add Keycloak integration to troubleshooting guide
- [ ] Create support KB article
- [ ] Add monitoring/alerting for Keycloak integration
- [ ] Schedule security review
- [ ] Plan for Keycloak version upgrades
- [ ] Document backup/restore procedures
