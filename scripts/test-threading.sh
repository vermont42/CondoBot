#!/bin/bash
#
# Test conversation threading in draft generation.
#
# Usage:
#   ./scripts/test-threading.sh                    # runs against production Railway URL
#   ./scripts/test-threading.sh http://localhost:3000  # runs against local dev server
#
# Prerequisites:
#   - HOSPITABLE_API_TOKEN in .env (used to look up a real reservation ID)
#   - jq installed
#   - The target server running

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

BASE_URL="${1:-https://condobot-production.up.railway.app}"
WEBHOOK_URL="$BASE_URL/webhooks/hospitable"

echo "=== Conversation Threading Test ==="
echo "Target: $WEBHOOK_URL"
echo ""

# ── Step 1: Find a reservation with messages ──────────────────────────

echo "── Step 1: Finding a reservation with messages..."

if [[ -z "${HOSPITABLE_API_TOKEN:-}" ]]; then
  echo "ERROR: HOSPITABLE_API_TOKEN not set. Add it to .env or export it."
  exit 1
fi

# Fetch properties first, then get reservations for the first property
PROPERTY_ID=$(curl -sf https://public.api.hospitable.com/v2/properties \
  -H "Authorization: Bearer $HOSPITABLE_API_TOKEN" \
  -H "Accept: application/json" | jq -r '.data[0].id // empty')

RESERVATION_ID=""
if [[ -n "$PROPERTY_ID" ]]; then
  RESERVATION_ID=$(curl -sf "https://public.api.hospitable.com/v2/reservations?properties[]=$PROPERTY_ID" \
    -H "Authorization: Bearer $HOSPITABLE_API_TOKEN" \
    -H "Accept: application/json" | jq -r '.data[0].id // empty')
fi

if [[ -z "$RESERVATION_ID" ]]; then
  echo "ERROR: Could not fetch a reservation from Hospitable API."
  echo "Skipping threaded test — running fallback test only."
  RESERVATION_ID=""
fi

echo "   Reservation ID: ${RESERVATION_ID:-<none>}"
echo ""

# ── Step 2: Test with real reservation (threaded) ─────────────────────

if [[ -n "$RESERVATION_ID" ]]; then
  echo "── Step 2: Sending webhook WITH reservation_id (should fetch thread)..."

  cat > /tmp/test-threading-real.json <<EOF
{
  "action": "message.created",
  "data": {
    "body": "And what about the Wi-Fi speed?",
    "sender_type": "guest",
    "user": { "first_name": "TestGuest" },
    "listing": { "name": "Gorgeous Unit, Stunning Views!" },
    "platform": "airbnb",
    "reservation_id": "$RESERVATION_ID",
    "conversation_id": "test-threading-conv-001"
  }
}
EOF

  HTTP_CODE=$(curl -s -o /tmp/test-threading-real-response.txt -w "%{http_code}" \
    -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d @/tmp/test-threading-real.json)

  echo "   HTTP $HTTP_CODE — $(cat /tmp/test-threading-real-response.txt)"
  echo "   → Check Railway logs for 'GET /v2/reservations/$RESERVATION_ID/messages'"
  echo "   → Check Slack for a draft that references prior conversation context"
  echo ""
else
  echo "── Step 2: SKIPPED (no reservation found)"
  echo ""
fi

# ── Step 3: Test with bogus reservation (graceful fallback) ───────────

echo "── Step 3: Sending webhook with BOGUS reservation_id (should fallback gracefully)..."

cat > /tmp/test-threading-bogus.json <<EOF
{
  "action": "message.created",
  "data": {
    "body": "Hi, is the pool heated?",
    "sender_type": "guest",
    "user": { "first_name": "TestGuest" },
    "listing": { "name": "Gorgeous Unit, Stunning Views!" },
    "platform": "airbnb",
    "reservation_id": "fake-reservation-id-12345",
    "conversation_id": "test-threading-conv-002"
  }
}
EOF

HTTP_CODE=$(curl -s -o /tmp/test-threading-bogus-response.txt -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-threading-bogus.json)

echo "   HTTP $HTTP_CODE — $(cat /tmp/test-threading-bogus-response.txt)"
echo "   → Check Railway logs for warning about failed message fetch"
echo "   → Draft should still appear in Slack (single-message mode)"
echo ""

# ── Step 4: Test without reservation (inquiry-only, no threading) ─────

echo "── Step 4: Sending webhook WITHOUT reservation_id (inquiry-only, no threading)..."

cat > /tmp/test-threading-none.json <<EOF
{
  "action": "message.created",
  "data": {
    "body": "Is your place available for Christmas week?",
    "sender_type": "guest",
    "user": { "first_name": "TestGuest" },
    "listing": { "name": "Gorgeous Unit, Stunning Views!" },
    "platform": "airbnb",
    "conversation_id": "test-threading-conv-003"
  }
}
EOF

HTTP_CODE=$(curl -s -o /tmp/test-threading-none-response.txt -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-threading-none.json)

echo "   HTTP $HTTP_CODE — $(cat /tmp/test-threading-none-response.txt)"
echo "   → No thread fetch should occur (no reservation_id)"
echo "   → Draft should appear in Slack (single-message mode)"
echo ""

# ── Done ──────────────────────────────────────────────────────────────

echo "=== Done ==="
echo ""
echo "Check Railway logs and Slack for results. You should see:"
echo "  Step 2: Thread fetched, draft uses conversation context"
echo "  Step 3: Warning logged, draft generated without thread (fallback)"
echo "  Step 4: No thread fetch attempted, draft generated normally"
