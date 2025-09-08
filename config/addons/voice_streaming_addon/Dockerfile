FROM python:3.11-slim

# Install system dependencies
  RUN apt-get update && apt-get install -y \                                                                                                                                 │
 alsa-utils \                                                                                                                                                           │
 pulseaudio \                                                                                                                                                           │
 gcc \                                                                                                                                                                  │
 portaudio19-dev \                                                                                                                                                      │
 python3-pyaudio \                                                                                                                                                      │
 && rm -rf /var/lib/apt/lists/*                                                                                                                                         │


# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Node.js package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY www/ ./www/

# Create necessary directories
RUN mkdir -p /data/recordings /data/config

# Expose ports
EXPOSE 8080 3478/udp 5349

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:8080/health || exit 1

# Start script
COPY run.sh .
RUN chmod +x run.sh

CMD ["./run.sh"]
