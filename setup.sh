#!/bin/bash
set -e

echo "🏨 Hotel Maintenance System — Setup"
echo "====================================="

# Python venv
if [ ! -d "venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
echo "📥 Installing dependencies..."
pip install -r requirements.txt -q

# .env
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  ไฟล์ .env ถูกสร้างแล้ว กรุณาแก้ไขค่าต่อไปนี้ก่อนรัน:"
  echo "   - TELEGRAM_BOT_TOKEN  (รับจาก @BotFather)"
  echo "   - TELEGRAM_GROUP_*    (Chat ID ของแต่ละกลุ่ม)"
  echo ""
  echo "วิธีสร้าง Telegram Bot:"
  echo "  1. เปิด Telegram → ค้นหา @BotFather"
  echo "  2. พิมพ์ /newbot → ตั้งชื่อ → รับ Token"
  echo "  3. สร้าง 4 กลุ่ม: ผู้แจ้ง / ช่าง / ผู้ตรวจ / รวม"
  echo "  4. เพิ่ม Bot เป็น Admin ในทุกกลุ่ม"
  echo "  5. ส่งข้อความในกลุ่ม แล้วรัน /chatid เพื่อดู Chat ID"
else
  echo "✅ .env พบแล้ว"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "▶️  รันระบบด้วย:"
echo "   source venv/bin/activate"
echo "   python run.py"
echo ""
echo "🌐 เปิดเบราว์เซอร์: http://localhost:8000"
echo "👤 บัญชี Admin เริ่มต้น: admin / admin1234"
