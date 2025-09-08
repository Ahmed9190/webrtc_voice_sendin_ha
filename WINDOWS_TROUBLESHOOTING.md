# Windows Troubleshooting Guide

## Common WebRTC Issues on Windows

### 1. ICE Connection Failures

**Problem**: ICE connection fails with "disconnected" or "failed" states on Windows but works on Linux.

**Solution**: The system now includes a TURN server (coturn) which should resolve most NAT traversal issues.

### 2. Firewall Issues

**Problem**: Windows Firewall blocking required ports.

**Solution**: 
1. Open Windows Firewall settings
2. Allow the following ports:
   - TCP 3478 (TURN)
   - UDP 3478 (TURN)
   - TCP 5349 (TURN TLS)
   - UDP 5349 (TURN TLS)
   - UDP 49152-49252 (TURN relay ports)

Note: The port range has been restricted to avoid Windows permission issues. The full range (49152-65535) may cause access permission errors on Windows.

### 3. Network Interface Issues

**Problem**: Windows may have multiple network interfaces that cause ICE candidate confusion.

**Solution**: The updated configuration includes multiple STUN servers and a TURN server for better connectivity.

## Testing Connectivity

To test if your TURN server is working:

1. Check if the coturn container is running:
   ```bash
   docker compose ps
   ```

2. Verify the TURN server is listening:
   ```bash
   docker compose logs coturn
   ```

3. Test external connectivity:
   ```bash
   telnet YOUR_EXTERNAL_IP 3478
   ```

## Debugging Steps

1. Check browser console logs for detailed ICE candidate information
2. Verify Docker containers are running:
   ```bash
   docker compose ps
   ```
3. Check container logs:
   ```bash
   docker compose logs coturn
   docker compose logs voice_streaming
   ```

## Port Permission Issues

**Problem**: Error message "ports are not available: exposing port UDP 0.0.0.0:55174 -> 127.0.0.1:0: listen udp 0.0.0.0:55174: bind: An attempt was made to access a socket in a way forbidden by its access permissions."

**Solution**: 
1. The system now uses a restricted port range (49152-49252) instead of the full range
2. Make sure Windows Firewall allows Docker Desktop to access these ports
3. Run Docker Desktop as Administrator if permission issues persist
4. Check if any other applications are using ports in this range

## Configuration Notes

The system now uses:
- Multiple STUN servers for redundancy
- A local TURN server (coturn) for NAT traversal
- Enhanced ICE candidate logging for debugging
- Improved reconnection logic
- Restricted port range to avoid Windows permission issues

If you continue to experience issues, please provide:
1. Browser console logs
2. Docker container logs
3. Network configuration details