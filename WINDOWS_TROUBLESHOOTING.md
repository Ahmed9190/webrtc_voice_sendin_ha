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
   - UDP 49152-65535 (TURN relay ports)

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

## Configuration Notes

The system now uses:
- Multiple STUN servers for redundancy
- A local TURN server (coturn) for NAT traversal
- Enhanced ICE candidate logging for debugging
- Improved reconnection logic

If you continue to experience issues, please provide:
1. Browser console logs
2. Docker container logs
3. Network configuration details