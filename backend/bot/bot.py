"""
Telegram Bot — ใช้สำหรับ /chatid เพื่อหา Chat ID
"""
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logger = logging.getLogger(__name__)
_app = None


async def _cmd_chatid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    await update.message.reply_text(
        f"📋 <b>Chat ID ของกลุ่มนี้</b>\n"
        f"<code>{chat.id}</code>\n\n"
        f"นำค่านี้ไปใส่ใน Railway Variables:\n"
        f"<code>TELEGRAM_GROUP_ALL={chat.id}</code>\n"
        f"(หรือ GROUP_REPORTER / GROUP_TECHNICIAN / GROUP_INSPECTOR)",
        parse_mode="HTML",
    )


async def start_polling():
    global _app
    from ..config import get_settings
    s = get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        logger.info("TELEGRAM_BOT_TOKEN not set — bot disabled")
        return
    try:
        _app = Application.builder().token(s.TELEGRAM_BOT_TOKEN).build()
        _app.add_handler(CommandHandler("chatid", _cmd_chatid))
        _app.add_handler(CommandHandler("start", _cmd_chatid))
        await _app.initialize()
        await _app.start()
        await _app.updater.start_polling(drop_pending_updates=True)
        logger.info("Telegram bot started ✓")
    except Exception as e:
        logger.warning(f"Telegram bot failed to start: {e}")


async def stop_polling():
    global _app
    if _app:
        try:
            await _app.updater.stop()
            await _app.stop()
            await _app.shutdown()
        except Exception:
            pass
