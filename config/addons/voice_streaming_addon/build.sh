#!/bin/bash
set -e

# Build the add-on
echo "Building Voice Streaming Add-on..."

# Install Node.js dependencies and build frontend
cd www
npm install
npm run build
cd ..

# Build Docker image
docker build -t voice-streaming-addon:latest .

# Test the image
docker run --rm voice-streaming-addon:latest /app/run.sh --test

echo "Build completed successfully!"