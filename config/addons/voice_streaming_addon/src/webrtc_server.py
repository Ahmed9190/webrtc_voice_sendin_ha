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