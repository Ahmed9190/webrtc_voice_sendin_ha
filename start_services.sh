#!/bin/bash
# start_services.sh
# Script to start all services for the voice streaming setup

# Set the external IP for the TURN server
export EXTERNAL_IP=$(curl -s https://ipinfo.io/ip)
if [ -z "$EXTERNAL_IP" ]; then
    echo "Warning: Could not determine external IP, using localhost"
    export EXTERNAL_IP="127.0.0.1"
fi
echo "Using external IP: $EXTERNAL_IP"

echo "Starting Voice Streaming Services"
echo "================================="

echo "Building and starting Docker services..."
docker compose up -d

echo "Waiting for services to start..."
sleep 10

echo "Checking service status..."
docker compose ps

echo "Services started successfully!"
echo "Access Home Assistant at: https://localhost"
echo "WebRTC backend API at: http://localhost:8080"