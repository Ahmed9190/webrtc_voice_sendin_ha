#!/usr/bin/env python3
"""
Integration test script for the complete voice streaming setup.
This script tests the end-to-end functionality.
"""

import asyncio
import aiohttp
import json

async def test_end_to_end():
    """Test the complete end-to-end functionality"""
    print("Starting End-to-End Integration Test")
    print("=" * 35)
    
    # Test 1: Check if Home Assistant is accessible
    print("1. Testing Home Assistant accessibility...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("https://localhost", ssl=False) as resp:
                if resp.status == 200:
                    print("   ✓ Home Assistant is accessible")
                else:
                    print(f"   ✗ Home Assistant returned status {resp.status}")
    except Exception as e:
        print(f"   ✗ Error connecting to Home Assistant: {e}")
    
    # Test 2: Check if WebRTC backend is accessible
    print("2. Testing WebRTC backend accessibility...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8080/health") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get('status') == 'healthy':
                        print("   ✓ WebRTC backend is healthy")
                    else:
                        print(f"   ✗ WebRTC backend returned unhealthy status: {data}")
                else:
                    print(f"   ✗ WebRTC backend returned status {resp.status}")
    except Exception as e:
        print(f"   ✗ Error connecting to WebRTC backend: {e}")
    
    # Test 3: Check if voice streaming card is served
    print("3. Testing voice streaming card availability...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("https://localhost/local/voice-streaming-card.js", ssl=False) as resp:
                if resp.status == 200:
                    content = await resp.text()
                    if "VoiceStreamingCard" in content:
                        print("   ✓ Voice streaming card is correctly served")
                    else:
                        print("   ✗ Voice streaming card content is incorrect")
                else:
                    print(f"   ✗ Voice streaming card returned status {resp.status}")
    except Exception as e:
        print(f"   ✗ Error fetching voice streaming card: {e}")
    
    print("\nIntegration test completed")

if __name__ == "__main__":
    asyncio.run(test_end_to_end())