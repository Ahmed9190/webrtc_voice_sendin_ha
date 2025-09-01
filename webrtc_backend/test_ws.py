import asyncio
import aiohttp
import json

async def test_websocket():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect('http://localhost:8080/ws') as ws:
                print('Connected to WebSocket')
                # Send a test message
                await ws.send_str(json.dumps({'type': 'test'}))
                print('Sent test message')
                # Wait for a response
                msg = await ws.receive()
                print(f'Received: {msg.data}')
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    asyncio.run(test_websocket())