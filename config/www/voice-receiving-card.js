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
      this.isWatching = false; // Flag to track if we're watching for streams
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
          
          .watch-button {
            width: 120px;
            height: 40px;
            border-radius: 4px;
            border: none;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
            background: #9c27b0;
            color: white;
          }
          
          .watch-button:hover {
            opacity: 0.8;
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
            
            <button 
              class="watch-button"
              id="watchButton"
            >
              ${this.isWatching ? 'Stop Watching' : 'Watch Streams'}
            </button>
            
            <div class="status">
              <div>Status: <span id="statusText">${this.connectionStatus}</span></div>
              ${this.selectedStream ? 
                `<div>Stream: ${this.selectedStream.substring(0, 20)}...</div>` : 
                '<div>No stream selected</div>'
              }
              <div class="latency-indicator ${this.getLatencyClass()}">
                Latency: <span id="latencyText">${this.latency}</span>ms
              </div>
            </div>
          </div>
          
          <div class="error" id="errorMessage">${this.errorMessage}</div>
          
          <div class="stream-list" id="streamList" style="display: none;">
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
      
      this.shadowRoot.getElementById('watchButton').addEventListener('click', () => {
        if (this.isWatching) {
          this.stopWatching();
        } else {
          this.startWatching();
        }
        this.render(); // Re-render to update button text
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

    // Automatically connect and fetch available streams
    async autoConnect() {
      try {
        await this.connectWebSocket();
        // Wait a bit to ensure WebSocket is fully connected
        await new Promise(resolve => setTimeout(resolve, 500));
        // Request list of available streams
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({
            type: 'get_available_streams'
          }));
        }
      } catch (error) {
        console.error('Error in autoConnect:', error);
      }
    }

    // Start watching for streams (this is when we want to start automatically receiving)
    async startWatching() {
      this.isWatching = true;
      // Automatically connect and start watching for streams
      await this.autoConnect();
      
      // Also set up a periodic check for streams
      this.watchInterval = setInterval(() => {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({
            type: 'get_available_streams'
          }));
        }
      }, 5000); // Check every 5 seconds
      
      // Re-render to update UI
      this.render();
    }

    // Stop watching for streams
    stopWatching() {
      this.isWatching = false;
      if (this.watchInterval) {
        clearInterval(this.watchInterval);
        this.watchInterval = null;
      }
      // Re-render to update UI
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
            if (this.connectionStatus !== 'error') {
              this.updateStatus('disconnected');
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
        case 'available_streams':
          this.availableStreams = data.streams;
          this.render();
          // If we're watching and there are streams available, automatically start receiving
          if (this.isWatching && this.availableStreams.length > 0 && !this.selectedStream && !this.isActive) {
            this.selectedStream = this.availableStreams[0];
            setTimeout(() => {
              this.startReceiving();
            }, 500); // Small delay to ensure UI is updated
          }
          break;
          
        case 'stream_available':
          // Add to available streams if not already there
          if (!this.availableStreams.includes(data.stream_id)) {
            this.availableStreams.push(data.stream_id);
            this.render();
            // If we're watching and this is the first stream, automatically start receiving
            if (this.isWatching && this.availableStreams.length === 1 && !this.selectedStream && !this.isActive) {
              this.selectedStream = data.stream_id;
              setTimeout(() => {
                this.startReceiving();
              }, 500); // Small delay to ensure UI is updated
            }
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
        // If we're not watching yet, start watching
        if (!this.isWatching) {
          await this.startWatching();
        }
        // If no streams available, try to fetch them again
        if (this.availableStreams.length === 0 && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify({
            type: 'get_available_streams'
          }));
          // Wait a bit for the streams to be fetched
          await new Promise(resolve => setTimeout(resolve, 500));
        }
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
        
        // If still no stream selected, wait a bit and try again
        if (!this.selectedStream) {
          // This might happen if the stream list hasn't been updated yet
          console.log('No stream selected, waiting for streams...');
          return;
        }
        
        // If we're already receiving this stream, just return
        if (this.isActive) {
          return;
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

    // Disconnected callback
    disconnectedCallback() {
      // Clean up watching interval if it exists
      this.stopWatching();
      
      // Clean up WebSocket connection
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      // Clean up peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
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