FROM python:3.9-slim

# Install Node.js 18
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install -r requirements.txt

# Install Node deps & build frontend
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8000

CMD ["python", "run.py"]
