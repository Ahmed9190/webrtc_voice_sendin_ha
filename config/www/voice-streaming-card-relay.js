// Voice Streaming Card for Home Assistant with Send/Receive Modes
// This card provides a UI for real-time voice streaming using WebRTC

(function () {
  'use strict';

  // Define the custom element
  class VoiceStreamingCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.mode = 'send'; // 'send' or 'receive'
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
      this.availableStreams = [];
      this.selectedStream = null;
      this.audioElement = null;
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
      // Don't initialize WebRTC automatically - wait for user action
      setTimeout(() => {
        this.audioElement = this.shadowRoot.querySelector('audio');
        // Just set initial state, don't connect yet
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
          
          .mode-selector {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
          }
          
          .mode-button {
            flex: 1;
            padding: 8px 16px;
            border: 2px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            text-align: center;
            font-weight: bold;
          }
          
          .mode-button.active {
            background: var(--primary-color, #03a9f4);
            color: white;
            border-color: var(--primary-color, #03a9f4);
          }
          
          .controls {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
          }
          
          .action-button {
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
          
          .receive-button.inactive {
            background: #2196f3;
            color: white;
          }
          
          .receive-button.active {
            background: #4caf50;
            color: white;
            animation: pulse 1.5s infinite;
          }
          
          .action-button.connecting {
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
        </style>
        
        <div class="card-content">
          <h2>Voice Streaming</h2>
          
          <div class="mode-selector">
            <button 
              class="mode-button ${this.mode === 'send' ? 'active' : ''}"
              id="sendModeButton"
            >
              📱 Send Voice
            </button>
            <button 
              class="mode-button ${this.mode === 'receive' ? 'active' : ''}"
              id="receiveModeButton"
            >
              🎧 Receive Voice
            </button>
          </div>
          
          <div class="controls">
            ${this.mode === 'send' ? `
              <button 
                class="action-button send-button ${this.isActive ? 'active' : 'inactive'}"
                id="actionButton"
              >
                ${this.isActive ? '🛑' : '🎤'}
              </button>
            ` : `
              <button 
                class="action-button receive-button ${this.isActive ? 'active' : 'inactive'}"
                id="actionButton"
              >
                ${this.isActive ? '🔊' : '🎧'}
              </button>
            `}
            
            <div class="status">
              <div>Status: <span id="statusText">${this.connectionStatus}</span></div>
              <div class="latency-indicator latency-low">
                Latency: <span id="latencyText">${this.latency}</span>ms
              </div>
            </div>
          </div>
          
          <div class="error" id="errorMessage">${this.errorMessage}</div>
          
          ${this.mode === 'receive' ? `
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
            
            <audio controls autoplay></audio>
          ` : ''}
          
          ${this.mode === 'send' ? `
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
          ` : ''}
        </div>
      `;
      
      // Add event listeners
      this.shadowRoot.getElementById('sendModeButton').addEventListener('click', () => {
        this.setMode('send');
      });
      
      this.shadowRoot.getElementById('receiveModeButton').addEventListener('click', () => {
        this.setMode('receive');
      });
      
      this.shadowRoot.getElementById('actionButton').addEventListener('click', () => {
        this.toggleActivity();
      });
      
      // Add stream selection listeners if in receive mode
      if (this.mode === 'receive') {
        const streamItems = this.shadowRoot.querySelectorAll('.stream-item');
        streamItems.forEach(item => {
          item.addEventListener('click', (e) => {
            const streamId = e.currentTarget.getAttribute('data-stream-id');
            this.selectStream(streamId);
          });
        });
      }
      
      // Initialize canvas if in send mode
      if (this.mode === 'send') {
        this.canvas = this.shadowRoot.querySelector('canvas');
        if (this.canvas) {
          this.canvasContext = this.canvas.getContext('2d');
        }
      }
    }

    // Set mode (send/receive)
    setMode(mode) {
      if (this.isActive) {
        this.stopActivity();
      }
      this.mode = mode;
      // Disconnect when switching modes
      if (this.connectionStatus === 'connected') {
        this.disconnectWebSocket();
      }
      this.render();
    }

    // Select stream for receiving
    selectStream(streamId) {
      this.selectedStream = streamId;
      this.render();
    }

    // Initialize WebRTC - only called when user clicks button
    async initializeWebRTC() {
      try {
        // Connect to WebSocket
        await this.connectWebSocket();
        
        this.updateStatus('connected');
        this.errorMessage = '';
        
        // If in send mode, request microphone permission
        if (this.mode === 'send') {
          try {
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
          } catch (error) {
            console.error('Error getting microphone access:', error);
            this.errorMessage = `Microphone error: ${error.message}`;
            this.updateError();
          }
        }
      } catch (error) {
        console.error('Error initializing WebRTC:', error);
        this.updateStatus('error');
        this.errorMessage = `Connection error: ${error.message}`;
        this.updateError();
      }
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
                    this.stopActivity();
                    this.startActivity();
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
          if (this.peerConnection && this.mode === 'send') {
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
          
        case 'webrtc_offer':
          if (this.peerConnection) {
            // Set remote description
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.offer)
            );
            
            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
              this.websocket.send(JSON.stringify({
                type: 'webrtc_answer',
                answer: {
                  sdp: this.peerConnection.localDescription.sdp,
                  type: this.peerConnection.localDescription.type
                }
              }));
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
          
        case 'available_streams':
          this.availableStreams = data.streams;
          if (this.mode === 'receive') {
            this.render();
          }
          break;
          
        case 'stream_available':
          // Add to available streams if not already there
          if (!this.availableStreams.includes(data.stream_id)) {
            this.availableStreams.push(data.stream_id);
          }
          if (this.mode === 'receive') {
            this.render();
          }
          break;
          
        case 'stream_ended':
          // Remove from available streams
          this.availableStreams = this.availableStreams.filter(
            id => id !== data.stream_id
          );
          // If we were listening to this stream, stop
          if (this.selectedStream === data.stream_id) {
            this.selectedStream = null;
            this.stopActivity();
          }
          if (this.mode === 'receive') {
            this.render();
          }
          break;
          
        case 'audio_data':
          // Handle processed audio data from server
          this.updateLatency(data.timestamp);
          break;
      }
    }

    // Toggle activity (start/stop streaming)
    async toggleActivity() {
      if (this.isActive) {
        await this.stopActivity();
      } else {
        await this.startActivity();
      }
    }

    // Start activity based on mode
    async startActivity() {
      try {
        this.updateStatus('connecting');
        
        // First connect if not already connected
        if (this.connectionStatus !== 'connected') {
          await this.initializeWebRTC();
        }
        
        if (this.mode === 'send') {
          await this.startSending();
        } else {
          await this.startReceiving();
        }
        
        this.isActive = true;
        this.updateStatus('connected');
        this.errorMessage = '';
        this.render();
        
      } catch (error) {
        console.error('Error starting activity:', error);
        this.updateStatus('error');
        this.errorMessage = `Error starting: ${error.message}`;
        this.updateError();
      }
    }

    // Start sending audio
    async startSending() {
      try {
        // First connect WebSocket if not already connected
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
          await this.connectWebSocket();
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

        // Add audio track
        if (this.mediaStream) {
          this.mediaStream.getAudioTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.mediaStream);
          });
        }

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
        
        console.log('Starting audio sending process');
      } catch (error) {
        console.error('Error starting sending:', error);
        this.updateStatus('error');
        this.errorMessage = `Error starting sending: ${error.message}`;
        this.updateError();
      }
    }

    // Start receiving audio
    async startReceiving() {
      try {
        // First connect WebSocket if not already connected
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
          await this.connectWebSocket();
        }
        
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
            this.audioElement.play().catch(e => {
              console.error('Error playing audio:', e);
            });
          }
        };

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

        // Request to start receiving the selected stream
        this.websocket.send(JSON.stringify({
          type: 'start_receiving',
          stream_id: this.selectedStream
        }));
        
        console.log('Starting audio receiving process for stream:', this.selectedStream);
      } catch (error) {
        console.error('Error starting receiving:', error);
        this.updateStatus('error');
        this.errorMessage = `Error starting receiving: ${error.message}`;
        this.updateError();
      }
    }

    // Stop activity
    async stopActivity() {
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      if (this.audioElement) {
        this.audioElement.srcObject = null;
      }

      // Send stop message to backend
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'stop_stream'
        }));
      }

      this.isActive = false;
      // Keep connection status as connected
      this.updateStatus('connected');
      this.render();
    }

    // Disconnect from WebSocket
    async disconnectWebSocket() {
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      this.updateStatus('disconnected');
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
  customElements.define('voice-streaming-card', VoiceStreamingCard);

  // Register with Home Assistant
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'voice-streaming-card',
    name: 'Voice Streaming Card',
    description: 'Real-time voice streaming with WebRTC - Send and Receive modes',
    preview: false,
    documentationURL: ''
  });

  // For panel custom integration
  if (!window.HASS_VOICE_STREAMING_CARD) {
    window.HASS_VOICE_STREAMING_CARD = VoiceStreamingCard;
  }

  // Export for module usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceStreamingCard;
  }
})();