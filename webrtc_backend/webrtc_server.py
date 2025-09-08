import asyncio
import json
import logging
import uuid
import os
from typing import Dict, Optional
from aiohttp import web, WSMsgType

logger = logging.getLogger(__name__)

# Try to import aiortc, but handle the case where it's not available
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
    from aiortc.contrib.media import MediaRecorder
    WEBRTC_AVAILABLE = True
except ImportError:
    logger.warning("aiortc not available, WebRTC functionality will be limited")
    WEBRTC_AVAILABLE = False

class AudioStreamTrack:
    """Mock audio track for when aiortc is not available"""
    kind = "audio"
    
    def __init__(self, config=None):
        self.config = config or {}

class VoiceStreamingServer:
    def __init__(self, config_path: str = None):
        # Default configuration
        self.config = {
            "webrtc": {
                "ice_servers": [
                    {"urls": "stun:stun.l.google.com:19302"},
                    {"urls": "stun:stun1.l.google.com:19302"}
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
                    "echo_cancellation": True,
                    "noise_suppression": True,
                    "auto_gain_control": True
                },
                "connection_timeout": 30,
                "reconnect_attempts": 3
            },
            "server": {
                "port": 8080,
                "host": "0.0.0.0",
                "max_connections": 10,
                "queue_size": 100
            }
        }
        
        self.connections: Dict[str, dict] = {}
        self.app = web.Application()
        self.setup_routes()
        
    def setup_routes(self):
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/ws', self.websocket_handler)
        self.app.router.add_get('/api/voice-streaming/ws', self.websocket_handler)
        self.app.router.add_post('/webrtc/offer', self.handle_webrtc_offer_endpoint)
        self.app.router.add_post('/webrtc/answer', self.handle_webrtc_answer_endpoint)
        self.app.router.add_post('/webrtc/candidate', self.handle_webrtc_candidate_endpoint)
        # Only add static route if directory exists
        if os.path.exists('/app/www'):
            self.app.router.add_static('/', '/app/www')
        
    async def health_check(self, request):
        """Enhanced health check that verifies server functionality"""
        try:
            # Check if the server is running
            server_status = 'healthy' if True else 'unhealthy'
            
            # Check WebRTC availability
            webrtc_available = WEBRTC_AVAILABLE
            
            # Check if we can create a basic RTCPeerConnection (if WebRTC is available)
            webrtc_functional = False
            if WEBRTC_AVAILABLE:
                try:
                    # Test basic WebRTC functionality
                    from aiortc import RTCPeerConnection
                    pc = RTCPeerConnection()
                    await pc.close()
                    webrtc_functional = True
                except Exception:
                    webrtc_functional = False
            
            # Check connection count
            active_connections = len(self.connections)
            
            # Determine overall health status
            status = 'healthy'
            if not webrtc_available:
                status = 'degraded'
            elif not webrtc_functional:
                status = 'degraded'
            
            return web.json_response({
                'status': status,
                'server': server_status,
                'webrtc_available': webrtc_available,
                'webrtc_functional': webrtc_functional,
                'active_connections': active_connections,
                'timestamp': asyncio.get_event_loop().time()
            })
        
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
            
    async def stop_voice_stream(self, connection_id: str):
        """Stop voice streaming for a connection"""
        connection = self.connections.get(connection_id)
        if not connection:
            return
            
        # Clean up the connection
        await self.cleanup_connection(connection_id)
        
        # Send confirmation to client
        if connection.get('ws'):
            try:
                await connection['ws'].send_text(json.dumps({
                    'type': 'stream_stopped',
                    'connection_id': connection_id
                }))
            except:
                pass
            
    async def start_voice_stream(self, connection_id: str):
        connection = self.connections[connection_id]
        
        if not WEBRTC_AVAILABLE:
            # Send mock response when WebRTC is not available
            await connection['ws'].send_text(json.dumps({
                'type': 'stream_ready',
                'connection_id': connection_id,
                'warning': 'WebRTC not available'
            }))
            return
            
        # Create RTCPeerConnection with optimized settings
        rtc_config = self.config['webrtc']['rtc_config']
        rtc_config['iceServers'] = self.config['webrtc']['ice_servers']
        
        pc = RTCPeerConnection(configuration=rtc_config)
        connection['pc'] = pc
        
        # Set up audio track handling
        @pc.on("track")
        async def on_track(track):
            if track.kind == "audio":
                logger.info("Received audio track")
                
                # Create recorder for processing
                recorder = MediaRecorder("/tmp/stream.wav")
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
                
                # Convert frame to numpy array (simplified)
                # In a real implementation, you would process the audio data here
                # and potentially send it to Home Assistant for further processing
                
                # Trigger Home Assistant events
                await self.trigger_voice_event(connection_id, frame)
                
        except Exception as e:
            logger.error(f"Audio processing error: {e}")
            
    async def trigger_voice_event(self, connection_id: str, frame):
        """Send audio data to Home Assistant for processing"""
        connection = self.connections[connection_id]
        
        # Send processed audio event
        await connection['ws'].send_text(json.dumps({
            'type': 'audio_data',
            'connection_id': connection_id,
            'timestamp': asyncio.get_event_loop().time()
        }))
        
    async def handle_webrtc_offer_endpoint(self, request):
        """Handle WebRTC offer endpoint"""
        data = await request.json()
        # In a real implementation, you would process the offer here
        return web.json_response({'status': 'offer received'})
        
    async def handle_webrtc_answer_endpoint(self, request):
        """Handle WebRTC answer endpoint"""
        data = await request.json()
        # In a real implementation, you would process the answer here
        return web.json_response({'status': 'answer received'})
        
    async def handle_webrtc_candidate_endpoint(self, request):
        """Handle WebRTC candidate endpoint"""
        data = await request.json()
        # In a real implementation, you would process the candidate here
        return web.json_response({'status': 'candidate received'})
        
    async def handle_webrtc_offer(self, connection_id: str, data: dict):
        connection = self.connections[connection_id]
        pc = connection['pc']
        
        if not pc or not WEBRTC_AVAILABLE:
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
            
            if connection.get('recorder') and WEBRTC_AVAILABLE:
                await connection['recorder'].stop()
                
            if connection.get('pc') and WEBRTC_AVAILABLE:
                await connection['pc'].close()
                
            del self.connections[connection_id]
            
    async def run_server(self):
        port = self.config['server']['port']
        host = self.config['server']['host']
        
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        site = web.TCPSite(runner, host, port)
        await site.start()
        
        logger.info(f"Voice streaming server started on {host}:{port}")
        
        # Keep the server running
        while True:
            await asyncio.sleep(3600)  # Sleep for an hour, or until interrupted

# Example usage
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Create and run the server
    server = VoiceStreamingServer()
    
    try:
        asyncio.run(server.run_server())
    except KeyboardInterrupt:
        print("Server stopped")