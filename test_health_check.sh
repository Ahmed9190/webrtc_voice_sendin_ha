#!/bin/bash
# Test health check functionality

echo "Testing health check endpoint..."

# Simple curl test
echo "=== Basic Health Check ==="
curl -v http://localhost:8080/health

echo -e "\n=== Docker Health Check ==="
docker compose ps

echo -e "\n=== Docker Service Logs ==="
docker compose logs voice_streaming | tail -20