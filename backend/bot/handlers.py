from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import Job, User, JobStatus, UserRole
from ..schemas import STATUS_LABELS, CATEGORY_LABELS, PRIORITY_LABELS


def get_db() -> Session:
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.effective_chat.id)
    await update.message.reply_text(
        "🏨 *ระบบแจ้งซ่อมโรงแรม*\n\n"
        "คำสั่งที่ใช้ได้:\n"
        "/jobs — ดูงานที่มอบหมาย\n"
        "/pending — งานรอรับ\n"
        "/chatid — ดู Chat ID ของกลุ่มนี้\n"
        "/link [telegram_id] — เชื่อมบัญชีกับระบบ\n"
        "/help — ความช่วยเหลือ",
        parse_mode="Markdown",
    )


async def cmd_chatid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    chat_type = update.effective_chat.type
    title = update.effective_chat.title or "—"
    await update.message.reply_text(
        f"📋 *ข้อมูลกลุ่ม*\n"
        f"Chat ID: `{chat_id}`\n"
        f"ประเภท: {chat_type}\n"
        f"ชื่อ: {title}\n\n"
        f"นำ Chat ID นี้ไปใส่ใน `.env`",
        parse_mode="Markdown",
    )


async def cmd_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("ใช้งาน: /link [telegram_id ของคุณ]\nตัวอย่าง: /link 123456789")
        return
    telegram_id = str(context.args[0])
    user_tg_id = str(update.effective_user.id)
    db = get_db()
    try:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user:
            await update.message.reply_text("❌ ไม่พบ Telegram ID นี้ในระบบ กรุณาติดต่อผู้ดูแล")
            return
        user.telegram_id = user_tg_id
        db.commit()
        await update.message.reply_text(f"✅ เชื่อมบัญชีสำเร็จ! ยินดีต้อนรับ {user.full_name} ({ROLE_LABELS.get(user.role.value, user.role.value)})")
    finally:
        db.close()


async def cmd_jobs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_tg_id = str(update.effective_user.id)
    db = get_db()
    try:
        user = db.query(User).filter(User.telegram_id == user_tg_id).first()
        if not user:
            await update.message.reply_text("❌ ยังไม่ได้เชื่อมบัญชี ใช้คำสั่ง /link [telegram_id]")
            return

        if user.role == UserRole.technician:
            jobs = db.query(Job).filter(
                Job.technician_id == user.id,
                Job.status.in_([JobStatus.in_progress, JobStatus.pending])
            ).order_by(Job.created_at.desc()).limit(10).all()
        elif user.role == UserRole.inspector:
            jobs = db.query(Job).filter(Job.status == JobStatus.pending_inspection).limit(10).all()
        else:
            jobs = db.query(Job).filter(Job.reporter_id == user.id).order_by(Job.created_at.desc()).limit(10).all()

        if not jobs:
            await update.message.reply_text("📭 ไม่มีงานในขณะนี้")
            return

        lines = [f"📋 *งานของคุณ ({len(jobs)} รายการ)*\n"]
        for job in jobs:
            status_icon = {"pending": "🟡", "in_progress": "🔵", "pending_inspection": "🟠", "completed": "🟢", "reopened": "🔴"}.get(job.status.value, "⚪")
            lines.append(f"{status_icon} *{job.job_number}* — ห้อง {job.room_number}\n"
                         f"  📂 {CATEGORY_LABELS.get(job.category.value)} | ⚡ {PRIORITY_LABELS.get(job.priority.value)}\n"
                         f"  📝 {job.description[:60]}...\n")
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    finally:
        db.close()


async def cmd_pending(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = get_db()
    try:
        jobs = db.query(Job).filter(Job.status == JobStatus.pending).order_by(Job.created_at.desc()).limit(10).all()
        if not jobs:
            await update.message.reply_text("✅ ไม่มีงานที่รอรับ")
            return
        lines = [f"🟡 *งานรอรับ ({len(jobs)} รายการ)*\n"]
        for job in jobs:
            lines.append(f"• *{job.job_number}* — ห้อง {job.room_number}\n"
                         f"  {CATEGORY_LABELS.get(job.category.value)} | {PRIORITY_LABELS.get(job.priority.value)}\n"
                         f"  {job.description[:60]}\n")
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    finally:
        db.close()


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 *คำสั่งทั้งหมด*\n\n"
        "/start — เริ่มต้นใช้งาน\n"
        "/jobs — ดูงานที่เกี่ยวข้องกับคุณ\n"
        "/pending — ดูงานรอรับทั้งหมด\n"
        "/chatid — ดู Chat ID ของกลุ่มนี้\n"
        "/link [id] — เชื่อมบัญชีกับระบบ\n"
        "/help — แสดงคำสั่งทั้งหมด\n\n"
        "📌 การใช้งาน Web Dashboard:\n"
        "เข้าระบบผ่านเว็บเพื่อแจ้งงาน อัปเดตสถานะ และตรวจสอบงาน",
        parse_mode="Markdown",
    )


ROLE_LABELS = {
    "admin": "ผู้ดูแลระบบ",
    "reporter": "ผู้แจ้ง",
    "technician": "ช่าง",
    "inspector": "ผู้ตรวจ",
}
