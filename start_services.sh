#!/bin/bash
# start_services.sh
# Script to start all services for the voice streaming setup

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