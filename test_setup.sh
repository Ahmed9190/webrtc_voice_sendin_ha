#!/bin/bash
# test_setup.sh
# Script to test the entire voice streaming setup

echo "Testing Voice Streaming Setup"
echo "============================="

echo "1. Checking if Docker services are running..."
docker-compose ps

echo -e "\n2. Testing Home Assistant health..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://localhost/health

echo -e "\n3. Testing WebRTC backend health..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8080/health

echo -e "\n4. Checking if voice-streaming-card.js exists..."
if [ -f "./config/www/voice-streaming-card.js" ]; then
    echo "✓ voice-streaming-card.js found"
else
    echo "✗ voice-streaming-card.js not found"
fi

echo -e "\n5. Checking configuration.yaml for voice_streaming component..."
if grep -q "voice_streaming:" "./config/configuration.yaml"; then
    echo "✓ voice_streaming component configured"
else
    echo "✗ voice_streaming component not configured"
fi

echo -e "\nSetup test completed!"