#!/usr/bin/env python3
"""
Performance testing script for the WebRTC voice streaming server.
This script measures latency and other performance metrics.
"""

import asyncio
import aiohttp
import json
import time
import statistics

async def measure_latency():
    """Measure the latency of the server endpoints"""
    base_url = "http://localhost:8080"
    latencies = []
    
    try:
        # Measure health check latency
        for i in range(10):
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{base_url}/health") as resp:
                    if resp.status == 200:
                        end_time = time.time()
                        latency = (end_time - start_time) * 1000  # Convert to milliseconds
                        latencies.append(latency)
                        print(f"Health check {i+1}: {latency:.2f}ms")
                    else:
                        print(f"Health check failed with status: {resp.status}")
                        
        if latencies:
            avg_latency = statistics.mean(latencies)
            min_latency = min(latencies)
            max_latency = max(latencies)
            print(f"\nLatency Statistics:")
            print(f"Average: {avg_latency:.2f}ms")
            print(f"Minimum: {min_latency:.2f}ms")
            print(f"Maximum: {max_latency:.2f}ms")
            
    except Exception as e:
        print(f"Error measuring latency: {e}")

async def test_websocket_performance():
    """Test WebSocket connection performance"""
    try:
        # This would be implemented if we had a WebSocket testing library
        print("WebSocket performance test placeholder")
    except Exception as e:
        print(f"Error testing WebSocket performance: {e}")

async def main():
    """Run all performance tests"""
    print("Starting Performance Tests")
    print("=" * 30)
    
    await measure_latency()
    await test_websocket_performance()
    
    print("\nPerformance tests completed")

if __name__ == "__main__":
    asyncio.run(main())