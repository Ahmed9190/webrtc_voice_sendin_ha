import { LitElement, html, css } from 'lit';

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
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
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
    
    .latency-low { background: #4caf50; color: white; }
    .latency-medium { background: #ff9800; color: white; }
    .latency-high { background: #f44336; color: white; }
  `;

  static properties = {
    hass: {},
    config: {},
    isRecording: { type: Boolean },
    connectionStatus: { type: String },
    latency: { type: Number },
    audioLevel: { type: Number }
  };

  constructor() {
    super();
    this.isRecording = false;
    this.connectionStatus = 'disconnected';
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
    this.canvas = this.shadowRoot.querySelector('canvas');
    this.canvasContext = this.canvas.getContext('2d');
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
          channelCount: 1
        }
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
      
      this.connectionStatus = 'connected';
      this.requestUpdate();
      
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      this.connectionStatus = 'error';
      this.requestUpdate();
    }
  }

  async connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/voice-streaming/ws`;
    
    this.websocket = new WebSocket(wsUrl);
    
    this.websocket.onopen = () => {
      console.log('WebSocket connected');
    };
    
    this.websocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      await this.handleWebSocketMessage(data);
    };
    
    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.connectionStatus = 'error';
      this.requestUpdate();
    };
  }

  async handleWebSocketMessage(data) {
    switch (data.type) {
      case 'stream_ready':
        console.log('Stream ready, connection ID:', data.connection_id);
        break;
        
      case 'webrtc_answer':
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        }
        break;
        
      case 'audio_data':
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
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      });

      // Add audio track
      this.mediaStream.getAudioTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.mediaStream);
      });

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.websocket.send(JSON.stringify({
            type: 'ice_candidate',
            candidate: event.candidate
          }));
        }
      };

      // Create and send offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      this.websocket.send(JSON.stringify({
        type: 'webrtc_offer',
        offer: offer
      }));

      this.isRecording = true;
      this.requestUpdate();
      
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }

  async stopRecording() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.websocket.send(JSON.stringify({
      type: 'stop_stream'
    }));

    this.isRecording = false;
    this.requestUpdate();
  }

  startAudioVisualization() {
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    
    const draw = () => {
      requestAnimationFrame(draw);
      
      this.analyzer.getByteFrequencyData(dataArray);
      
      this.canvasContext.fillStyle = '#f0f0f0';
      this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      const barWidth = (this.canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;
      
      for (let i = 0; i < dataArray.length; i++) {
        barHeight = (dataArray[i] / 255) * this.canvas.height;
        
        this.canvasContext.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
        this.canvasContext.fillRect(x, this.canvas.height - barHeight / 2, 
                                   barWidth, barHeight);
        
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
    this.latency = now - (serverTimestamp * 1000);
    this.requestUpdate();
  }

  getLatencyClass() {
    if (this.latency < 50) return 'latency-low';
    if (this.latency < 150) return 'latency-medium';
    return 'latency-high';
  }

  render() {
    return html`
      <div class="card-content">
        <h2>Voice Streaming</h2>
        
        <div class="controls">
          <button 
            class="record-button ${this.isRecording ? 'active' : 'inactive'}"
            @click=${this.toggleRecording}
          >
            ${this.isRecording ? '🛑' : '🎤'}
          </button>
          
          <div class="status">
            <div>Status: ${this.connectionStatus}</div>
            <div class="latency-indicator ${this.getLatencyClass()}">
              Latency: ${this.latency}ms
            </div>
          </div>
        </div>
        
        <div class="waveform">
          <canvas width="400" height="100"></canvas>
        </div>
        
        <div class="settings">
          <div class="setting-row">
            <label>Noise Suppression:</label>
            <input type="checkbox" checked>
          </div>
          <div class="setting-row">
            <label>Echo Cancellation:</label>
            <input type="checkbox" checked>
          </div>
          <div class="setting-row">
            <label>Auto Gain Control:</label>
            <input type="checkbox" checked>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('voice-streaming-card', VoiceStreamingCard);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'voice-streaming-card',
  name: 'Voice Streaming Card',
  description: 'Real-time voice streaming with WebRTC'
});