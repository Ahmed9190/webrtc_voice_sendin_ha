#!/bin/bash
# stop_services.sh
# Script to stop all services for the voice streaming setup

echo "Stopping Voice Streaming Services"
echo "================================="

echo "Stopping Docker services..."
docker-compose down

echo "Services stopped successfully!"