// Voice Streaming Card for Home Assistant - Dashboard Version
// This card provides a UI for real-time voice streaming using WebRTC
// Designed to be used directly in dashboards, not just panels

(function () {
  'use strict';

  // Check if already loaded to prevent duplicate registration
  if (customElements.get('voice-streaming-card')) {
    console.log('Voice streaming card already defined');
    return;
  }

  // Define the custom element
  class VoiceStreamingCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.isRecording = false;
      this.connectionStatus = 'disconnected';
      this.latency = 0;
      this.audioLevel = 0;
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
      // Don't initialize WebRTC automatically - wait for user action
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
          
          .record-button {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: none;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
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
          
          .record-button.connecting {
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
          <h2>Voice Streaming</h2>
          
          <div class="controls">
            <button 
              class="record-button inactive"
              id="recordButton"
            >
              🎤
            </button>
            
            <div class="status">
              <div>Status: <span id="statusText">disconnected</span></div>
              <div class="latency-indicator latency-low">
                Latency: <span id="latencyText">0</span>ms
              </div>
            </div>
          </div>
          
          <div class="error" id="errorMessage"></div>
          
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
      this.shadowRoot.getElementById('recordButton').addEventListener('click', () => {
        this.toggleRecording();
      });
      
      // Initialize canvas
      this.canvas = this.shadowRoot.querySelector('canvas');
      this.canvasContext = this.canvas.getContext('2d');
    }

    // Initialize WebRTC - only called when user clicks button
    async initializeWebRTC() {
      if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
        return; // Already connected or connecting
      }
      
      try {
        this.updateStatus('connecting');
        
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

        // For now, just set as connected without WebSocket (since we're fixing the dashboard version)
        this.updateStatus('connected');
        this.errorMessage = '';
        
      } catch (error) {
        console.error('Error initializing WebRTC:', error);
        this.updateStatus('error');
        this.errorMessage = `Error: ${error.message}`;
        
        // Attempt to reconnect if we haven't exceeded max attempts
        if (this.connectionAttempts < this.maxReconnectAttempts) {
          this.connectionAttempts++;
          setTimeout(() => {
            // Don't auto-reconnect, wait for user action
            this.updateStatus('disconnected');
          }, 2000);
        }
      }
    }

    // Toggle recording
    async toggleRecording() {
      if (this.isRecording) {
        await this.stopRecording();
      } else {
        // First initialize if not already connected
        if (this.connectionStatus !== 'connected') {
          await this.initializeWebRTC();
        }
        
        if (this.connectionStatus === 'connected') {
          await this.startRecording();
        }
      }
    }

    // Start recording
    async startRecording() {
      if (this.connectionStatus !== 'connected') {
        this.errorMessage = 'Not connected to server';
        this.updateError();
        return;
      }
      
      try {
        this.updateStatus('connecting');
        
        // Create RTCPeerConnection with minimal latency settings
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
          if (event.candidate) {
            // Don't send to WebSocket since we're not connecting in dashboard version
            console.log('ICE candidate generated:', event.candidate);
          }
        };

        // For now, just simulate starting recording without WebSocket connection
        console.log('Would start recording if connected to backend');
        
        this.isRecording = true;
        this.updateStatus('connected');
        this.errorMessage = '';
        this.updateRecordButton();
        
      } catch (error) {
        console.error('Error starting recording:', error);
        this.updateStatus('error');
        this.errorMessage = `Error starting recording: ${error.message}`;
        this.updateError();
      }
    }

    // Stop recording
    async stopRecording() {
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
        this.analyzer = null;
      }

      // Don't send stop message since we're not connected to WebSocket
      console.log('Would send stop message if connected to backend');

      this.isRecording = false;
      this.updateRecordButton();
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
        
        // Calculate audio level
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        this.audioLevel = average;
      };
      
      draw();
    }

    // Update latency
    updateLatency(serverTimestamp) {
      const now = Date.now();
      this.latency = now - (serverTimestamp * 1000);
      this.shadowRoot.getElementById('latencyText').textContent = this.latency;
      
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
      
      // Update record button
      this.updateRecordButton();
    }

    // Update record button
    updateRecordButton() {
      const button = this.shadowRoot.getElementById('recordButton');
      if (button) {
        button.className = 'record-button ' + this.getButtonClass();
        button.textContent = this.isRecording ? '🛑' : '🎤';
      }
    }

    // Get button class
    getButtonClass() {
      if (this.isRecording) return 'active';
      if (this.connectionStatus === 'connecting') return 'connecting';
      return 'inactive';
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
    description: 'Real-time voice streaming with WebRTC',
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
  
  console.log('Voice streaming card registered for dashboard use');
})();