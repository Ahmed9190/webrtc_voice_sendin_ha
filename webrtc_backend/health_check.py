#!/usr/bin/env python3
"""
Health check script for the voice streaming service
This script can be used to perform more detailed health checks
"""

import asyncio
import aiohttp
import sys
import time

async def check_health():
    """Perform detailed health check of the voice streaming service"""
    try:
        async with aiohttp.ClientSession() as session:
            # Check basic health endpoint
            async with session.get('http://localhost:8080/health') as response:
                if response.status != 200:
                    print(f"Health check failed: HTTP {response.status}")
                    return False
                
                health_data = await response.json()
                print(f"Health status: {health_data.get('status', 'unknown')}")
                print(f"WebRTC available: {health_data.get('webrtc_available', False)}")
                print(f"Active connections: {health_data.get('active_connections', 0)}")
                
                if health_data.get('status') == 'healthy':
                    return True
                else:
                    print(f"Service is degraded: {health_data}")
                    return False
                    
    except Exception as e:
        print(f"Health check failed with exception: {e}")
        return False

async def detailed_check():
    """Perform more detailed checks"""
    try:
        async with aiohttp.ClientSession() as session:
            # Test WebSocket connection
            async with session.ws_connect('http://localhost:8080/ws') as ws:
                print("WebSocket connection successful")
                await ws.close()
                return True
    except Exception as e:
        print(f"WebSocket connection test failed: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--detailed":
        result = asyncio.run(detailed_check())
    else:
        result = asyncio.run(check_health())
    
    sys.exit(0 if result else 1)