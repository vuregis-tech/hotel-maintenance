import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import os

from .database import Base, engine
from .models import User, MainArea, SubArea, IssueType
from .auth import hash_password
from .database import SessionLocal
from .config import get_settings
from .routers import auth, users, jobs, reports, areas, issue_types

settings = get_settings()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_data():
    db = SessionLocal()
    try:
        # Seed admin user
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                password_hash=hash_password("admin1234"),
                full_name="ผู้ดูแลระบบ",
                department="IT",
                position="System Administrator",
                role="admin",
            )
            db.add(admin)
            logger.info("Created default admin: admin / admin1234")

        # Seed default main areas
        if db.query(MainArea).count() == 0:
            areas_data = [
                ("ห้องพัก", ["ชั้น 1", "ชั้น 2", "ชั้น 3", "ชั้น 4", "ชั้น 5"]),
                ("ล็อบบี้", ["ส่วนต้อนรับ", "โถงทางเดิน", "ลิฟต์"]),
                ("ร้านอาหาร", ["ห้องอาหารหลัก", "ครัว", "บาร์"]),
                ("สระว่ายน้ำ", ["สระผู้ใหญ่", "สระเด็ก", "ห้องเปลี่ยนเสื้อผ้า"]),
                ("ฟิตเนส", ["ห้องออกกำลังกาย", "ห้องอบไอน้ำ"]),
                ("주차场", ["ชั้น B1", "ชั้น B2"]),
                ("พื้นที่ส่วนกลาง", ["ห้องประชุม", "ห้องอเนกประสงค์", "ห้องน้ำสาธารณะ"]),
                ("พื้นที่หลังบ้าน", ["ห้องซักรีด", "ห้องเก็บของ", "ห้องเครื่อง"]),
            ]
            for area_name, subs in areas_data:
                area = MainArea(name=area_name)
                db.add(area)
                db.flush()
                for sub_name in subs:
                    db.add(SubArea(name=sub_name, main_area_id=area.id))
            logger.info("Seeded default areas")

        # Seed default issue types
        if db.query(IssueType).count() == 0:
            issue_names = [
                "ไฟฟ้า/แสงสว่าง",
                "ประปา/น้ำรั่ว",
                "เครื่องปรับอากาศ",
                "เฟอร์นิเจอร์/อุปกรณ์",
                "ประตู/หน้าต่าง/กุญแจ",
                "โทรทัศน์/รีโมท",
                "ตู้เย็น/ไมโครเวฟ",
                "ระบบอินเทอร์เน็ต",
                "ระบบโทรศัพท์",
                "ระบบสุขาภิบาล",
                "ลิฟต์/บันได",
                "ทั่วไป",
            ]
            for name in issue_names:
                db.add(IssueType(name=name))
            logger.info("Seeded default issue types")

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = settings.DATABASE_URL
    is_pg = "postgresql" in db_url or db_url.startswith("postgres://")
    logger.info(f"Connecting to: {'PostgreSQL' if is_pg else 'SQLite'}")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created ✓")
        seed_data()
    except Exception as e:
        logger.error(f"Database startup error: {e}")
        raise
    yield


app = FastAPI(title="Hotel Maintenance System", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(reports.router)
app.include_router(areas.router)
app.include_router(issue_types.router)


@app.get("/api/db-info")
def db_info():
    """Debug endpoint — ดูว่าใช้ database อะไร"""
    raw_url = settings.DATABASE_URL
    is_pg = "postgresql" in raw_url or raw_url.startswith("postgres://")
    db_type = "PostgreSQL ✅" if is_pg else "SQLite ❌ (ข้อมูลหายตอน deploy)"
    return {
        "database_type": db_type,
        "raw_scheme": raw_url.split("://")[0] if "://" in raw_url else "unknown",
        "host": raw_url.split("@")[1].split("/")[0] if "@" in raw_url else "local",
        "cwd": os.getcwd(),
        "frontend_ready": os.path.exists("frontend/index.html"),
    }

os.makedirs("uploads", exist_ok=True)
os.makedirs("frontend", exist_ok=True)

# log path ให้รู้ว่า app รันจากไหน
logger.info(f"CWD: {os.getcwd()}")
logger.info(f"frontend/index.html exists: {os.path.exists('frontend/index.html')}")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ── SPA fallback: ทุก route ที่ไม่ใช่ /api/ และ /uploads/ → serve index.html ──
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # ถ้าเป็น static asset (js, css, images) ให้หาไฟล์จริง
    file_path = os.path.join("frontend", full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)
    # ทุก route อื่น → index.html (React Router จัดการเอง)
    index = "frontend/index.html"
    if os.path.isfile(index):
        return FileResponse(index)
    return JSONResponse({"error": "frontend not built", "cwd": os.getcwd()}, status_code=503)
