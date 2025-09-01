FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    portaudio19-dev \
    python3-pyaudio \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and test script
COPY requirements.txt .
COPY test_deps.py .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Test imports
CMD ["python", "test_deps.py"]