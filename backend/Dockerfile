FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run migrations then start server
CMD alembic upgrade head && \
    uvicorn app.main:app \
      --host 0.0.0.0 \
      --port ${PORT:-8000} \
      --workers 2
