#!/usr/bin/env python3
"""
Test script to verify that the server is using our STUN/TURN servers
"""

import json
import os

def test_config_loading():
    """Test that the config file contains our STUN/TURN servers"""
    config_path = os.path.join(os.path.dirname(__file__), "webrtc_backend", "config.json")
    
    if not os.path.exists(config_path):
        print(f"Config file not found at {config_path}")
        return False
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        ice_servers = config.get("webrtc", {}).get("ice_servers", [])
        
        # Check for our STUN servers
        stun_servers = [s for s in ice_servers if "stun:" in s.get("urls", "")]
        turn_servers = [s for s in ice_servers if "turn:" in s.get("urls", "")]
        
        print(f"Found {len(stun_servers)} STUN servers:")
        for server in stun_servers:
            print(f"  - {server['urls']}")
        
        print(f"Found {len(turn_servers)} TURN servers:")
        for server in turn_servers:
            print(f"  - {server['urls']} (username: {server.get('username', 'N/A')})")
        
        # Verify our servers are present
        required_stun = [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun.stunprotocol.org:3478",
            "stun:stun.voiparound.com",
            "stun:stun.voipbuster.com"
        ]
        
        required_turn = ["turn:coturn:3478"]
        
        missing_stun = [s for s in required_stun if not any(s in server.get("urls", "") for server in ice_servers)]
        missing_turn = [s for s in required_turn if not any(s in server.get("urls", "") for server in ice_servers)]
        
        if missing_stun:
            print(f"Missing STUN servers: {missing_stun}")
            return False
        
        if missing_turn:
            print(f"Missing TURN servers: {missing_turn}")
            return False
        
        print("All required STUN/TURN servers are present in configuration!")
        return True
        
    except Exception as e:
        print(f"Error reading config file: {e}")
        return False

if __name__ == "__main__":
    success = test_config_loading()
    exit(0 if success else 1)