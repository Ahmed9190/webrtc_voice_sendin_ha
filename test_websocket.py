#!/usr/bin/env python3
import asyncio
import websockets
import json

async def test_websocket():
    uri = "wss://localhost/api/voice-streaming/ws"
    try:
        async with websockets.connect(uri, ssl=True) as websocket:
            print("Connected to WebSocket")
            
            # Send a test message
            await websocket.send(json.dumps({"type": "test"}))
            print("Sent test message")
            
            # Wait for a response
            response = await websocket.recv()
            print(f"Received: {response}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())