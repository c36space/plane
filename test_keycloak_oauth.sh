#!/bin/bash
# Keycloak OAuth Provider - Diagnostic Test Script

echo "═══════════════════════════════════════════════════════════════════"
echo "KEYCLOAK OAUTH PROVIDER - DIAGNOSTIC TEST"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
KEYCLOAK_HOST="${KEYCLOAK_HOST:-localhost:8080}"
KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://$KEYCLOAK_HOST/auth}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-master}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-plane-web-client}"
KEYCLOAK_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-your-secret}"

API_HOST="${API_HOST:-localhost:8000}"
FRONTEND_HOST="${FRONTEND_HOST:-localhost:3000}"

echo "Configuration:"
echo "  Keycloak Base URL: $KEYCLOAK_BASE_URL"
echo "  Keycloak Realm: $KEYCLOAK_REALM"
echo "  Keycloak Client ID: $KEYCLOAK_CLIENT_ID"
echo "  API Host: $API_HOST"
echo "  Frontend Host: $FRONTEND_HOST"
echo ""

# Test 1: Keycloak Server Reachable
echo "────────────────────────────────────────────────────────────────────"
echo "TEST 1: Keycloak Server Reachable"
echo "────────────────────────────────────────────────────────────────────"
echo "Testing: curl -s $KEYCLOAK_BASE_URL/.well-known/openid-configuration"

if curl -s "$KEYCLOAK_BASE_URL/.well-known/openid-configuration" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: Keycloak server is reachable${NC}"
else
    echo -e "${RED}❌ FAIL: Cannot reach Keycloak server${NC}"
    echo "  Action: Ensure Keycloak is running at $KEYCLOAK_HOST"
fi
echo ""

# Test 2: Check OIDC Configuration
echo "────────────────────────────────────────────────────────────────────"
echo "TEST 2: OIDC Configuration Available"
echo "────────────────────────────────────────────────────────────────────"

OIDC_CONFIG=$(curl -s "$KEYCLOAK_BASE_URL/.well-known/openid-configuration" 2>/dev/null)

if [ -z "$OIDC_CONFIG" ]; then
    echo -e "${RED}❌ FAIL: Cannot retrieve OIDC configuration${NC}"
else
    TOKEN_ENDPOINT=$(echo "$OIDC_CONFIG" | grep -o '"token_endpoint":"[^"]*' | cut -d'"' -f4)
    USERINFO_ENDPOINT=$(echo "$OIDC_CONFIG" | grep -o '"userinfo_endpoint":"[^"]*' | cut -d'"' -f4)
    AUTH_ENDPOINT=$(echo "$OIDC_CONFIG" | grep -o '"authorization_endpoint":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$TOKEN_ENDPOINT" ]; then
        echo -e "${GREEN}✅ PASS: OIDC configuration found${NC}"
        echo "  Token Endpoint: $TOKEN_ENDPOINT"
        echo "  Userinfo Endpoint: $USERINFO_ENDPOINT"
        echo "  Auth Endpoint: $AUTH_ENDPOINT"
    else
        echo -e "${RED}❌ FAIL: Could not parse OIDC endpoints${NC}"
    fi
fi
echo ""

# Test 3: Token Endpoint Accessible
echo "────────────────────────────────────────────────────────────────────"
echo "TEST 3: Token Endpoint Accessible"
echo "────────────────────────────────────────────────────────────────────"
echo "Testing: POST $TOKEN_ENDPOINT with invalid code (should return error)"

if [ -n "$TOKEN_ENDPOINT" ]; then
    TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "code=invalid_code&client_id=$KEYCLOAK_CLIENT_ID&client_secret=$KEYCLOAK_CLIENT_SECRET&grant_type=authorization_code&redirect_uri=http://$API_HOST/auth/keycloak/callback/" \
        2>/dev/null)
    
    if echo "$TOKEN_RESPONSE" | grep -q "error"; then
        echo -e "${GREEN}✅ PASS: Token endpoint is accessible (returned error as expected)${NC}"
        echo "  Response contains: $(echo "$TOKEN_RESPONSE" | head -c 100)..."
    else
        echo -e "${YELLOW}⚠️  WARNING: Unexpected token response${NC}"
        echo "  Response: $TOKEN_RESPONSE"
    fi
else
    echo -e "${RED}❌ FAIL: Token endpoint not found in OIDC configuration${NC}"
fi
echo ""

# Test 4: Check Backend Configuration
echo "────────────────────────────────────────────────────────────────────"
echo "TEST 4: Backend Configuration"
echo "────────────────────────────────────────────────────────────────────"

if [ -f "/home/kalki/plane/apps/api/.env" ]; then
    echo "Checking .env file for Keycloak config..."
    if grep -q "KEYCLOAK_CLIENT_ID" /home/kalki/plane/apps/api/.env; then
        echo -e "${GREEN}✅ PASS: KEYCLOAK_CLIENT_ID is configured${NC}"
    else
        echo -e "${RED}❌ FAIL: KEYCLOAK_CLIENT_ID not found in .env${NC}"
    fi
    
    if grep -q "KEYCLOAK_BASE_URL" /home/kalki/plane/apps/api/.env; then
        echo -e "${GREEN}✅ PASS: KEYCLOAK_BASE_URL is configured${NC}"
    else
        echo -e "${RED}❌ FAIL: KEYCLOAK_BASE_URL not found in .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  WARNING: .env file not found${NC}"
fi
echo ""

# Test 5: Backend Endpoints
echo "────────────────────────────────────────────────────────────────────"
echo "TEST 5: Backend Endpoints Available"
echo "────────────────────────────────────────────────────────────────────"

echo "Testing: GET http://$API_HOST/auth/keycloak/"
INITIATE_RESPONSE=$(curl -s -w "\n%{http_code}" "http://$API_HOST/auth/keycloak/" 2>/dev/null)
HTTP_CODE=$(echo "$INITIATE_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ]; then
    echo -e "${GREEN}✅ PASS: Initiate endpoint returns redirect (HTTP $HTTP_CODE)${NC}"
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ FAIL: Cannot reach backend at http://$API_HOST${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Unexpected HTTP status: $HTTP_CODE${NC}"
fi
echo ""

# Test 6: Python Syntax Check
echo "────────────────────────────────────────────────────────────────────"
echo "TEST 6: Code Syntax Check"
echo "────────────────────────────────────────────────────────────────────"

for file in \
    "/home/kalki/plane/apps/api/plane/authentication/views/app/keycloak.py" \
    "/home/kalki/plane/apps/api/plane/authentication/adapter/keycloak.py" \
    "/home/kalki/plane/apps/api/plane/authentication/adapter/oauth.py"; do
    
    if python -m py_compile "$file" 2>/dev/null; then
        echo -e "${GREEN}✅ PASS: $(basename $file) - Syntax OK${NC}"
    else
        echo -e "${RED}❌ FAIL: $(basename $file) - Syntax Error${NC}"
    fi
done
echo ""

# Test 7: Error Code Check
echo "────────────────────────────────────────────────────────────────────"
echo "TEST 7: Error Codes Defined"
echo "────────────────────────────────────────────────────────────────────"

if grep -q "KEYCLOAK_OAUTH_PROVIDER_ERROR" /home/kalki/plane/apps/api/plane/authentication/adapter/error.py; then
    CODE=$(grep "KEYCLOAK_OAUTH_PROVIDER_ERROR" /home/kalki/plane/apps/api/plane/authentication/adapter/error.py | grep -o "[0-9]\+")
    echo -e "${GREEN}✅ PASS: KEYCLOAK_OAUTH_PROVIDER_ERROR = $CODE${NC}"
else
    echo -e "${RED}❌ FAIL: KEYCLOAK_OAUTH_PROVIDER_ERROR not defined${NC}"
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════════"
echo "DIAGNOSTIC SUMMARY"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "If seeing error_code=5126 (KEYCLOAK_OAUTH_PROVIDER_ERROR):"
echo "1. Check API logs: docker logs plane-api | grep KEYCLOAK"
echo "2. Verify Keycloak is running and accessible"
echo "3. Check token endpoint can exchange code"
echo "4. Verify backend configuration (KEYCLOAK_* env vars)"
echo "5. Check redirect URI matches in Keycloak client config"
echo ""
echo "Expected URL after successful auth:"
echo "  http://localhost:3000/ (no error parameters)"
echo ""
echo "Current error URL:"
echo "  http://localhost:3000/?error_code=5126&error_message=KEYCLOAK_OAUTH_PROVIDER_ERROR"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
