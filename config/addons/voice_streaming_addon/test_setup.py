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