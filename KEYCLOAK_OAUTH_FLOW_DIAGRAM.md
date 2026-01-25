# Keycloak OAuth Complete Flow Diagram

## Sequence Diagram

```
┌─────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   Client    │             │  Plane Backend   │             │     Keycloak     │
│  (Browser)  │             │   (Django API)   │             │     Server       │
└─────────────┘             └──────────────────┘             └──────────────────┘
       │                              │                              │
       │ 1. Click "Login with         │                              │
       │    Keycloak" Button          │                              │
       ├─────────────────────────────►│                              │
       │ GET /auth/keycloak/          │                              │
       │                              │                              │
       │ 2. Validate Instance         │                              │
       │    Generate State Token      │                              │
       │    Set Session Expiry        │                              │
       │    (10 minutes)              │                              │
       │                              │                              │
       │ 3. Redirect to Keycloak      │                              │
       │◄─────────────────────────────┤                              │
       │ 302 Redirect                 │                              │
       │ Location: https://keycloak...│                              │
       │          ?client_id=...      │                              │
       │          &state=xxx...       │                              │
       │          &redirect_uri=...   │                              │
       │                              │                              │
       │ 4. Redirect to Keycloak      │                              │
       │─────────────────────────────────────────────────────────────┼──────►│
       │                              │                              │
       │ 5. User fills Keycloak form  │                              │
       │    (or denies access)        │                              │
       │                              │                              │
       │ 6. Keycloak redirects back   │                              │
       │◄─────────────────────────────────────────────────────────────┤
       │ 302 Redirect                 │                              │
       │ Location: /auth/keycloak/    │                              │
       │           callback/?code=... │                              │
       │           &state=...         │                              │
       │           OR                 │                              │
       │           ?error=...         │                              │
       │           &error_desc=...    │                              │
       │                              │                              │
       │ 7. Callback Request          │                              │
       ├─────────────────────────────►│                              │
       │ GET /auth/keycloak/callback/ │                              │
       │                              │                              │
       │ 8a. IF ERROR PARAMETER       │                              │
       │     ✓ Detect error           │                              │
       │     ✓ Cleanup session        │                              │
       │     ✓ Redirect with error    │                              │
       │                              │                              │
       │ 8b. IF SUCCESS               │                              │
       │     ✓ Validate state         │                              │
       │     ✓ Validate code exists   │                              │
       │                              │                              │
       │ 9. Exchange code for tokens  │                              │
       │                              ├─────────────────────────────►│
       │                              │ POST /token                  │
       │                              │ grant_type=authorization_code│
       │                              │ code=xxx                     │
       │                              │ client_id=xxx               │
       │                              │ client_secret=xxx           │
       │                              │                              │
       │                              │ 10. Return Tokens           │
       │                              │◄─────────────────────────────┤
       │                              │ {                            │
       │                              │   "access_token": "...",    │
       │                              │   "id_token": "...",        │
       │                              │   "refresh_token": "...",   │
       │                              │   "expires_in": 3600        │
       │                              │ }                            │
       │                              │                              │
       │ 11. Fetch User Info          │                              │
       │                              ├─────────────────────────────►│
       │                              │ GET /userinfo               │
       │                              │ Authorization: Bearer token │
       │                              │                              │
       │                              │ 12. Return User Info        │
       │                              │◄─────────────────────────────┤
       │                              │ {                            │
       │                              │   "sub": "user-id",         │
       │                              │   "email": "user@...",      │
       │                              │   "name": "User Name",      │
       │                              │   "given_name": "User",     │
       │                              │   "family_name": "Name",    │
       │                              │   "picture": "https://...",│
       │                              │   "preferred_username": ..  │
       │                              │ }                            │
       │                              │                              │
       │ 13. Create/Update User       │                              │
       │     Create/Update Account    │                              │
       │     Set Session Cookie       │                              │
       │     Cleanup Session Data     │                              │
       │                              │                              │
       │ 14. Redirect to Dashboard    │                              │
       │◄─────────────────────────────┤                              │
       │ 302 Redirect                 │                              │
       │ Location: /dashboard         │                              │
       │ Set-Cookie: session=...      │                              │
       │                              │                              │
       │ 15. Access Dashboard         │                              │
       ├─────────────────────────────►│                              │
       │ GET /dashboard               │                              │
       │ Cookie: session=...          │                              │
       │                              │                              │
       │ 16. Dashboard Page           │                              │
       │◄─────────────────────────────┤                              │
       │ 200 OK                       │                              │
       │ (Authenticated Content)      │                              │
       │                              │                              │

```

---

## Error Flow Diagram

```
┌─────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   Client    │             │  Plane Backend   │             │     Keycloak     │
│  (Browser)  │             │   (Django API)   │             │     Server       │
└─────────────┘             └──────────────────┘             └──────────────────┘
       │                              │                              │
       │ [User denies access]         │                              │
       │                              │                              │
       │ Keycloak redirects with error│                              │
       │◄─────────────────────────────────────────────────────────────┤
       │ GET /auth/keycloak/callback/ │                              │
       │       ?error=access_denied   │                              │
       │       &error_desc=...        │                              │
       │                              │                              │
       │ 1. Keycloak Callback ✓       │                              │
       ├─────────────────────────────►│                              │
       │ 2. Detect error parameter ✓  │                              │
       │    Create exception          │                              │
       │ 3. Cleanup session ✓         │                              │
       │    Remove all OAuth data     │                              │
       │ 4. Build error redirect URL  │                              │
       │    ?error_code=...           │                              │
       │    &error_message=...        │                              │
       │                              │                              │
       │ Redirect to error page       │                              │
       │◄─────────────────────────────┤                              │
       │ 302 Redirect                 │                              │
       │ Location: /?error=...        │                              │
       │                              │                              │
       │ Error Page Rendered ✓        │                              │
       │ (User can retry)             │                              │
       │                              │                              │
```

---

## State Validation Timeline

```
T=0: User clicks "Login with Keycloak"
     └─► State token generated: abc123xyz
     └─► Session created with 10-min expiry
     └─► State stored: request.session["keycloak_state"] = "abc123xyz"
     └─► Timestamp stored: request.session["keycloak_state_created_at"] = "2024-01-25 12:00:00 UTC"

T=1-600 seconds: User on Keycloak form
     └─► Session still valid

T=601 seconds: Session expired
     └─► If callback received after this: STATE REJECTED ✓
     └─► Error: "Invalid or expired state parameter"
     └─► Reason: stored_state becomes empty on session expiry

T=120 (within 600): Successful callback
     └─► Received state: abc123xyz
     └─► Stored state: abc123xyz
     └─► Match verified ✓
     └─► Proceed with authentication
```

---

## Data Model - Account Creation

```
NEW USER (Sign Up):

GET /auth/keycloak/callback/?code=xxx&state=yyy
    ↓
User.objects.filter(email="user@example.com").first()
    └─► Result: None (user doesn't exist)
    └─► is_signup = not bool(None) = True ✓
    ↓
Create User:
    - email: user@example.com
    - username: uuid.uuid4().hex
    - is_password_autoset: True
    - is_email_verified: True
    - first_name: "John"
    - last_name: "Doe"
    ↓
Create Profile:
    - user_id: <new_user_id>
    ↓
Create Account:
    - user_id: <new_user_id>
    - provider: "keycloak"
    - provider_account_id: "keycloak-sub-value"
    - access_token: "eyJhbGc..."
    - refresh_token: "eyJhbGc..."
    - id_token: "eyJhbGc..."
    - access_token_expired_at: now + 3600 seconds
    - refresh_token_expired_at: now + 86400 seconds
    - last_connected_at: now
    ↓
Send activation email
    ↓
Login user
    ↓
Redirect to /dashboard


EXISTING USER (Login):

GET /auth/keycloak/callback/?code=xxx&state=yyy
    ↓
User.objects.filter(email="user@example.com").first()
    └─► Result: <User instance>
    └─► is_signup = not bool(<User>) = False ✓
    ↓
If sync enabled:
    - Update first_name, last_name from Keycloak
    - Download and update avatar
    ↓
Update Account:
    - access_token: new_token
    - refresh_token: new_token (if provided)
    - id_token: new_id_token
    - access_token_expired_at: new_expiry
    - refresh_token_expired_at: new_expiry
    - last_connected_at: now
    ↓
Update User:
    - last_login_medium: "keycloak"
    - last_login_time: now
    - last_login_ip: client_ip
    - last_login_uagent: user_agent
    ↓
Login user
    ↓
Redirect to /dashboard
```

---

## Session Lifecycle

```
PHASE 1: OAuth Session Creation
┌─────────────────────────────────────────┐
│ GET /auth/keycloak/                     │
├─────────────────────────────────────────┤
│ Session Created                         │
│ - keycloak_state: "abc123xyz"          │
│ - keycloak_state_created_at: timestamp │
│ - next_path: "/workspace/slug"         │
│ - host: "https://app.example.com"      │
│ - Session expiry: 600 seconds (10 min) │
└─────────────────────────────────────────┘
          │ Redirect to Keycloak
          ↓

PHASE 2: User on Keycloak (Can take 1-5 minutes)
┌─────────────────────────────────────────┐
│ User fills form on Keycloak             │
│ Session remains active (still within    │
│ 10-min window)                          │
└─────────────────────────────────────────┘
          │ Redirect back to callback
          ↓

PHASE 3: OAuth Callback Processing
┌─────────────────────────────────────────┐
│ GET /auth/keycloak/callback/            │
├─────────────────────────────────────────┤
│ 1. Extract: code, state, error          │
│ 2. Validate state matches session       │
│ 3. Exchange code for tokens (10s timeout)
│ 4. Fetch user info (10s timeout)        │
│ 5. Create/update user                   │
│ 6. Login user → New session created ✓   │
│ 7. Clean up OAuth session keys ✓        │
│ 8. Redirect to /dashboard               │
└─────────────────────────────────────────┘

PHASE 4: Regular Authenticated Session
┌─────────────────────────────────────────┐
│ GET /dashboard                          │
├─────────────────────────────────────────┤
│ Session Contains:                       │
│ - user_id: authenticated_user           │
│ - host: base_host                       │
│ (OAuth fields removed ✓)                │
│ - Session expiry: 24 hours (standard)   │
└─────────────────────────────────────────┘
```

---

## Response Headers - Success

```
HTTP/1.1 302 Found
Location: https://app.example.com/dashboard
Set-Cookie: sessionid=abc123...; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=86400
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

---

## Response Headers - Error

```
HTTP/1.1 302 Found
Location: https://app.example.com/?error_code=KEYCLOAK_OAUTH_PROVIDER_ERROR&error_message=Invalid%20state%20parameter
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

---

## Client Error Handling

```javascript
// Client receives redirect with error parameters
// Example: /?error_code=KEYCLOAK_OAUTH_PROVIDER_ERROR&error_message=...

if (searchParams.has("error_code")) {
  const errorCode = searchParams.get("error_code");
  const errorMessage = searchParams.get("error_message");

  // Display error to user
  // Log for debugging
  // Optionally hide form and show "Try again" button
}
```
