# WebRTC Voice Streaming Backend

This is the backend service for the Home Assistant Voice Streaming add-on. It provides WebRTC-based real-time audio streaming capabilities with minimal latency.

## Features

- WebRTC signaling server for establishing peer connections
- WebSocket API for real-time control and communication
- Audio stream processing with aiortc
- Docker containerization for easy deployment
- Health check endpoint for monitoring

## Prerequisites

- Docker and Docker Compose
- Python 3.11 (if running locally)

## Installation

1. Make sure you have Docker and Docker Compose installed
2. Navigate to the root directory of the project
3. Run `docker compose up -d` to start all services

## Usage

The service will be available on port 8080. The following endpoints are available:

- `GET /health` - Health check endpoint
- `GET /ws` - WebSocket connection for real-time communication
- `POST /webrtc/offer` - WebRTC offer handling
- `POST /webrtc/answer` - WebRTC answer handling
- `POST /webrtc/candidate` - ICE candidate handling

## Development

To run the server locally for development:

1. Create a virtual environment: `python -m venv venv`
2. Activate it: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
3. Install dependencies: `pip install -r requirements.txt`
4. Run the server: `python webrtc_server.py`

## Testing

Run the test script to verify the server is working:

```bash
python test_server.py
```

## Architecture

The server is built using:

- aiohttp for the web server
- aiortc for WebRTC implementation
- asyncio for asynchronous operations

The server handles WebRTC connections from the frontend, processes audio streams in real-time, and communicates with Home Assistant through WebSocket events.
