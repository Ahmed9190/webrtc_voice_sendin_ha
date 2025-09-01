// Voice Sending Card for Home Assistant
// This card provides a UI for sending real-time voice streams using WebRTC

(function () {
  'use strict';

  // Define the custom element
  class VoiceSendingCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.isActive = false;
      this.connectionStatus = 'disconnected';
      this.latency = 0;
      this.errorMessage = '';
      this.mediaStream = null;
      this.peerConnection = null;
      this.websocket = null;
      this.audioContext = null;
      this.analyzer = null;
      this.canvas = null;
      this.canvasContext = null;
      this.connectionAttempts = 0;
      this.maxReconnectAttempts = 3;
      this.hass = null;
      this.config = {};
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
          
          .send-button {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: none;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
          }
          
          .send-button.inactive {
            background: #f44336;
            color: white;
          }
          
          .send-button.active {
            background: #4caf50;
            color: white;
            animation: pulse 1.5s infinite;
          }
          
          .send-button.connecting {
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
          
          .waveform {
            height: 100px;
            width: 100%;
            background: #f0f0f0;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
            margin-bottom: 16px;
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
          
          .error {
            color: #f44336;
            font-weight: bold;
            margin-top: 8px;
          }
        </style>
        
        <div class="card-content">
          <h2>Voice Sending</h2>
          
          <div class="controls">
            <button 
              class="send-button ${this.isActive ? 'active' : 'inactive'}"
              id="sendButton"
            >
              ${this.isActive ? '🛑' : '🎤'}
            </button>
            
            <div class="status">
              <div>Status: <span id="statusText">${this.connectionStatus}</span></div>
              <div class="latency-indicator ${this.getLatencyClass()}">
                Latency: <span id="latencyText">${this.latency}</span>ms
              </div>
            </div>
          </div>
          
          <div class="error" id="errorMessage">${this.errorMessage}</div>
          
          <div class="waveform">
            <canvas width="400" height="100"></canvas>
          </div>
          
          <div class="settings">
            <div class="setting-row">
              <label>Noise Suppression:</label>
              <input type="checkbox" id="noiseSuppression" checked>
            </div>
            <div class="setting-row">
              <label>Echo Cancellation:</label>
              <input type="checkbox" id="echoCancellation" checked>
            </div>
            <div class="setting-row">
              <label>Auto Gain Control:</label>
              <input type="checkbox" id="autoGainControl" checked>
            </div>
          </div>
        </div>
      `;
      
      // Add event listeners
      this.shadowRoot.getElementById('sendButton').addEventListener('click', () => {
        this.toggleSending();
      });
      
      // Initialize canvas
      this.canvas = this.shadowRoot.querySelector('canvas');
      if (this.canvas) {
        this.canvasContext = this.canvas.getContext('2d');
      }
    }

    // Toggle sending
    async toggleSending() {
      if (this.isActive) {
        await this.stopSending();
      } else {
        await this.startSending();
      }
    }

    // Start sending audio
    async startSending() {
      try {
        this.updateStatus('connecting');
        
        // First connect WebSocket if not already connected
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
          await this.connectWebSocket();
        }
        
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

        // Add audio track
        this.mediaStream.getAudioTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.mediaStream);
        });

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
              type: 'ice_candidate',
              candidate: event.candidate
            }));
          }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', this.peerConnection.iceConnectionState);
          if (this.peerConnection.iceConnectionState === 'failed' || 
              this.peerConnection.iceConnectionState === 'disconnected') {
            console.log('ICE connection failed or disconnected');
            this.updateStatus('error');
            this.errorMessage = 'Connection failed';
            this.updateError();
          }
        };

        // Notify backend that we want to start sending
        this.websocket.send(JSON.stringify({
          type: 'start_sending'
        }));
        
        this.isActive = true;
        this.updateStatus('connected');
        this.errorMessage = '';
        this.render();
        
      } catch (error) {
        console.error('Error starting sending:', error);
        this.updateStatus('error');
        this.errorMessage = `Error starting sending: ${error.message}`;
        this.updateError();
      }
    }

    // Stop sending
    async stopSending() {
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      if (this.analyzer) {
        this.analyzer = null;
      }

      // Send stop message to backend
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'stop_stream'
        }));
      }

      this.isActive = false;
      this.updateStatus('connected'); // Keep connection status as connected
      this.render();
    }

    // Connect to WebSocket
    async connectWebSocket() {
      return new Promise((resolve, reject) => {
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${window.location.host}/api/voice-streaming/ws`;
          
          this.websocket = new WebSocket(wsUrl);
          
          this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.connectionAttempts = 0;
            resolve();
          };
          
          this.websocket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            await this.handleWebSocketMessage(data);
          };
          
          this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            reject(error);
          };
          
          this.websocket.onclose = () => {
            console.log('WebSocket closed');
            // Attempt to reconnect if we haven't exceeded max attempts
            if (this.connectionAttempts < this.maxReconnectAttempts) {
              this.connectionAttempts++;
              setTimeout(() => {
                this.connectWebSocket().then(() => {
                  // Reinitialize after reconnect
                  if (this.isActive) {
                    this.stopSending();
                    this.startSending();
                  }
                }).catch(e => {
                  console.error('Reconnect failed:', e);
                });
              }, 2000);
            }
          };
        } catch (error) {
          console.error('Error connecting to WebSocket:', error);
          reject(error);
        }
      });
    }

    // Handle WebSocket messages
    async handleWebSocketMessage(data) {
      switch (data.type) {
        case 'sender_ready':
          console.log('Sender ready');
          // Create offer now that we're ready to send
          if (this.peerConnection) {
            try {
              // Wait a bit for the peer connection to be fully set up
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
              });
              
              await this.peerConnection.setLocalDescription(offer);
              
              if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify({
                  type: 'webrtc_offer',
                  offer: {
                    sdp: this.peerConnection.localDescription.sdp,
                    type: this.peerConnection.localDescription.type
                  }
                }));
              }
            } catch (error) {
              console.error('Error creating offer:', error);
              this.updateStatus('error');
              this.errorMessage = `Error creating offer: ${error.message}`;
              this.updateError();
            }
          }
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

    // Start audio visualization
    startAudioVisualization() {
      if (!this.analyzer || !this.canvasContext) return;
      
      const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
      
      const draw = () => {
        requestAnimationFrame(draw);
        
        if (!this.analyzer) return;
        
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
      };
      
      draw();
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
      const button = this.shadowRoot.getElementById('sendButton');
      if (button) {
        if (this.isActive) {
          button.className = 'send-button active';
        } else if (this.connectionStatus === 'connecting') {
          button.className = 'send-button connecting';
        } else {
          button.className = 'send-button inactive';
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
  customElements.define('voice-sending-card', VoiceSendingCard);

  // Register with Home Assistant
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'voice-sending-card',
    name: 'Voice Sending Card',
    description: 'Real-time voice sending with WebRTC',
    preview: false,
    documentationURL: ''
  });

  // For panel custom integration
  if (!window.HASS_VOICE_SENDING_CARD) {
    window.HASS_VOICE_SENDING_CARD = VoiceSendingCard;
  }

  // Export for module usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceSendingCard;
  }
})();