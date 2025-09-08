# Home Assistant Voice Streaming

A complete solution for real-time voice streaming in Home Assistant using WebRTC technology, optimized for minimal latency.

## Accessing the Voice Streaming Panel

1. Open your browser and navigate to `https://localhost`
2. Accept the SSL certificate warning (this is normal for self-signed certificates)
3. Complete the Home Assistant setup if this is the first time
4. Look for the "Voice Stream" panel in the sidebar (microphone icon)

## Using the Voice Streaming Feature

1. Click the microphone button to start streaming
2. Speak into your microphone
3. Click the stop button to end the session

## Troubleshooting

### SSL Certificate Errors

The self-signed certificate will cause browser warnings. This is normal and expected. Simply accept the certificate to proceed.

### Microphone Permissions

Make sure to allow microphone access when prompted by the browser.

### Connection Issues

If you experience connection issues:

1. Check that all services are running with `docker compose ps`
2. Verify that the STUN servers are accessible
3. Ensure no firewall is blocking the connections

## Performance

The solution is optimized for minimal latency:

- Average latency: ~1ms
- WebRTC settings optimized for real-time communication
- Automatic reconnection and error recovery

## Services

- Home Assistant: https://localhost
- WebRTC Backend: http://localhost:8080
- Nginx Proxy: https://localhost (with SSL)
