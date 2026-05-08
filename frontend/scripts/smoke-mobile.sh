#!/usr/bin/env bash
set -euo pipefail

# Smoke test for mobile API routes.
# Requires an Android emulator to be running (or boots one).
# Usage: bash scripts/smoke-mobile.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3001}"

echo "=== Mobile API Smoke Test ==="
echo "Base URL: $BASE_URL"

# Wait for adb device
echo "Waiting for adb device..."
for i in {1..30}; do
  if adb devices | grep -q "device$"; then
    echo "Adb device found"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "No adb device found after 30s. Start an emulator first:"
    echo "  emulator -avd <avd_name>"
    exit 1
  fi
  sleep 1
done

# Test /devices
echo "Testing /devices..."
DEVICES_RESPONSE=$(curl -s "$BASE_URL/api/agent/mobile/devices")
echo "  devices response: $DEVICES_RESPONSE"
echo "$DEVICES_RESPONSE" | jq -e '.devices' >/dev/null
DEVICE_ID=$(echo "$DEVICES_RESPONSE" | jq -r '.devices[0].id // empty')
if [ -z "$DEVICE_ID" ]; then
  echo "ERROR: No devices returned"
  exit 1
fi
echo "  Selected device: $DEVICE_ID"

# Test /screenshot
echo "Testing /screenshot..."
SCREENSHOT_RESPONSE=$(curl -s -o /tmp/smoke-screenshot.png -w "%{http_code}" \
  "$BASE_URL/api/agent/mobile/screenshot?device=$DEVICE_ID")
if [ "$SCREENSHOT_RESPONSE" != "200" ]; then
  echo "ERROR: Screenshot returned HTTP $SCREENSHOT_RESPONSE"
  exit 1
fi
# Verify PNG signature
PNG_HEADER=$(xxd -l 4 /tmp/smoke-screenshot.png | awk '{print $2$3}')
if [ "$PNG_HEADER" != "89504e47" ]; then
  echo "ERROR: Screenshot is not a valid PNG (header: $PNG_HEADER)"
  exit 1
fi
echo "  Screenshot OK (PNG, $(wc -c < /tmp/smoke-screenshot.png) bytes)"

# Test /tap
echo "Testing /tap..."
TAP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/agent/mobile/tap" \
  -H "Content-Type: application/json" \
  -d "{\"device\":\"$DEVICE_ID\",\"x\":100,\"y\":200}")
echo "  tap response: $TAP_RESPONSE"
echo "$TAP_RESPONSE" | jq -e '.success' >/dev/null
echo "  Tap OK"

# Test /button
echo "Testing /button..."
BUTTON_RESPONSE=$(curl -s -X POST "$BASE_URL/api/agent/mobile/button" \
  -H "Content-Type: application/json" \
  -d "{\"device\":\"$DEVICE_ID\",\"button\":\"HOME\"}")
echo "  button response: $BUTTON_RESPONSE"
echo "$BUTTON_RESPONSE" | jq -e '.success' >/dev/null
echo "  Button OK"

# Test /health
echo "Testing /health..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/agent/mobile/health")
echo "  health response: $HEALTH_RESPONSE"
echo "$HEALTH_RESPONSE" | jq -e '.nodeVersionOk' >/dev/null
echo "  Health OK"

echo ""
echo "=== All smoke tests passed ==="
