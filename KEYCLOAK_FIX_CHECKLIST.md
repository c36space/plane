# Keycloak Configuration Fix - CRITICAL

## Root Cause of error_code=5126 (KEYCLOAK_OAUTH_PROVIDER_ERROR)

**Error**: `{"error":"unauthorized_client","error_description":"Client not enabled to retrieve service account"}`

**Why**: Your Keycloak client `plane-sso` does not have **Client Authentication enabled**. The API cannot exchange the authorization code for tokens.

---

## REQUIRED FIX - Go to Keycloak Admin Console NOW

### URL: http://localhost:8080/admin

### Step 1: Navigate to Client Settings

1. **Clients** (left menu)
2. Select **plane-sso**
3. Click **Credentials** tab (or **Authentication** tab, depending on Keycloak version)

### Step 2: Enable Client Authentication

Look for these settings:

**For Keycloak 23.x+:**

- Go to **Authentication** tab
- Find toggle: **"Client authentication"** → **Turn it ON** ✅
- **Token Endpoint Auth Method** → Select **client_secret_basic**
- **Save**

**For Keycloak 20-22:**

- Go to **Credentials** tab
- Ensure **Confidential** access type is selected
- Copy the **Client Secret** (should be: `aRgwjttU6gBtd3RxYw7jqTAg0484BmWC`)
- **Save**

### Step 3: Verify Other Settings

Go back to **Settings** tab:

```
Client ID:                    plane-sso ✅
Client Protocol:              openid-connect ✅
Valid Redirect URIs:
  - http://localhost:8000/auth/keycloak/callback/ ✅
  - http://localhost:8000/auth/keycloak/callback/space/ ✅
```

### Step 4: Check Standard Flow

Go to **Capability config**:

```
✅ Standard flow enabled:      ON
❌ Implicit flow enabled:       OFF
❌ Direct access grants:        OFF
❌ Service accounts enabled:    OFF
```

### Step 5: Verify User Has Email

**Users** (left menu) → Select your test user → **Email field must be populated**

---

## API Container Configuration

The `.env` file has been updated:

```
KEYCLOAK_BASE_URL=http://localhost:8080
```

This is the **Docker gateway IP** so containers can reach Keycloak on the host.

---

## After Fixing Keycloak Settings

```bash
# Restart API container to reload config
cd /home/kalki/plane
docker-compose restart api
```

## Test the Flow

1. Go to http://localhost:3000
2. Click "Login with Keycloak"
3. Should redirect to Keycloak login page ✅
4. Enter credentials
5. Should redirect back to app WITH session ✅ (not error_code=5126)

---

## If Still Getting Error

Check backend logs:

```bash
docker logs api 2>&1 | grep -i "keycloak\|error\|5126" | tail -30
```

Should see `[KEYCLOAK ERROR]` messages with the actual Keycloak response.
