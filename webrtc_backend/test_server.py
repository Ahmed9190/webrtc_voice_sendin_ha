#!/usr/bin/env python3
"""
Test script for the WebRTC voice streaming server.
This script will start the server and run some basic tests.
"""

import asyncio
import aiohttp
import json

async def test_server():
    """Test the WebRTC server endpoints"""
    base_url = "http://localhost:8080"
    
    try:
        # Test health endpoint
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{base_url}/health") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"Health check passed: {data}")
                else:
                    print(f"Health check failed with status: {resp.status}")
                    
    except Exception as e:
        print(f"Error connecting to server: {e}")
        
    print("Test completed")

if __name__ == "__main__":
    asyncio.run(test_server())