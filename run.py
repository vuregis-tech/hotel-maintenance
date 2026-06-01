"""Entry point: python run.py"""
import uvicorn
import os

# ── ตั้ง working directory ให้ตรงกับที่ไฟล์นี้อยู่เสมอ ──
# แก้ปัญหา Railway รัน script จาก directory ที่ผิด
os.chdir(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    reload = os.environ.get("RAILWAY_ENVIRONMENT") is None
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=reload)
