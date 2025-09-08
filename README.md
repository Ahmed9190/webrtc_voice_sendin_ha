# Home Assistant Voice Streaming Add-on

A complete solution for real-time voice streaming in Home Assistant using WebRTC technology, optimized for minimal latency.

## Features

- **Low-latency WebRTC streaming**: Optimized for real-time voice communication
- **Custom Home Assistant panels**: User-friendly interfaces built with Web Components
- **Docker containerization**: Easy deployment and management
- **Secure communication**: HTTPS proxying with SSL certificates
- **Performance optimization**: Configurable settings for minimal latency
- **Error handling**: Automatic reconnection and recovery mechanisms
- **Voice sending capabilities**: Dedicated panel for sending voice streams
- **Voice receiving capabilities**: Dedicated panel for receiving and playing back voice streams
- **TURN server support**: Built-in coturn server for NAT traversal (especially important for Windows)

## Architecture

The solution consists of four main components:

1. **Home Assistant**: The core home automation platform
2. **WebRTC Backend**: Python server handling WebRTC connections and audio processing
3. **Voice Sending Card**: Custom panel for sending voice streams
4. **Voice Receiving Card**: Custom panel for receiving and playing back voice streams
5. **TURN Server (coturn)**: Server for NAT traversal, especially important for Windows machines

## Prerequisites

- Docker and Docker Compose
- Linux-based system (tested on Manjaro Linux)
- Microphone for audio input

## Installation

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd home_assistant
   ```

2. Start the services:

   ```bash
   ./start_services.sh
   ```

3. Access Home Assistant at `https://localhost`

## Usage

1. Open your browser and navigate to `https://localhost`
2. Accept the SSL certificate warning (this is normal for self-signed certificates)
3. Complete the Home Assistant setup if this is the first time
4. Look for the "Voice Stream" panel in the sidebar (microphone icon)
5. Click the microphone button to start streaming
6. Speak into your microphone
7. Click the stop button to end the session

## Directory Structure

```
home_assistant/
├── config/                 # Home Assistant configuration
│   ├── configuration.yaml  # Main configuration file
│   └── www/               # Static files directory
│       ├── voice-sending-card.js  # Custom panel frontend for sending
│       └── voice-receiving-card.js  # Custom panel frontend for receiving
├── webrtc_backend/         # WebRTC backend service
│   ├── webrtc_server.py    # Main server implementation
│   ├── config.json         # Server configuration
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Container definition
│   └── README.md           # Backend documentation
├── ssl/                    # SSL certificates
├── nginx.conf             # Nginx configuration
├── docker compose.yml     # Docker Compose configuration
├── start_services.sh      # Service startup script
└── stop_services.sh       # Service shutdown script
```

## Configuration

### WebRTC Backend

The backend server can be configured through `webrtc_backend/config.json`:

```json
{
  "webrtc": {
    "ice_servers": [
      { "urls": "stun:stun.l.google.com:19302" },
      { "urls": "stun:stun1.l.google.com:19302" },
      { "urls": "stun:stun.stunprotocol.org:3478" },
      { "urls": "stun:stun.voiparound.com" },
      { "urls": "stun:stun.voipbuster.com" },
      { 
        "urls": "turn:coturn:3478",
        "username": "voice",
        "credential": "streaming"
      }
    ],
    "rtc_config": {
      "bundlePolicy": "max-bundle",
      "rtcpMuxPolicy": "require",
      "sdpSemantics": "unified-plan",
      "iceCandidatePoolSize": 10
    },
    "audio_constraints": {
      "sample_rate": 16000,
      "channels": 1,
      "echo_cancellation": true,
      "noise_suppression": true,
      "auto_gain_control": true
    }
  }
}
```

The server automatically loads this configuration file at startup. Changes to the configuration will be applied when the server is restarted.

### Home Assistant

The Home Assistant configuration is in `config/configuration.yaml`:

```yaml
# Custom panels for our voice streaming interface
panel_custom:
  - name: voice-sending-card
    sidebar_title: Voice Send
    sidebar_icon: mdi:microphone
    url_path: voice-streaming
    module_url: /local/voice-sending-card.js
  - name: voice-receiving-card
    sidebar_title: Voice Receive
    sidebar_icon: mdi:headphones
    url_path: voice-receiving
    module_url: /local/voice-receiving-card.js
```

## Performance Optimization

The solution is optimized for minimal latency with:

1. **WebRTC settings**:

   - `bundlePolicy: max-bundle`
   - `rtcpMuxPolicy: require`
   - `sdpSemantics: unified-plan`
   - `iceCandidatePoolSize: 10`

2. **Audio constraints**:

   - Sample rate: 16kHz
   - Mono channel
   - Echo cancellation
   - Noise suppression
   - Auto gain control

3. **Network configuration**:
   - Host networking mode
   - Optimized Nginx proxy settings
   - Direct WebSocket communication
   - TURN server for NAT traversal
   - Restricted port range (49152-49252) for Windows compatibility

## Testing

Run the integration tests to verify the setup:

```bash
python integration_test.py
```

### Health Checks

The service includes comprehensive health checks:

1. **Docker Health Check**: Automatic container health monitoring
2. **HTTP Health Endpoint**: `GET /health` for detailed status information
3. **Manual Health Check**: Run `python health_check.py` for detailed diagnostics

The health endpoint returns detailed information:
```json
{
  "status": "healthy",
  "server": "healthy",
  "webrtc_available": true,
  "webrtc_functional": true,
  "active_connections": 0,
  "active_streams": 0,
  "timestamp": 1234567890.123
}
```

Status values:
- `healthy`: All systems operational
- `degraded`: Some features may not work properly
- `unhealthy`: Critical failure

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors**:

   - The self-signed certificate will cause browser warnings
   - Accept the certificate to proceed

2. **Microphone Permissions**:

   - Allow microphone access when prompted by the browser

3. **Permission denied errors**:

   - Ensure Docker is installed and your user is in the docker group
   - Run `sudo usermod -aG docker $USER` and log out/in

4. **Services not starting**:

   - Check Docker logs: `docker compose logs`
   - Verify ports are not in use

5. **WebRTC connection failures**:
   - Check firewall settings
   - Verify STUN/TURN server connectivity
   - **Windows-specific**: See WINDOWS_TROUBLESHOOTING.md for detailed Windows troubleshooting

### Logs

View service logs with:

```bash
docker compose logs -f
```

## Development

### Backend Development

1. Create a virtual environment:

   ```bash
   cd webrtc_backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Run the server locally:
   ```bash
   python webrtc_server.py
   ```

### Frontend Development

The frontend cards are written in JavaScript using Web Components. Changes to `config/www/voice-sending-card.js` and `config/www/voice-receiving-card.js` will be reflected immediately in Home Assistant.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Home Assistant community
- aiortc library for WebRTC implementation
- Web Components for frontend
- coturn project for TURN server implementation
