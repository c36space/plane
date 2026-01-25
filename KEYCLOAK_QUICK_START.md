# Keycloak OIDC Quick Start Guide

## Prerequisites

1. **Keycloak Server**: Running Keycloak instance (e.g., https://keycloak.example.com)
2. **Realm**: Created and configured in Keycloak
3. **OIDC Client**: Created in your Keycloak realm

## Keycloak Configuration Steps

### Step 1: Create an OIDC Client

1. Login to Keycloak Admin Console
2. Navigate to your realm → Clients
3. Click "Create client"
4. Choose "OpenID Connect" as client type
5. Set Client ID: `plane-client` (or your preference)
6. Click Next

### Step 2: Configure Client Settings

On the "General Settings" page:

- **Client type**: OpenID Connect (already selected)
- **Client ID**: `plane-client`
- Access Type: Confidential
- Click "Next"

On "Capability config":

- Enable: Client authentication ✓
- Enable: Authorization (optional)
- Authentication flow:
  - Standard flow ✓
  - Implicit flow (optional)
  - Hybrid flow (optional)

### Step 3: Configure Redirect URIs

Add redirect URIs for both app and space:

```
https://app.example.com/auth/keycloak/callback/
https://space.example.com/auth/keycloak/callback/space/
```

For development (if using different domains):

```
http://localhost:3000/auth/keycloak/callback/
http://localhost:3001/auth/keycloak/callback/space/
```

### Step 4: Get Client Credentials

1. Go to Credentials tab
2. Copy the **Client ID** → `KEYCLOAK_CLIENT_ID`
3. Copy the **Client Secret** → `KEYCLOAK_CLIENT_SECRET`

### Step 5: Configure Scopes

Go to "Client Scopes" tab and ensure these are enabled:

- openid ✓
- profile ✓
- email ✓

## Plane Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Enable Keycloak authentication
IS_KEYCLOAK_ENABLED=1

# Keycloak OIDC Configuration
KEYCLOAK_BASE_URL=https://keycloak.example.com/auth
KEYCLOAK_REALM=master
KEYCLOAK_CLIENT_ID=plane-client
KEYCLOAK_CLIENT_SECRET=your-client-secret-here

# Optionally, instead of KEYCLOAK_BASE_URL + KEYCLOAK_REALM, use KEYCLOAK_ISSUER:
# KEYCLOAK_ISSUER=https://keycloak.example.com/auth/realms/master

# Disable other OAuth providers (optional)
IS_GOOGLE_ENABLED=0
IS_GITHUB_ENABLED=0
IS_GITLAB_ENABLED=0
IS_GITEA_ENABLED=0

# Enable/disable password and magic link login (optional)
ENABLE_EMAIL_PASSWORD=1
ENABLE_MAGIC_LINK_LOGIN=1
```

### Restart Services

```bash
# Backend API
docker restart plane-api
# or
cd apps/api && python manage.py runserver

# Frontend
docker restart plane-web
docker restart plane-space
# or
cd apps/web && pnpm dev
cd apps/space && pnpm dev
```

## Testing the Integration

### Test Login Flow

1. **On Web App**: Navigate to `https://app.example.com/auth/signin`
2. **On Space App**: Navigate to `https://space.example.com/auth/signin`
3. **Verify Button**: "Sign in with Keycloak" button should appear
4. **Click Button**: Should redirect to Keycloak login
5. **Login**: Enter Keycloak credentials
6. **Redirect**: Should return to Plane with user logged in

### Verify User Data

After login, check that:

- Email is correctly synced ✓
- First name and last name are extracted ✓
- Display name is set ✓
- User is created/linked to account ✓

### Test with Multiple Providers

Set multiple providers enabled:

```bash
IS_KEYCLOAK_ENABLED=1
IS_GOOGLE_ENABLED=1
IS_GITHUB_ENABLED=1
```

Verify:

- All enabled buttons appear ✓
- Disabled buttons don't appear ✓
- Each provider works independently ✓

## Keycloak User Attributes (Optional)

You can add custom attributes to Keycloak users for additional data:

1. Go to Users → Select user → Attributes
2. Add custom attributes:
   - `department`: User's department
   - `organization`: User's organization
   - `role`: User's role

These can be included in tokens by:

1. Creating protocol mappers in the client
2. Mapping user attributes to token claims

## API Configuration Verification

Check if Keycloak is properly configured via API:

```bash
curl http://localhost:8000/api/instances/
```

Response should include:

```json
{
  "is_keycloak_enabled": true,
  "keycloak_base_url": "https://keycloak.example.com/auth",
  "keycloak_realm": "master"
}
```

## Troubleshooting

### 1. "Client not configured" Error

**Cause**: Missing KEYCLOAK_CLIENT_ID or KEYCLOAK_CLIENT_SECRET

**Solution**: Verify environment variables are set correctly

```bash
echo $KEYCLOAK_CLIENT_ID
echo $KEYCLOAK_CLIENT_SECRET
```

### 2. "Invalid redirect URI" Error

**Cause**: Redirect URI in request doesn't match configured in Keycloak

**Solution**: Ensure configured redirect URIs in Keycloak exactly match:

- Scheme (http/https) must match
- Domain must match
- Path must match exactly (with trailing slash)

### 3. Button Not Appearing

**Cause**: IS_KEYCLOAK_ENABLED not set or set to 0

**Solution**:

```bash
IS_KEYCLOAK_ENABLED=1
# Restart services
```

### 4. "Email not provided" Error

**Cause**: User doesn't have email in Keycloak or email scope not included

**Solution**:

1. Ensure user has email set in Keycloak
2. Verify `email` scope is included in client
3. Check user has email_verified flag (optional)

### 5. Login Redirects to Keycloak But Returns Error

**Cause**: Invalid client credentials or KEYCLOAK_BASE_URL

**Solution**:

1. Verify KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET
2. Test Keycloak connection:
   ```bash
   curl https://keycloak.example.com/auth/realms/master/.well-known/openid-configuration
   ```
3. Check Keycloak server logs for errors

## Performance Considerations

1. **Token Caching**: Access tokens are cached in the database
2. **User Info Caching**: User info is fetched once during login
3. **Fallback**: If userinfo endpoint fails, ID token claims are used
4. **Token Refresh**: Refresh tokens can be used for silent refresh

## Security Considerations

1. **HTTPS Only**: Always use HTTPS for production
2. **Client Secret**: Keep KEYCLOAK_CLIENT_SECRET secure
3. **State Parameter**: Automatically validated for CSRF protection
4. **Email Verification**: Consider enabling in Keycloak
5. **Token Validation**: ID tokens are not validated for signature (adjust as needed for production)

## Next Steps

- [ ] Configure Keycloak realm with desired attributes
- [ ] Set up email notifications in Keycloak
- [ ] Configure user federation if needed
- [ ] Set up Keycloak backup and restore
- [ ] Configure HTTPS for Keycloak
- [ ] Set up Keycloak monitoring/alerting
- [ ] Test disaster recovery procedures
