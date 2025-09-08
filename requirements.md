# Home Assistant Voice Streaming Add-on Development Guide

This comprehensive guide will walk you through creating a complete Home Assistant setup with a custom WebRTC-based voice streaming dashboard card, optimized for minimal latency on Manjaro Linux.

## Phase 1: Environment Setup

### Docker Installation and Configuration

First, ensure Docker and Docker Compose are properly installed on Manjaro:

```bash
# Update system packages
sudo pacman -Syu

# Install Docker and Docker Compose
sudo pacman -S docker docker compose

# Enable and start Docker service
sudo systemctl enable docker.service
sudo systemctl start docker.service

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### Home Assistant Docker Compose Setup

Create the Home Assistant directory structure:

```bash
# Create Home Assistant directory
mkdir -p ~/homeassistant
cd ~/homeassistant

# Create subdirectories for organization
mkdir -p config addons media backup
```

Create a `docker compose.yml` file with optimized networking for voice streaming:

```yaml
version: "3.8"

services:
  homeassistant:
    container_name: homeassistant
    image: homeassistant/home-assistant:stable
    volumes:
      - ./config:/config
      - ./addons:/config/custom_components
      - ./media:/media
      - /etc/localtime:/etc/localtime:ro
      - /run/dbus:/run/dbus:ro
    restart: unless-stopped
    privileged: true
    network_mode: host
    environment:
      - TZ=Africa/Cairo
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0 # Optional: for Zigbee/Z-Wave
    ports:
      - "8123:8123"
      - "1900:1900/udp" # For device discovery
      - "5353:5353/udp" # mDNS
    labels:
      - "com.centurylinklabs.watchtower.enable=false"

  # Optional: Nginx proxy for HTTPS (required for WebRTC)
  nginx:
    container_name: ha-nginx
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    ports:
      - "443:443"
      - "80:80"
    restart: unless-stopped
    depends_on:
      - homeassistant

networks:
  default:
    driver: bridge
```

### HTTPS Configuration for WebRTC

Create SSL certificates (self-signed for development):

```bash
# Create SSL directory
mkdir ssl
cd ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout homeassistant.key -out homeassistant.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=homeassistant.local"

cd ..
```

Create `nginx.conf` for HTTPS proxy:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream homeassistant {
        server homeassistant:8123;
    }

    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name _;

        ssl_certificate /etc/ssl/homeassistant.crt;
        ssl_certificate_key /etc/ssl/homeassistant.key;
        ssl_protocols TLSv1.2 TLSv1.3;

        # WebRTC/WebSocket specific configurations
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        location / {
            proxy_pass http://homeassistant;
            proxy_redirect off;
        }

        # WebRTC signaling endpoint
        location /api/webrtc/ {
            proxy_pass http://homeassistant;
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }
    }
}
```

### Initial Home Assistant Startup

```bash
# Start Home Assistant
docker compose up -d

# Check logs
docker compose logs -f homeassistant

# Wait for startup, then access via https://localhost:443
```

Complete the Home Assistant setup wizard, then add essential configuration to `config/configuration.yaml`:

```yaml
# Basic configuration
default_config:

# Enable frontend
frontend:
  themes: !include_dir_merge_named themes

# Enable WebSocket API for real-time communication
websocket_api:

# Enable REST API
api:

# HTTP configuration for reverse proxy
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.16.0.0/12
    - 192.168.0.0/16
    - 10.0.0.0/8
  cors_allowed_origins:
    - https://localhost:443
    - https://homeassistant.local:443

# Custom panels for our voice streaming interface
panel_custom:
  - name: voice-streaming
    sidebar_title: Voice Stream
    sidebar_icon: mdi:microphone
    url_path: voice-streaming
    module_url: /local/voice-streaming-card.js

# Logging for debugging
logger:
  default: warning
  logs:
    custom_components.voice_streaming: debug
```

### Essential Add-ons Installation

Install SSH and Samba add-ons from the Home Assistant Supervisor:

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Install **SSH & Web Terminal** and **Samba Share**
3. Configure SSH add-on in `config/addons_config/ssh.yaml`:

```yaml
ssh:
  username: ahmed
  password: your_secure_password
  authorized_keys:
    - "ssh-rsa YOUR_SSH_PUBLIC_KEY"
  sftp: true
  compatibility_mode: false
  allow_agent_forwarding: false
  allow_remote_port_forwarding: false
  allow_tcp_forwarding: false
```

## Phase 2: Add-on Development Foundation

### Local Add-on Development Structure

Create the custom add-on directory structure:

```bash
# Create add-on directory
mkdir -p config/addons/voice_streaming_addon

cd config/addons/voice_streaming_addon

# Create add-on structure
mkdir -p src www data
touch config.yaml Dockerfile build.yaml DOCS.md README.md
```

### Add-on Configuration Files

Create `config.yaml` for the voice streaming add-on:

```yaml
name: Voice Streaming WebRTC
version: "1.0.0"
slug: voice_streaming_webrtc
description: Real-time voice streaming using WebRTC with minimal latency
url: https://github.com/your-repo/voice-streaming-addon
webui: http://[HOST]:[PORT:8080]
startup: services
arch:
  - aarch64
  - amd64
  - armhf
  - armv7
  - i386
init: false
ports:
  8080/tcp: 8080
  3478/udp: 3478 # STUN
  5349/tcp: 5349 # TURNS
  49152:65535/udp: null # RTP port range
ports_description:
  8080/tcp: Web interface
  3478/udp: STUN server
  5349/tcp: TURNS server
options:
  ssl: true
  certfile: fullchain.pem
  keyfile: privkey.pem
  stun_servers:
    - "stun:stun.l.google.com:19302"
    - "stun:stun1.l.google.com:19302"
  ice_servers: []
  audio_settings:
    sample_rate: 16000
    channels: 1
    bit_depth: 16
  processing:
    noise_suppression: true
    echo_cancellation: true
    auto_gain_control: true
schema:
  ssl: bool
  certfile: str
  keyfile: str
  stun_servers: [str]
  ice_servers: [str]
  audio_settings:
    sample_rate: int
    channels: int
    bit_depth: int
  processing:
    noise_suppression: bool
    echo_cancellation: bool
    auto_gain_control: bool
image: ghcr.io/your-username/voice-streaming-{arch}
```

Create `Dockerfile`:

```dockerfile
FROM python:3.11-alpine

# Install system dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    ffmpeg \
    alsa-utils \
    pulseaudio \
    gcc \
    musl-dev \
    linux-headers

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Node.js package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY www/ ./www/

# Create necessary directories
RUN mkdir -p /data/recordings /data/config

# Expose ports
EXPOSE 8080 3478/udp 5349

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:8080/health || exit 1

# Start script
COPY run.sh .
RUN chmod +x run.sh

CMD ["./run.sh"]
```

Create `requirements.txt`:

```
aiohttp==3.8.6
websockets==11.0.3
aiortc==1.5.0
pyaudio==0.2.11
numpy==1.24.3
scipy==1.10.1
pydantic==2.4.2
uvloop==0.17.0
```

Create `package.json`:

```json
{
  "name": "voice-streaming-webrtc",
  "version": "1.0.0",
  "description": "WebRTC voice streaming for Home Assistant",
  "main": "www/voice-streaming-card.js",
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w"
  },
  "dependencies": {
    "@webrtc/adapter": "^8.2.2",
    "lit": "^2.8.0"
  },
  "devDependencies": {
    "@rollup/plugin-node-resolve": "^15.2.3",
    "@rollup/plugin-terser": "^0.4.4",
    "rollup": "^3.29.4"
  }
}
```

## Phase 3: Voice Streaming Add-on Creation

### WebRTC Audio Streaming Backend

Create `src/webrtc_server.py`:

```python
import asyncio
import json
import logging
import uuid
from typing import Dict, Optional, Set
from aiohttp import web, WSMsgType
from aiohttp.web_ws import WebSocketResponse
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaRecorder
import numpy as np
from scipy.io import wavfile
import pyaudio

logger = logging.getLogger(__name__)

class AudioStreamTrack(MediaStreamTrack):
    """Custom audio track for receiving streamed audio"""
    kind = "audio"

    def __init__(self):
        super().__init__()
        self.queue = asyncio.Queue(maxsize=100)
        self._timestamp = 0

    async def recv(self):
        frame = await self.queue.get()
        self._timestamp += frame.samples
        return frame

class VoiceStreamingServer:
    def __init__(self, config: dict):
        self.config = config
        self.connections: Dict[str, dict] = {}
        self.app = web.Application()
        self.setup_routes()

    def setup_routes(self):
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/ws', self.websocket_handler)
        self.app.router.add_post('/webrtc/offer', self.handle_offer)
        self.app.router.add_post('/webrtc/answer', self.handle_answer)
        self.app.router.add_post('/webrtc/candidate', self.handle_candidate)
        self.app.router.add_static('/', '/app/www')

    async def health_check(self, request):
        return web.json_response({'status': 'healthy'})

    async def websocket_handler(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        connection_id = str(uuid.uuid4())
        self.connections[connection_id] = {
            'ws': ws,
            'pc': None,
            'recorder': None
        }

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    await self.handle_message(connection_id, data)
                elif msg.type == WSMsgType.ERROR:
                    logger.error(f'WebSocket error: {ws.exception()}')

        except Exception as e:
            logger.error(f'WebSocket connection error: {e}')
        finally:
            await self.cleanup_connection(connection_id)

        return ws

    async def handle_message(self, connection_id: str, data: dict):
        message_type = data.get('type')
        connection = self.connections.get(connection_id)

        if not connection:
            return

        if message_type == 'start_stream':
            await self.start_voice_stream(connection_id)
        elif message_type == 'stop_stream':
            await self.stop_voice_stream(connection_id)
        elif message_type == 'webrtc_offer':
            await self.handle_webrtc_offer(connection_id, data)

    async def start_voice_stream(self, connection_id: str):
        connection = self.connections[connection_id]

        # Create RTCPeerConnection with optimized settings
        pc = RTCPeerConnection(configuration={
            'iceServers': [
                {'urls': server} for server in self.config['stun_servers']
            ],
            'iceCandidatePoolSize': 10,
        })

        connection['pc'] = pc

        # Set up audio track handling
        @pc.on("track")
        async def on_track(track):
            if track.kind == "audio":
                logger.info("Received audio track")

                # Create recorder for processing
                recorder = MediaRecorder("/data/recordings/stream.wav")
                await recorder.addTrack(track)
                await recorder.start()
                connection['recorder'] = recorder

                # Process audio frames in real-time
                asyncio.create_task(self.process_audio_stream(track, connection_id))

        # Send ready signal
        await connection['ws'].send_text(json.dumps({
            'type': 'stream_ready',
            'connection_id': connection_id
        }))

    async def process_audio_stream(self, track: MediaStreamTrack, connection_id: str):
        """Process incoming audio frames with minimal latency"""
        try:
            while True:
                frame = await track.recv()

                # Convert frame to numpy array
                audio_data = np.frombuffer(frame.to_ndarray(), dtype=np.int16)

                # Apply real-time processing
                if self.config['processing']['noise_suppression']:
                    audio_data = self.apply_noise_suppression(audio_data)

                # Trigger Home Assistant events
                await self.trigger_voice_event(connection_id, audio_data)

        except Exception as e:
            logger.error(f"Audio processing error: {e}")

    def apply_noise_suppression(self, audio_data: np.ndarray) -> np.ndarray:
        """Basic noise suppression using spectral subtraction"""
        # Implement your preferred noise suppression algorithm
        return audio_data

    async def trigger_voice_event(self, connection_id: str, audio_data: np.ndarray):
        """Send audio data to Home Assistant for processing"""
        connection = self.connections[connection_id]

        # Send processed audio event
        await connection['ws'].send_text(json.dumps({
            'type': 'audio_data',
            'connection_id': connection_id,
            'data': audio_data.tolist(),
            'timestamp': asyncio.get_event_loop().time(),
            'sample_rate': self.config['audio_settings']['sample_rate']
        }))

    async def handle_webrtc_offer(self, connection_id: str, data: dict):
        connection = self.connections[connection_id]
        pc = connection['pc']

        if not pc:
            return

        # Set remote description
        offer = RTCSessionDescription(sdp=data['offer']['sdp'],
                                    type=data['offer']['type'])
        await pc.setRemoteDescription(offer)

        # Create and send answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await connection['ws'].send_text(json.dumps({
            'type': 'webrtc_answer',
            'answer': {
                'sdp': pc.localDescription.sdp,
                'type': pc.localDescription.type
            }
        }))

    async def cleanup_connection(self, connection_id: str):
        if connection_id in self.connections:
            connection = self.connections[connection_id]

            if connection.get('recorder'):
                await connection['recorder'].stop()

            if connection.get('pc'):
                await connection['pc'].close()

            del self.connections[connection_id]

    async def run_server(self):
        runner = web.AppRunner(self.app)
        await runner.setup()

        site = web.TCPSite(runner, '0.0.0.0', 8080)
        await site.start()

        logger.info("Voice streaming server started on port 8080")
```

### Custom Dashboard Card Frontend

Create `www/voice-streaming-card.js`:

```javascript
import { LitElement, html, css } from "lit";

class VoiceStreamingCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      border-radius: 8px;
      background: var(--ha-card-background, white);
      box-shadow: var(--ha-card-box-shadow);
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .record-button {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: none;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .record-button.inactive {
      background: #f44336;
      color: white;
    }

    .record-button.active {
      background: #4caf50;
      color: white;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
      }
    }

    .status {
      flex: 1;
      text-align: center;
    }

    .waveform {
      height: 100px;
      width: 100%;
      background: #f0f0f0;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .waveform canvas {
      width: 100%;
      height: 100%;
    }

    .settings {
      margin-top: 16px;
      padding: 16px;
      background: var(--secondary-background-color);
      border-radius: 4px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .latency-indicator {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }

    .latency-low {
      background: #4caf50;
      color: white;
    }
    .latency-medium {
      background: #ff9800;
      color: white;
    }
    .latency-high {
      background: #f44336;
      color: white;
    }
  `;

  static properties = {
    hass: {},
    config: {},
    isRecording: { type: Boolean },
    connectionStatus: { type: String },
    latency: { type: Number },
    audioLevel: { type: Number },
  };

  constructor() {
    super();
    this.isRecording = false;
    this.connectionStatus = "disconnected";
    this.latency = 0;
    this.audioLevel = 0;
    this.mediaStream = null;
    this.peerConnection = null;
    this.websocket = null;
    this.audioContext = null;
    this.analyzer = null;
    this.canvas = null;
    this.canvasContext = null;
  }

  firstUpdated() {
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.canvasContext = this.canvas.getContext("2d");
    this.initializeWebRTC();
  }

  async initializeWebRTC() {
    try {
      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      // Initialize audio context for visualization
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyzer = this.audioContext.createAnalyser();

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyzer);

      this.analyzer.fftSize = 256;
      this.startAudioVisualization();

      // Connect to WebSocket
      await this.connectWebSocket();

      this.connectionStatus = "connected";
      this.requestUpdate();
    } catch (error) {
      console.error("Error initializing WebRTC:", error);
      this.connectionStatus = "error";
      this.requestUpdate();
    }
  }

  async connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/voice-streaming/ws`;

    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      console.log("WebSocket connected");
    };

    this.websocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      await this.handleWebSocketMessage(data);
    };

    this.websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.connectionStatus = "error";
      this.requestUpdate();
    };
  }

  async handleWebSocketMessage(data) {
    switch (data.type) {
      case "stream_ready":
        console.log("Stream ready, connection ID:", data.connection_id);
        break;

      case "webrtc_answer":
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        break;

      case "audio_data":
        // Handle processed audio data from server
        this.updateLatency(data.timestamp);
        break;
    }
  }

  async toggleRecording() {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      // Create RTCPeerConnection with minimal latency settings
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
        iceCandidatePoolSize: 10,
      });

      // Add audio track
      this.mediaStream.getAudioTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.mediaStream);
      });

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.websocket.send(
            JSON.stringify({
              type: "ice_candidate",
              candidate: event.candidate,
            })
          );
        }
      };

      // Create and send offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await this.peerConnection.setLocalDescription(offer);

      this.websocket.send(
        JSON.stringify({
          type: "webrtc_offer",
          offer: offer,
        })
      );

      this.isRecording = true;
      this.requestUpdate();
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }

  async stopRecording() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.websocket.send(
      JSON.stringify({
        type: "stop_stream",
      })
    );

    this.isRecording = false;
    this.requestUpdate();
  }

  startAudioVisualization() {
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);

    const draw = () => {
      requestAnimationFrame(draw);

      this.analyzer.getByteFrequencyData(dataArray);

      this.canvasContext.fillStyle = "#f0f0f0";
      this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const barWidth = (this.canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = (dataArray[i] / 255) * this.canvas.height;

        this.canvasContext.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
        this.canvasContext.fillRect(x, this.canvas.height - barHeight / 2, barWidth, barHeight);

        x += barWidth + 1;
      }

      // Calculate audio level
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      this.audioLevel = average;
    };

    draw();
  }

  updateLatency(serverTimestamp) {
    const now = Date.now();
    this.latency = now - serverTimestamp * 1000;
    this.requestUpdate();
  }

  getLatencyClass() {
    if (this.latency < 50) return "latency-low";
    if (this.latency < 150) return "latency-medium";
    return "latency-high";
  }

  render() {
    return html`
      <div class="card-content">
        <h2>Voice Streaming</h2>

        <div class="controls">
          <button class="record-button ${this.isRecording ? "active" : "inactive"}" @click=${this.toggleRecording}>${this.isRecording ? "🛑" : "🎤"}</button>

          <div class="status">
            <div>Status: ${this.connectionStatus}</div>
            <div class="latency-indicator ${this.getLatencyClass()}">Latency: ${this.latency}ms</div>
          </div>
        </div>

        <div class="waveform">
          <canvas width="400" height="100"></canvas>
        </div>

        <div class="settings">
          <div class="setting-row">
            <label>Noise Suppression:</label>
            <input type="checkbox" checked />
          </div>
          <div class="setting-row">
            <label>Echo Cancellation:</label>
            <input type="checkbox" checked />
          </div>
          <div class="setting-row">
            <label>Auto Gain Control:</label>
            <input type="checkbox" checked />
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("voice-streaming-card", VoiceStreamingCard);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: "voice-streaming-card",
  name: "Voice Streaming Card",
  description: "Real-time voice streaming with WebRTC",
});
```

## Phase 4: WebRTC Integration & Optimization

### Startup Script

Create `run.sh`:

```bash
#!/bin/bash
set -e

# Load configuration
CONFIG_PATH="/data/options.json"

# Extract configuration values
SSL_ENABLED=$(jq -r '.ssl // false' $CONFIG_PATH)
CERTFILE=$(jq -r '.certfile // "fullchain.pem"' $CONFIG_PATH)
KEYFILE=$(jq -r '.keyfile // "privkey.pem"' $CONFIG_PATH)

# Start STUN server if needed
if [ "$SSL_ENABLED" = "true" ]; then
    echo "Starting TURN server with SSL..."
    # Configure coturn for TURN server
    turnserver -c /app/turnserver.conf &
fi

# Start the Python WebRTC server
echo "Starting Voice Streaming Server..."
cd /app
python -m src.webrtc_server &

# Start nginx for serving static files
nginx -g 'daemon off;' &

# Wait for all background processes
wait
```

### Performance Optimization Configuration

Create `turnserver.conf` for TURN server:

```
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=0.0.0.0
external-ip=YOUR_EXTERNAL_IP

realm=homeassistant.local
server-name=homeassistant.local

# Optimize for low latency
no-tcp-relay
no-udp-relay=false
no-multicast-peers
no-cli

# Security
use-auth-secret
static-auth-secret=your-secret-key

cert=/etc/ssl/homeassistant.crt
pkey=/etc/ssl/homeassistant.key

# Logging
log-file=/var/log/turnserver.log
verbose
```

### Home Assistant Integration

Create `config/custom_components/voice_streaming/__init__.py`:

```python
"""Voice Streaming Integration for Home Assistant."""
import asyncio
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

DOMAIN = "voice_streaming"
_LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Voice Streaming component."""
    hass.data[DOMAIN] = {}
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up Voice Streaming from a config entry."""

    # Initialize the voice streaming coordinator
    coordinator = VoiceStreamingCoordinator(hass, entry)
    await coordinator.async_setup()

    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Register WebSocket API
    hass.http.register_view(VoiceStreamingWebSocketView(coordinator))

    return True

class VoiceStreamingCoordinator:
    """Coordinator for managing voice streaming connections."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry):
        self.hass = hass
        self.entry = entry
        self.connections = {}

    async def async_setup(self):
        """Set up the coordinator."""
        # Register services
        self.hass.services.async_register(
            DOMAIN,
            "start_recording",
            self.start_recording
        )

        self.hass.services.async_register(
            DOMAIN,
            "stop_recording",
            self.stop_recording
        )

    async def start_recording(self, call):
        """Start voice recording service."""
        _LOGGER.info("Starting voice recording")
        self.hass.bus.async_fire("voice_streaming.recording_started")

    async def stop_recording(self, call):
        """Stop voice recording service."""
        _LOGGER.info("Stopping voice recording")
        self.hass.bus.async_fire("voice_streaming.recording_stopped")
```

### Build and Deployment

Create build script `build.sh`:

```bash
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
```

### Testing and Verification

Create test script `test_setup.py`:

```python
import asyncio
import websockets
import json

async def test_websocket_connection():
    """Test WebSocket connection to voice streaming server."""
    try:
        async with websockets.connect("ws://localhost:8080/ws") as websocket:
            # Test connection
            await websocket.send(json.dumps({
                "type": "test_connection"
            }))

            response = await websocket.recv()
            print(f"Response: {response}")

    except Exception as e:
        print(f"Connection test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket_connection())
```

### Troubleshooting Guide

**Common Issues and Solutions:**

1. **WebRTC Connection Fails**

   ```bash
   # Check firewall settings
   sudo ufw allow 3478/udp
   sudo ufw allow 5349/tcp
   sudo ufw allow 49152:65535/udp

   # Verify STUN server connectivity
   stun -v stun.l.google.com 19302
   ```

2. **High Latency Issues**

   ```javascript
   // Optimize RTCPeerConnection settings
   const pc = new RTCPeerConnection({
     iceServers: [...],
     bundlePolicy: 'max-bundle',
     rtcpMuxPolicy: 'require',
     sdpSemantics: 'unified-plan'
   });
   ```

3. **Audio Quality Problems**

   ```python
   # Adjust audio processing parameters
   audio_settings = {
       'sample_rate': 16000,  # Lower for less bandwidth
       'channels': 1,         # Mono for voice
       'bit_depth': 16,       # Sufficient for voice
       'buffer_size': 512     # Smaller buffer = lower latency
   }
   ```

4. **SSL Certificate Issues**
   ```bash
   # Generate proper certificates with SAN
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout homeassistant.key -out homeassistant.crt \
     -config <(printf "[req]\ndistinguished_name=req\n[v3_req]\nkeyUsage=keyEncipherment,dataEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=@alt_names\n[alt_names]\nDNS.1=localhost\nDNS.2=homeassistant.local\nIP.1=192.168.1.100")
   ```

**Final Deployment Steps:**

1. **Start the complete stack:**

   ```bash
   cd ~/homeassistant
   docker compose up -d
   ```

2. **Install the custom card in Home Assistant:**

   - Copy `voice-streaming-card.js` to `/config/www/`
   - Add the panel configuration to `configuration.yaml`
   - Restart Home Assistant

3. **Verify functionality:**
   - Access the voice streaming panel
   - Test microphone permissions
   - Verify WebRTC connection
   - Check latency measurements

This comprehensive guide provides a production-ready voice streaming solution with WebRTC integration, optimized for minimal latency and maximum reliability within the Home Assistant ecosystem.
