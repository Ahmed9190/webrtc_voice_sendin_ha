// Voice Receiving Card for Home Assistant
// This card provides a UI for receiving real-time voice streams using WebRTC

(function () {
  'use strict';

  // Define the custom element
  class VoiceReceivingCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.isActive = false;
      this.connectionStatus = 'disconnected';
      this.latency = 0;
      this.errorMessage = '';
      this.peerConnection = null;
      this.websocket = null;
      this.audioContext = null;
      this.canvas = null;
      this.canvasContext = null;
      this.connectionAttempts = 0;
      this.maxReconnectAttempts = 3;
      this.hass = null;
      this.config = {};
      this.availableStreams = [];
      this.selectedStream = null;
      this.audioElement = null;
      this.audioBuffer = [];
    }

    // Set hass object
    setHass(hass) {
      this.hass = hass;
    }

    // Set configuration
    setConfig(config) {
      this.config = config;
    }

    // Get card size
    getCardSize() {
      return 3;
    }

    // Connected callback
    connectedCallback() {
      this.render();
      setTimeout(() => {
        this.audioElement = this.shadowRoot.querySelector('audio');
        this.updateStatus('disconnected');
      }, 100);
    }

    // Render the UI
    render() {
      this.shadowRoot.innerHTML = `
        <style>
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
          
          .receive-button {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: none;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
          }
          
          .receive-button.inactive {
            background: #2196f3;
            color: white;
          }
          
          .receive-button.active {
            background: #4caf50;
            color: white;
            animation: pulse 1.5s infinite;
          }
          
          .receive-button.connecting {
            background: #ff9800;
            color: white;
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
          
          .stream-list {
            margin-top: 16px;
            max-height: 200px;
            overflow-y: auto;
          }
          
          .stream-item {
            padding: 8px;
            margin: 4px 0;
            background: var(--secondary-background-color, #f5f5f5);
            border-radius: 4px;
            cursor: pointer;
          }
          
          .stream-item:hover {
            background: var(--primary-color, #e3f2fd);
          }
          
          .stream-item.active {
            background: var(--primary-color, #bbdefb);
            border: 2px solid var(--primary-color, #2196f3);
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
          
          .error {
            color: #f44336;
            font-weight: bold;
            margin-top: 8px;
          }
          
          audio {
            width: 100%;
            margin-top: 16px;
          }
          
          .visualization {
            height: 100px;
            width: 100%;
            background: #f0f0f0;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
            margin-bottom: 16px;
          }
          
          .visualization canvas {
            width: 100%;
            height: 100%;
          }
        </style>
        
        <div class="card-content">
          <h2>Voice Receiving</h2>
          
          <div class="controls">
            <button 
              class="receive-button ${this.isActive ? 'active' : 'inactive'}"
              id="receiveButton"
            >
              ${this.isActive ? '🔊' : '🎧'}
            </button>
            
            <div class="status">
              <div>Status: <span id="statusText">${this.connectionStatus}</span></div>
              <div class="latency-indicator ${this.getLatencyClass()}">
                Latency: <span id="latencyText">${this.latency}</span>ms
              </div>
            </div>
          </div>
          
          <div class="error" id="errorMessage">${this.errorMessage}</div>
          
          <div class="stream-list" id="streamList">
            <h3>Available Streams:</h3>
            ${this.availableStreams.length > 0 ? 
              this.availableStreams.map(streamId => `
                <div 
                  class="stream-item ${this.selectedStream === streamId ? 'active' : ''}"
                  data-stream-id="${streamId}"
                >
                  Stream: ${streamId.substring(0, 20)}...
                </div>
              `).join('') : 
              '<div>No streams available</div>'
            }
          </div>
          
          <div class="visualization">
            <canvas width="400" height="100"></canvas>
          </div>
          
          <audio controls autoplay></audio>
          
          <div class="settings">
            <div class="setting-row">
              <label>Auto Play:</label>
              <input type="checkbox" id="autoPlay" checked>
            </div>
            <div class="setting-row">
              <label>Volume Boost:</label>
              <input type="range" id="volumeBoost" min="0" max="200" value="100">
            </div>
          </div>
        </div>
      `;
      
      // Add event listeners
      this.shadowRoot.getElementById('receiveButton').addEventListener('click', () => {
        this.toggleReceiving();
      });
      
      // Add stream selection listeners
      const streamItems = this.shadowRoot.querySelectorAll('.stream-item');
      streamItems.forEach(item => {
        item.addEventListener('click', (e) => {
          const streamId = e.currentTarget.getAttribute('data-stream-id');
          this.selectStream(streamId);
        });
      });
      
      // Initialize canvas
      this.canvas = this.shadowRoot.querySelector('canvas');
      if (this.canvas) {
        this.canvasContext = this.canvas.getContext('2d');
      }
    }

    // Select stream for receiving
    selectStream(streamId) {
      this.selectedStream = streamId;
      this.render();
    }

    // Connect to WebSocket
    async connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/voice-streaming/ws`;
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected for voice receiving');
        this.connectionAttempts = 0;
        this.updateStatus('connected');
        this.errorMessage = '';
        
        // Request list of available streams
        this.websocket.send(JSON.stringify({
          type: 'get_available_streams'
        }));
      };
      
      this.websocket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        await this.handleWebSocketMessage(data);
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateStatus('error');
        this.errorMessage = 'WebSocket connection error';
      };
      
      this.websocket.onclose = () => {
        console.log('WebSocket closed');
        if (this.connectionStatus !== 'error') {
          this.updateStatus('disconnected');
        }
      };
    }

    // Handle WebSocket messages
    async handleWebSocketMessage(data) {
      switch (data.type) {
        case 'available_streams':
          this.availableStreams = data.streams;
          this.render();
          break;
          
        case 'stream_available':
          // Add to available streams if not already there
          if (!this.availableStreams.includes(data.stream_id)) {
            this.availableStreams.push(data.stream_id);
          }
          this.render();
          break;
          
        case 'stream_ended':
          // Remove from available streams
          this.availableStreams = this.availableStreams.filter(
            id => id !== data.stream_id
          );
          // If we were listening to this stream, stop
          if (this.selectedStream === data.stream_id) {
            this.selectedStream = null;
            this.stopReceiving();
          }
          this.render();
          break;
          
        case 'webrtc_offer':
          if (this.peerConnection) {
            // Set remote description
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.offer)
            );
            
            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.websocket.send(JSON.stringify({
              type: 'webrtc_answer',
              answer: {
                sdp: this.peerConnection.localDescription.sdp,
                type: this.peerConnection.localDescription.type
              }
            }));
          }
          break;
          
        case 'audio_data':
          // Handle processed audio data from server
          this.updateLatency(data.timestamp);
          break;
      }
    }

    // Toggle receiving
    async toggleReceiving() {
      if (this.isActive) {
        await this.stopReceiving();
      } else {
        await this.startReceiving();
      }
    }

    // Start receiving audio
    async startReceiving() {
      try {
        this.updateStatus('connecting');
        
        // First connect WebSocket if not already connected
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
          await this.connectWebSocket();
        }
        
        // Check if we have a selected stream
        if (!this.selectedStream && this.availableStreams.length > 0) {
          this.selectedStream = this.availableStreams[0];
        }
        
        if (!this.selectedStream) {
          throw new Error('No stream selected');
        }
        
        // Create RTCPeerConnection with optimized settings
        this.peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ],
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          sdpSemantics: 'unified-plan',
          iceCandidatePoolSize: 10
        });

        // Handle received audio track
        this.peerConnection.ontrack = (event) => {
          console.log('Received remote audio track');
          if (event.streams && event.streams[0]) {
            this.audioElement.srcObject = event.streams[0];
            
            // Set up audio visualization
            this.setupAudioVisualization(event.streams[0]);
            
            // Auto play if enabled
            const autoPlay = this.shadowRoot.getElementById('autoPlay');
            if (autoPlay && autoPlay.checked) {
              this.audioElement.play().catch(e => {
                console.error('Error playing audio:', e);
                this.errorMessage = `Error playing audio: ${e.message}`;
                this.updateError();
              });
            }
          }
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.websocket.send(JSON.stringify({
              type: 'ice_candidate',
              candidate: event.candidate
            }));
          }
        };

        // Request to join the selected stream
        this.websocket.send(JSON.stringify({
          type: 'start_receiving',
          stream_id: this.selectedStream
        }));

        this.isActive = true;
        this.updateStatus('connected');
        this.errorMessage = '';
        this.render();
        
      } catch (error) {
        console.error('Error starting receiving:', error);
        this.updateStatus('error');
        this.errorMessage = `Error starting: ${error.message}`;
        this.updateError();
      }
    }

    // Set up audio visualization
    setupAudioVisualization(stream) {
      try {
        // Create audio context and analyzer
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyzer = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(analyzer);
        
        analyzer.fftSize = 256;
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        
        // Start visualization loop
        const draw = () => {
          requestAnimationFrame(draw);
          
          if (!analyzer || !this.canvasContext) return;
          
          analyzer.getByteFrequencyData(dataArray);
          
          this.canvasContext.fillStyle = '#f0f0f0';
          this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
          
          const barWidth = (this.canvas.width / dataArray.length) * 2.5;
          let barHeight;
          let x = 0;
          
          for (let i = 0; i < dataArray.length; i++) {
            barHeight = (dataArray[i] / 255) * this.canvas.height;
            
            // Create a gradient effect based on frequency
            const hue = (i / dataArray.length) * 360;
            this.canvasContext.fillStyle = `hsl(${hue}, 100%, 50%)`;
            this.canvasContext.fillRect(x, this.canvas.height - barHeight / 2, 
                                       barWidth, barHeight);
            
            x += barWidth + 1;
          }
        };
        
        draw();
      } catch (e) {
        console.error('Error setting up audio visualization:', e);
      }
    }

    // Stop receiving
    async stopReceiving() {
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      if (this.audioElement) {
        this.audioElement.srcObject = null;
      }

      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'leave_stream',
          stream_id: this.selectedStream
        }));
      }

      this.isActive = false;
      this.updateStatus('connected'); // Keep connection status as connected
      this.render();
    }

    // Update latency
    updateLatency(serverTimestamp) {
      const now = Date.now();
      this.latency = now - (serverTimestamp * 1000);
      const latencyText = this.shadowRoot.getElementById('latencyText');
      if (latencyText) {
        latencyText.textContent = this.latency;
      }
      
      // Update latency indicator class
      const latencyIndicator = this.shadowRoot.querySelector('.latency-indicator');
      if (latencyIndicator) {
        latencyIndicator.className = 'latency-indicator ' + this.getLatencyClass();
      }
    }

    // Get latency class
    getLatencyClass() {
      if (this.latency < 50) return 'latency-low';
      if (this.latency < 150) return 'latency-medium';
      return 'latency-high';
    }

    // Update status
    updateStatus(status) {
      this.connectionStatus = status;
      const statusText = this.shadowRoot.getElementById('statusText');
      if (statusText) {
        statusText.textContent = status;
      }
      
      // Update button
      const button = this.shadowRoot.getElementById('receiveButton');
      if (button) {
        if (this.isActive) {
          button.className = 'receive-button active';
        } else if (this.connectionStatus === 'connecting') {
          button.className = 'receive-button connecting';
        } else {
          button.className = 'receive-button inactive';
        }
      }
    }

    // Update error message
    updateError() {
      const errorElement = this.shadowRoot.getElementById('errorMessage');
      if (errorElement) {
        errorElement.textContent = this.errorMessage;
      }
    }
  }

  // Define the custom element
  customElements.define('voice-receiving-card', VoiceReceivingCard);

  // Register with Home Assistant
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'voice-receiving-card',
    name: 'Voice Receiving Card',
    description: 'Real-time voice receiving with WebRTC',
    preview: false,
    documentationURL: ''
  });

  // For panel custom integration
  if (!window.HASS_VOICE_RECEIVING_CARD) {
    window.HASS_VOICE_RECEIVING_CARD = VoiceReceivingCard;
  }

  // Export for module usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceReceivingCard;
  }
})();