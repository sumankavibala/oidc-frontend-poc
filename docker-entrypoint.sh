#!/bin/sh

# Default VITE_API_SERVERURL if not set at runtime
DEFAULT_URL="http://localhost:6000"
API_URL="${VITE_API_SERVERURL:-$DEFAULT_URL}"

echo "Replacing runtime VITE_API_SERVERURL with: $API_URL"

# Substitute placeholder in JS bundle assets
find /usr/share/nginx/html/assets -type f -name "*.js" -exec sed -i "s|__VITE_API_SERVERURL_PLACEHOLDER__|$API_URL|g" {} +

exec "$@"
