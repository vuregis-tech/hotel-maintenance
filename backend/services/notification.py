"""
Telegram Notification Service
ส่ง notification เมื่อมีงานใหม่หรือสถานะเปลี่ยน
"""
import threading
import logging
import httpx
from functools import lru_cache

logger = logging.getLogger(__name__)


def _get_settings():
    from ..config import get_settings
    return get_settings()


# ── สถานะภาษาไทย ──────────────────────────────────────
STATUS_TH = {
    "pending":            "🟡 รอรับงาน",
    "assigned":           "🔵 จ่ายงานให้ช่างแล้ว",
    "in_progress":        "🔧 กำลังดำเนินการ",
    "pending_inspection": "🟠 รอตรวจสอบ",
    "completed":          "✅ เสร็จสิ้น",
    "reopened":           "🔄 ส่งซ่อมใหม่",
    "external_tech":      "🔨 รอช่างภายนอก",
    "cancelled":          "❌ ยกเลิก",
}


def _location(req) -> str:
    parts = []
    if req.main_area:
        parts.append(req.main_area.name)
    if req.sub_area:
        parts.append(req.sub_area.name)
    if req.other_location:
        parts.append(req.other_location)
    return " › ".join(parts) if parts else "ไม่ระบุ"


def _send_bg(token: str, chat_ids: list, text: str):
    """ส่งข้อความ Telegram ใน background thread — ไม่ block API response"""
    def _run():
        try:
            with httpx.Client(timeout=8) as client:
                for cid in chat_ids:
                    if not cid or cid in ("-", ""):
                        continue
                    resp = client.post(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        json={"chat_id": cid, "text": text, "parse_mode": "HTML"},
                    )
                    if not resp.is_success:
                        logger.warning(f"Telegram send failed to {cid}: {resp.text}")
        except Exception as e:
            logger.warning(f"Telegram notify error: {e}")

    threading.Thread(target=_run, daemon=True).start()


def _targets(*chat_ids) -> list:
    """รวม chat IDs ที่ไม่ซ้ำและไม่ว่าง (strip whitespace อัตโนมัติ)"""
    seen = set()
    result = []
    for cid in chat_ids:
        if not cid:
            continue
        cid = str(cid).strip()   # ตัด space ที่อาจติดมาจาก Railway
        if cid and cid not in seen and cid.lstrip("-").isdigit():
            seen.add(cid)
            result.append(cid)
    return result


# ── Public API ─────────────────────────────────────────

def notify_new_request(request, reporter):
    """แจ้งเตือน: งานแจ้งซ่อมใหม่"""
    s = _get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return

    urgent_flag = "🚨 <b>ด่วน!</b>\n" if request.is_urgent else ""
    inhouse_flag = "👥 <i>มีแขก In House</i>\n" if request.guest_inhouse else ""
    issue = request.issue_type.name if request.issue_type else (request.other_issue or "-")

    text = (
        f"{urgent_flag}"
        f"📢 <b>แจ้งซ่อมใหม่</b>  |  {request.request_number}\n"
        f"─────────────────────\n"
        f"📍 <b>พื้นที่:</b> {_location(request)}\n"
        f"🔧 <b>ประเภท:</b> {issue}\n"
        f"📝 <b>รายละเอียด:</b> {request.description}\n"
        f"👤 <b>ผู้แจ้ง:</b> {reporter.full_name} ({reporter.department})\n"
        f"{inhouse_flag}"
        f"─────────────────────\n"
        f"⏰ สถานะ: {STATUS_TH['pending']}"
    )

    targets = _targets(s.TELEGRAM_GROUP_ALL, s.TELEGRAM_GROUP_REPORTER)
    if targets:
        _send_bg(s.TELEGRAM_BOT_TOKEN, targets, text)


def notify_status_change(request, old_status: str, new_status: str, changed_by, note: str = None):
    """แจ้งเตือน: สถานะงานเปลี่ยน"""
    s = _get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return

    issue = request.issue_type.name if request.issue_type else (request.other_issue or "-")
    old_th = STATUS_TH.get(old_status, old_status)
    new_th = STATUS_TH.get(new_status, new_status)

    text = (
        f"🔄 <b>สถานะงานเปลี่ยน</b>  |  {request.request_number}\n"
        f"─────────────────────\n"
        f"📍 <b>พื้นที่:</b> {_location(request)}\n"
        f"🔧 <b>ประเภท:</b> {issue}\n"
        f"📊 <b>สถานะ:</b> {old_th} → {new_th}\n"
        f"👤 <b>โดย:</b> {changed_by.full_name}\n"
        + (f"💬 <b>หมายเหตุ:</b> {note}\n" if note else "")
        + f"─────────────────────"
    )

    # เลือก group ตามสถานะใหม่
    ids = [s.TELEGRAM_GROUP_ALL]

    if new_status in ("assigned", "in_progress", "rejected", "transferred"):
        ids.append(s.TELEGRAM_GROUP_TECHNICIAN)

    if new_status == "pending_inspection":
        ids.append(s.TELEGRAM_GROUP_INSPECTOR)

    if new_status in ("completed", "cancelled", "reopened", "external_tech", "pending"):
        ids.append(s.TELEGRAM_GROUP_REPORTER)

    targets = _targets(*ids)
    if targets:
        _send_bg(s.TELEGRAM_BOT_TOKEN, targets, text)
