import logging
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import os

from .database import Base, engine
from .models import User, MainArea, SubArea, IssueType, RepairLog, Department, AppSetting
from .auth import hash_password, require_roles, get_current_user
from fastapi import Depends, HTTPException, UploadFile, File
from .database import SessionLocal
from .config import get_settings
from .routers import auth, users, jobs, reports, areas, issue_types
from .routers import departments, onduty

settings = get_settings()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


_AREAS_DATA = [
    ("SGH F1", ["120", "121", "122", "123", "124", "Corridor", "SGH Reception"]),
    ("SGH F2", ["220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "Server Room", "Corridor", "HK SGH2"]),
    ("SGH F3", ["320", "321", "322", "323", "324", "325", "326", "327", "328", "329", "330", "331", "HK SGH3", "Shower Room", "Corridor"]),
    ("SGH F4", ["420", "421", "422", "423", "424", "425", "426", "427", "428", "429", "430", "431", "Associate Accomd.", "Corridor", "HK SGH4"]),
    ("PSG F1", ["180", "181", "182", "183", "184", "185", "186", "187", "188", "Corridor"]),
    ("PSG F2", ["280", "281", "282", "283", "284", "285", "286", "287", "288", "Corridor"]),
    ("PSG F3", ["380", "381", "382", "383", "384", "385", "386", "387", "388", "Penthouse F3", "Corridor"]),
    ("PSG F4", ["480", "481", "482", "483", "484", "485", "486", "487", "488", "Penthouse F4", "Corridor"]),
    ("BOH", ["Front Office", "ACC Office", "RSVN Office", "SM Office", "HK Office", "FB Office", "Main Kitchen", "Staff Canteen", "EN Office", "EN GEN room", "PSG Spa room", "PSG Pool toilet"]),
    ("Common Area", ["Lobby", "Pool SGH", "Pool PSG", "Main Hotel Entrance", "Parking", "7/11 rooftop"]),
    ("Rooftop", ["SGH rooftop", "PSG rooftop"]),
    ("Toilet", ["Guest F1", "Guest F2", "Staff F1", "Staff F2", "Staff F3", "Staff F4"]),
    ("Elevator", ["SGH", "Lobby", "Admin", "HK service", "FB Service"]),
    ("PSG Basement Store", ["Owner 1", "Owner 2", "Owner 3", "FB", "HK"]),
    ("Other", ["Other"]),
]

_ISSUE_TYPES = [
    "Air-Con", "Television", "Bathroom", "Jacuzzi", "Furniture/Fitting",
    "Ceiling", "Wall", "Pantry", "Telephone", "Plumbing", "Piping",
    "Flooring", "Electric component", "Fuse & Wiring", "Internet/Wifi",
    "Door & Door Lock", "Safety Box", "CCTV", "Handrail",
    "Fire Alarm equipment", "Chiller", "General / Other",
]

# (full_name, position, department, username)  — all Staff, must_change_password=True
_USERS_DATA = [
    ("Chatchaya Jearranai", "Hotel Manager", "Admin & General", "chatchayaj"),
    ("Chudaporn Thitathan", "Asst. Financial Controller", "Admin & General", "chudapornt"),
    ("Potjanee Towsun", "Assistant Chief Accountant", "Admin & General", "potjaneet"),
    ("Yothakant Phaknithiphan", "Accounting Executive", "Admin & General", "yothakantp"),
    ("Weerasak Pannarangsee", "Purchasing and Store Officer", "Admin & General", "weerasakp"),
    ("Warittha Saengnark", "Human Capital Manager", "Admin & General", "waritthas"),
    ("Chumphon Phasomsup", "Assistant Quality & Sustainability Manager", "Admin & General", "chumphonp"),
    ("Boonchuay Songnak", "Assistant Chief Engineer", "Engineering", "boonchuays"),
    ("Than Win Tun", "General Technician", "Engineering", "thanw"),
    ("Prayong Aukum", "Duty Engineering", "Engineering", "prayonga"),
    ("Thant Zin Oo", "General Technician", "Engineering", "thantz"),
    ("Zayar Lin Htut", "General Technician", "Engineering", "zayarl"),
    ("Nyi Nyi", "General Technician", "Engineering", "nyin"),
    ("Chan Yoong Shen", "Front Office Duty Manager", "Front Office", "chany"),
    ("Suchatit Hanchana", "Front Office Duty Manager", "Front Office", "suchatith"),
    ("Surapong Kumuda", "Hommate", "Front Office", "surapongk"),
    ("Thet Tun", "Hommate", "Front Office", "thett"),
    ("Ashik Kottiyarakkal Hydrosse", "Hommate", "Front Office", "ashikk"),
    ("Maneerat Thonghom", "Hommate", "Front Office", "maneeratt"),
    ("Thanutcha Traijapo", "Hommate", "Front Office", "thanutchat"),
    ("Chinnawat Nakkaew", "Hommate", "Front Office", "chinnawatn"),
    ("Yupa Maneelum", "Housekeeping Supervisor", "Housekeeping", "yupam"),
    ("Jutharat Pecharat", "Floor Supervisor", "Housekeeping", "jutharatp"),
    ("Nyo Nyo Sam", "Floor Supervisor", "Housekeeping", "nyon"),
    ("Htay Aung", "Housekeeping Attendant", "Housekeeping", "htaya"),
    ("Nu Nu Win", "Housekeeping Attendant", "Housekeeping", "nun"),
    ("Thi Thi Aye", "Housekeeping Attendant", "Housekeeping", "thit"),
    ("San Thidar Win", "Housekeeping Attendant", "Housekeeping", "sant"),
    ("Saung Hnin Oo", "Housekeeping Attendant", "Housekeeping", "saungh"),
    ("Htike Htike Tun", "Housekeeping Attendant", "Housekeeping", "htikeh"),
    ("Thoung Htoo", "Housekeeping Attendant", "Housekeeping", "thoungh"),
    ("Win Yi", "Housekeeping Attendant", "Housekeeping", "winy"),
    ("Tin Shwe", "Housekeeping Attendant", "Housekeeping", "tins"),
    ("Aye Mon", "Housekeeping Attendant", "Housekeeping", "ayem"),
    ("San Moe Win", "Housekeeping Attendant", "Housekeeping", "sanm"),
    ("Hnin Nwe", "Housekeeping Attendant", "Housekeeping", "hninn"),
    ("Thin Thin Mon", "Housekeeping Attendant", "Housekeeping", "thint"),
    ("Htet Paing Oo", "Housekeeping Attendant", "Housekeeping", "htetp"),
    ("Aung San Htwe", "Housekeeping Attendant", "Housekeeping", "aungs"),
    ("Thi Da Soe", "Housekeeping Attendant", "Housekeeping", "thid"),
    ("Natthanicha Art-on", "Asst. Reservation and Revenue Manager", "Reservations", "natthanichaa"),
    ("Salinee Hokpeenong", "Reservation & Sales Executive", "Reservations", "salineeh"),
    ("Phattaraporn Usamanwet", "Sales & E-Commerce Manager", "Sales & Marketing", "phattarapornu"),
    ("Aumaporn Chaum-jan", "Marketing & Communication Executive", "Sales & Marketing", "aumapornc"),
    ("Nutdanai Loylib", "Assistant Restaurant Manager", "Food & Beverage", "nutdanail"),
    ("Chainarong Nimdum", "F&B Captain", "Food & Beverage", "chainarongn"),
    ("Khin Maung Win", "F&B Host", "Food & Beverage", "khinm"),
    ("Nyan Lin Aung", "Waiter", "Food & Beverage", "nyanl"),
    ("Kotchawan Tongboon", "Waitress", "Food & Beverage", "kotchawant"),
    ("Nichapha Saenaunruean", "Waitress", "Food & Beverage", "nichaphas"),
    ("Khwanruedee Hadda", "Waitress", "Food & Beverage", "khwanruedeeh"),
    ("Myint Zaw Lin", "Waiter", "Food & Beverage", "myintz"),
    ("Nopporn Binmart", "Sous Chef", "Culinary or Kitchen", "noppornb"),
    ("Monnapa Ropkan", "Demi Chef de Partie", "Culinary or Kitchen", "monnapar"),
    ("Zaw Zaw Aung", "Commis Chef", "Culinary or Kitchen", "zawz"),
    ("Tin Moe Tun", "Commis Chef", "Culinary or Kitchen", "tinm"),
    ("Atcharapun Luksanasut", "Commis Chef", "Culinary or Kitchen", "atcharapunl"),
    ("Saengravee Seethong", "Commis Chef", "Culinary or Kitchen", "saengravees"),
    ("Boonyarit Limsakul", "Kitchen Helper", "Culinary or Kitchen", "boonyaritl"),
    ("Watsana Watthanasan", "Kitchen Helper", "Culinary or Kitchen", "watsanaw"),
    ("Thanayut Wangma", "Steward", "Culinary or Kitchen", "thanayutw"),
]

_DEPARTMENTS_DATA = [
    "Admin & General",
    "Engineering",
    "Front Office",
    "Housekeeping",
    "Reservations",
    "Sales & Marketing",
    "Food & Beverage",
    "Culinary or Kitchen",
]

_INITIAL_PASSWORD = "12345"  # users must change on first login


def seed_data():
    db = SessionLocal()
    try:
        # Seed admin user
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                password_hash=hash_password("admin1234"),
                full_name="System Administrator",
                department="IT",
                position="System Administrator",
                role="admin",
                must_change_password=False,
            )
            db.add(admin)
            logger.info("Created default admin: admin / admin1234")

        # Seed users from config
        if db.query(User).filter(User.username != "admin").count() == 0:
            pw_hash = hash_password(_INITIAL_PASSWORD)
            for full_name, position, department, username in _USERS_DATA:
                db.add(User(
                    username=username.strip(),
                    password_hash=pw_hash,
                    full_name=full_name.strip(),
                    department=department.strip(),
                    position=position.strip(),
                    role="staff",
                    must_change_password=True,
                ))
            logger.info(f"Seeded {len(_USERS_DATA)} users from config")

        # Seed main areas + sub areas
        if db.query(MainArea).count() == 0:
            for i, (area_name, subs) in enumerate(_AREAS_DATA):
                area = MainArea(name=area_name, sort_order=i)
                db.add(area)
                db.flush()
                for j, sub_name in enumerate(subs):
                    db.add(SubArea(name=str(sub_name), main_area_id=area.id, sort_order=j))
            logger.info(f"Seeded {len(_AREAS_DATA)} main areas from config")

        # Seed issue types
        if db.query(IssueType).count() == 0:
            for i, name in enumerate(_ISSUE_TYPES):
                db.add(IssueType(name=name, sort_order=i))
            logger.info(f"Seeded {len(_ISSUE_TYPES)} issue types from config")

        # Seed departments
        if db.query(Department).count() == 0:
            for name in _DEPARTMENTS_DATA:
                db.add(Department(name=name))
            logger.info(f"Seeded {len(_DEPARTMENTS_DATA)} departments from config")

        db.commit()
    finally:
        db.close()


def run_migrations():
    """เพิ่ม column ใหม่ที่เพิ่มเข้ามาโดยไม่ทำลายข้อมูลเดิม"""
    from sqlalchemy import text
    is_pg = "postgresql" in settings.DATABASE_URL or settings.DATABASE_URL.startswith("postgres://")
    migrations = [
        # ข้อ 4: rejection fields
        ("work_orders", "rejection_reason", "TEXT"),
        ("work_orders", "rejected_at", "TIMESTAMPTZ" if is_pg else "DATETIME"),
        # ข้อ 6: transfer fields
        ("work_orders", "transferred_to_id", "INTEGER"),
        ("work_orders", "transfer_note", "TEXT"),
        # Feature 2: priority
        ("maintenance_requests", "priority", "VARCHAR(20) DEFAULT 'normal'"),
        # Feature 3: scheduled repair time
        ("maintenance_requests", "scheduled_at", "TIMESTAMPTZ" if is_pg else "DATETIME"),
        # Feature 4: edit tracking
        ("maintenance_requests", "last_edited_by_id", "INTEGER"),
        ("maintenance_requests", "last_edited_at", "TIMESTAMPTZ" if is_pg else "DATETIME"),
        # Feature 5: OOO date range
        ("work_orders", "ooo_start_date", "VARCHAR(10)"),
        ("work_orders", "ooo_end_date", "VARCHAR(10)"),
        ("work_orders", "ooo_notified_user_id", "INTEGER"),
        ("work_orders", "ooo_telegram_sent", "BOOLEAN DEFAULT FALSE"),
        # Feature 6: แผนกที่แสดงชื่อใน dropdown ผู้รับแจ้ง OOO
        ("departments", "show_in_ooo", "BOOLEAN DEFAULT FALSE"),
        # Feature 7: sort order for areas and issue types
        ("main_areas", "sort_order", "INTEGER DEFAULT 0"),
        ("sub_areas", "sort_order", "INTEGER DEFAULT 0"),
        ("issue_types", "sort_order", "INTEGER DEFAULT 0"),
        # Security: force password change on first login
        ("users", "must_change_password", "BOOLEAN DEFAULT FALSE"),
        # Telegram tagging
        ("users", "telegram_username", "VARCHAR(100)"),
        # Department: แผนกที่รับงานได้
        ("departments", "can_receive_jobs", "BOOLEAN DEFAULT FALSE"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in migrations:
            try:
                if is_pg:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                else:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                conn.rollback()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = settings.DATABASE_URL
    is_pg = "postgresql" in db_url or db_url.startswith("postgres://")
    logger.info(f"Connecting to: {'PostgreSQL' if is_pg else 'SQLite'}")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created ✓")
        run_migrations()
        logger.info("Migrations applied ✓")
        seed_data()
    except Exception as e:
        logger.error(f"Database startup error: {e}")
        raise
    # 🤖 Telegram bot — lazy import เพื่อไม่ให้ crash app ถ้า library มีปัญหา
    try:
        from .bot.bot import start_polling, stop_polling as _stop
        await start_polling()
        _stop_fn = _stop
    except Exception as e:
        logger.warning(f"Telegram bot import/start failed: {e}")
        _stop_fn = None
    # Daily summary scheduler
    scheduler = None
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from .services.notification import send_daily_summary
        scheduler = AsyncIOScheduler(timezone="UTC")
        scheduler.add_job(send_daily_summary, CronTrigger(hour=0, minute=0))
        scheduler.start()
        logger.info("Daily summary scheduler started ✓")
    except Exception as e:
        logger.warning(f"Scheduler start failed: {e}")

    yield

    if scheduler and scheduler.running:
        scheduler.shutdown()
    if _stop_fn:
        try:
            await _stop_fn()
        except Exception:
            pass


app = FastAPI(title="Hotel Maintenance System", version="2.0.0", lifespan=lifespan)

_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
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
app.include_router(departments.router)
app.include_router(onduty.router)


@app.post("/api/admin/reseed-config")
def reseed_config(current_user: User = Depends(require_roles("admin"))):
    """ล้างข้อมูล areas, issue types, และ users (ยกเว้น admin) แล้ว seed ใหม่จาก config"""
    from sqlalchemy import text
    db = SessionLocal()
    try:
        is_pg = "postgresql" in settings.DATABASE_URL or settings.DATABASE_URL.startswith("postgres://")
        # ลบข้อมูลทั้งหมดด้วย CASCADE (จัดการ FK อัตโนมัติ)
        if is_pg:
            db.execute(text("TRUNCATE TABLE maintenance_requests RESTART IDENTITY CASCADE"))
            db.execute(text("TRUNCATE TABLE main_areas RESTART IDENTITY CASCADE"))
            db.execute(text("TRUNCATE TABLE issue_types RESTART IDENTITY CASCADE"))
            db.execute(text("TRUNCATE TABLE departments RESTART IDENTITY CASCADE"))
            db.execute(text("DELETE FROM users WHERE username != 'admin'"))
        else:
            db.execute(text("DELETE FROM maintenance_requests"))
            db.execute(text("DELETE FROM sub_areas"))
            db.execute(text("DELETE FROM main_areas"))
            db.execute(text("DELETE FROM issue_types"))
            db.execute(text("DELETE FROM departments"))
            db.execute(text("DELETE FROM users WHERE username != 'admin'"))
        db.commit()

        # Re-seed ข้อมูลใหม่
        pw_hash = hash_password(_INITIAL_PASSWORD)
        for full_name, position, department, username in _USERS_DATA:
            db.add(User(
                username=username.strip(),
                password_hash=pw_hash,
                full_name=full_name.strip(),
                department=department.strip(),
                position=position.strip(),
                role="staff",
                must_change_password=True,
            ))

        for i, (area_name, subs) in enumerate(_AREAS_DATA):
            area = MainArea(name=area_name, sort_order=i)
            db.add(area)
            db.flush()
            for j, sub_name in enumerate(subs):
                db.add(SubArea(name=str(sub_name), main_area_id=area.id, sort_order=j))

        for i, name in enumerate(_ISSUE_TYPES):
            db.add(IssueType(name=name, sort_order=i))

        for name in _DEPARTMENTS_DATA:
            db.add(Department(name=name))

        db.commit()
        return {
            "ok": True,
            "users": len(_USERS_DATA),
            "main_areas": len(_AREAS_DATA),
            "issue_types": len(_ISSUE_TYPES),
            "departments": len(_DEPARTMENTS_DATA),
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


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


@app.get("/api/telegram-test")
async def telegram_test():
    """ทดสอบ Telegram — เรียก endpoint นี้แล้วดูผลลัพธ์"""
    import httpx
    s = settings
    result = {
        "token_set": bool(s.TELEGRAM_BOT_TOKEN),
        "group_all": s.TELEGRAM_GROUP_ALL or "(ว่าง)",
        "group_reporter": s.TELEGRAM_GROUP_REPORTER or "(ว่าง)",
        "group_technician": s.TELEGRAM_GROUP_TECHNICIAN or "(ว่าง)",
        "group_inspector": s.TELEGRAM_GROUP_INSPECTOR or "(ว่าง)",
        "send_result": {}
    }
    if not s.TELEGRAM_BOT_TOKEN:
        result["error"] = "TELEGRAM_BOT_TOKEN ยังไม่ได้ตั้งค่า"
        return result
    # ทดสอบส่งข้อความจริง
    chat_ids = [c for c in [
        s.TELEGRAM_GROUP_ALL, s.TELEGRAM_GROUP_REPORTER,
        s.TELEGRAM_GROUP_TECHNICIAN, s.TELEGRAM_GROUP_INSPECTOR
    ] if c and c.strip()]
    seen = set()
    async with httpx.AsyncClient(timeout=10) as client:
        for cid in chat_ids:
            cid = cid.strip()
            if cid in seen:
                continue
            seen.add(cid)
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{s.TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={"chat_id": cid, "text": "✅ ทดสอบระบบแจ้งซ่อม — การเชื่อมต่อสำเร็จ!"},
                )
                result["send_result"][cid] = resp.json()
            except Exception as e:
                result["send_result"][cid] = {"error": str(e)}
    return result

@app.get("/api/system/storage-status")
async def storage_status():
    """ตรวจสอบการตั้งค่า storage"""
    from .services.storage import is_cloudinary_enabled
    on_railway = bool(os.environ.get("RAILWAY_PUBLIC_DOMAIN"))
    cloud_ok = is_cloudinary_enabled()
    return {
        "cloudinary_enabled": cloud_ok,
        "on_railway": on_railway,
        "storage_type": "cloudinary" if cloud_ok else ("local (ephemeral — ใช้บน Railway ไม่ได้)" if on_railway else "local"),
        "warning": (
            None if cloud_ok else
            "Cloudinary ยังไม่ได้ตั้งค่า — รูปภาพจะหายหลัง deploy ใหม่ กรุณาตั้งค่า CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
            if on_railway else
            "Cloudinary ยังไม่ได้ตั้งค่า — ใช้ local storage (ใช้ได้สำหรับ dev เท่านั้น)"
        ),
    }

@app.get("/api/system/logo")
def get_logo():
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "logo_url").first()
        return {"url": row.value if row else None}
    finally:
        db.close()


@app.post("/api/admin/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("admin")),
):
    from .services.storage import upload_image
    data = await file.read()
    url = upload_image(data, folder="hotel-maintenance/logos")
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "logo_url").first()
        if row:
            row.value = url
        else:
            db.add(AppSetting(key="logo_url", value=url))
        db.commit()
    finally:
        db.close()
    return {"url": url}


from pydantic import BaseModel as _BaseModel
from typing import Optional as _Optional

class SLASettings(_BaseModel):
    normal: _Optional[int] = None       # minutes, None = infinite
    urgent: _Optional[int] = None
    very_urgent: _Optional[int] = None

@app.get("/api/admin/sla")
def get_sla(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        result = {}
        for p in ["normal", "urgent", "very_urgent"]:
            row = db.query(AppSetting).filter(AppSetting.key == f"sla_{p}").first()
            result[p] = int(row.value) if row and row.value else None
        return result
    finally:
        db.close()

@app.put("/api/admin/sla")
def update_sla(data: SLASettings, current_user: User = Depends(require_roles("admin"))):
    db = SessionLocal()
    try:
        for p in ["normal", "urgent", "very_urgent"]:
            val = getattr(data, p)
            row = db.query(AppSetting).filter(AppSetting.key == f"sla_{p}").first()
            new_val = str(val) if val is not None else ""
            if row:
                row.value = new_val
            else:
                db.add(AppSetting(key=f"sla_{p}", value=new_val))
        db.commit()
        return {"ok": True}
    finally:
        db.close()

_ALL_FEATURES = [
    "view_dashboard", "create_request", "view_all_requests",
    "assign_work", "accept_work", "inspect_job",
    "cancel_job", "reopen_job", "view_reports",
    "manage_on_duty", "manage_settings",
]
_DEFAULT_PERMISSIONS = {
    "admin":      list(_ALL_FEATURES),
    "supervisor": ["view_dashboard","create_request","view_all_requests","assign_work","accept_work","inspect_job","cancel_job","reopen_job","view_reports","manage_on_duty"],
    "technician": ["view_dashboard","create_request","view_all_requests","accept_work","inspect_job","view_reports","manage_on_duty"],
    "staff":      ["view_dashboard","create_request"],
}

@app.get("/api/admin/permissions")
def get_permissions(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "role_permissions").first()
        if row and row.value:
            perms = json.loads(row.value)
            for role, defaults in _DEFAULT_PERMISSIONS.items():
                if role not in perms:
                    perms[role] = defaults
            perms["admin"] = list(_ALL_FEATURES)
            return perms
        return _DEFAULT_PERMISSIONS
    finally:
        db.close()

@app.put("/api/admin/permissions")
def update_permissions(data: dict, current_user: User = Depends(require_roles("admin"))):
    data["admin"] = list(_ALL_FEATURES)
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "role_permissions").first()
        val = json.dumps(data)
        if row:
            row.value = val
        else:
            db.add(AppSetting(key="role_permissions", value=val))
        db.commit()
    finally:
        db.close()
    return data

@app.delete("/api/admin/logo")
def delete_logo(current_user: User = Depends(require_roles("admin"))):
    db = SessionLocal()
    try:
        db.query(AppSetting).filter(AppSetting.key == "logo_url").delete()
        db.commit()
    finally:
        db.close()
    return {"url": None}


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
