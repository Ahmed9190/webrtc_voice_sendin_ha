#!/bin/bash
set -e

# Load configuration
CONFIG_PATH="/data/options.json"

# Extract configuration values
SSL_ENABLED=$(jq -r '.ssl // false' $CONFIG_PATH)
CERTFILE=$(jq -r '.certfile // "fullchain.pem"' $CONFIG_PATH)
KEYFILE=$(jq -r '.keyfile // "privkey.pem"' $CONFIG_PATH)

# Start the Python WebRTC server
echo "Starting Voice Streaming Server..."
cd /app
python -m src.webrtc_server &

# Start nginx for serving static files
nginx -g 'daemon off;' &

# Wait for all background processes
wait