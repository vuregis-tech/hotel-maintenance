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

# Install Node deps
COPY package*.json ./
RUN npm ci

# Copy source & build frontend
COPY . .
RUN npm run build

# ตรวจสอบว่า build สำเร็จ — ถ้าไม่มี index.html จะ error ทันที
RUN test -f frontend/index.html || (echo "ERROR: frontend build failed!" && exit 1)

# สร้างโฟลเดอร์ uploads (เก็บรูปภาพ)
RUN mkdir -p uploads

EXPOSE 8000

CMD ["python", "run.py"]
