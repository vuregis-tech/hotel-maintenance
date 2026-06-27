"""
Telegram Notification Service
ส่ง notification เมื่อมีงานใหม่หรือสถานะเปลี่ยน
"""
import os
import threading
import logging
import httpx
from functools import lru_cache

logger = logging.getLogger(__name__)


def _get_settings():
    from ..config import get_settings
    return get_settings()


def _app_base_url() -> str:
    domain = os.environ.get("RAILWAY_PUBLIC_DOMAIN")
    if domain:
        return f"https://{domain}"
    return _get_settings().APP_URL


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


def _mention(user) -> str:
    """คืน @username ถ้ามี หรือ full_name ถ้าไม่มี"""
    if user and getattr(user, "telegram_username", None):
        return f"@{user.telegram_username}"
    return user.full_name if user else "-"


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

def notify_new_request(request, reporter, supervisors=None, on_duty_techs=None):
    """แจ้งเตือน: งานแจ้งซ่อมใหม่
    supervisors: list[User] — supervisor ทั้งหมด (tag ในกลุ่ม Technician)
    on_duty_techs: list[User] — ช่าง On Duty วันนี้ (tag ในกลุ่ม Technician)
    """
    s = _get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return

    priority = getattr(request, "priority", None)
    if priority == "very_urgent":
        urgent_flag = "🔴 <b>!VERY! URGENT</b>\n"
    elif priority == "urgent" or request.is_urgent:
        urgent_flag = "⚠️ <b>URGENT</b>\n"
    else:
        urgent_flag = ""
    inhouse_flag = "👥 <b>Guest In House</b>\n" if request.guest_inhouse else ""
    issue = request.issue_type.name if request.issue_type else (request.other_issue or "-")
    link = f"{_app_base_url()}/requests/{request.id}"

    body = (
        f"{urgent_flag}"
        f"{inhouse_flag}"
        f"📋 <b>NEW Work Order</b>  |  {request.request_number}\n"
        f"─────────────────────\n"
        f"📍 <b>พื้นที่:</b> {_location(request)}\n"
        f"🔧 <b>ประเภท:</b> {issue}\n"
        f"📝 <b>รายละเอียด:</b> {request.description}\n"
        f"👤 <b>ผู้แจ้ง:</b> {_mention(reporter)} ({reporter.department})\n"
        f"─────────────────────\n"
        f"⏰ สถานะ: {STATUS_TH['pending']}\n"
    )
    suffix = f"🔗 <a href=\"{link}\">ดูรายละเอียดงาน</a>\n."

    # ── ส่งให้ ALL + REPORTER (ไม่มี tag) ──
    text_general = body + suffix
    general_targets = _targets(s.TELEGRAM_GROUP_ALL, s.TELEGRAM_GROUP_REPORTER)
    if general_targets:
        _send_bg(s.TELEGRAM_BOT_TOKEN, general_targets, text_general)

    # ── ส่งให้ TECHNICIAN (มี tag supervisor + on-duty) ──
    tech_target = _targets(s.TELEGRAM_GROUP_TECHNICIAN)
    if tech_target:
        all_tags = list(supervisors or []) + list(on_duty_techs or [])
        seen_ids: set = set()
        unique_tags = [u for u in all_tags
                       if u and not (u.id in seen_ids or seen_ids.add(u.id))]  # type: ignore[func-returns-value]
        if unique_tags:
            mentions = " ".join(_mention(u) for u in unique_tags)
            text_tech = body + f"🔔 {mentions}\n" + suffix
        else:
            text_tech = text_general
        # หลีกเลี่ยงส่ง 2 ครั้งถ้าเป็น group เดียวกับ general
        tech_only = [t for t in tech_target if t not in set(general_targets)]
        if tech_only:
            _send_bg(s.TELEGRAM_BOT_TOKEN, tech_only, text_tech)
        elif unique_tags:
            # กลุ่มซ้ำกัน แต่มี tag — ส่งเวอร์ชัน tag แทนของที่ส่งไปแล้ว (ส่งเพิ่ม)
            _send_bg(s.TELEGRAM_BOT_TOKEN, tech_target, text_tech)


def _fmt_date(d: str) -> str:
    """แปลง YYYY-MM-DD → D Mon YYYY (ภาษาอังกฤษ)"""
    if not d:
        return "-"
    try:
        from datetime import datetime
        return datetime.strptime(d, "%Y-%m-%d").strftime("%-d %b %Y")
    except Exception:
        return d


def notify_ooo(request, technician, ooo_start_date, ooo_end_date, approver=None):
    """แจ้งเตือน: ปิดห้อง OOO — ส่งให้ ALL + REPORTER พร้อม tag ผู้แจ้ง + Approver"""
    s = _get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return

    issue = request.issue_type.name if request.issue_type else (request.other_issue or "-")
    link = f"{_app_base_url()}/requests/{request.id}"

    approver_line = f"✅ <b>OOO by:</b> {approver.full_name}\n" if approver else ""

    tag_users = [u for u in [request.reporter, approver] if u]
    mentions = " ".join(_mention(u) for u in tag_users)
    tag_line = f"🔔 {mentions}\n" if mentions else ""

    text = (
        f"🏨 <b>OOO</b>  |  {request.request_number}\n"
        f"─────────────────────\n"
        f"📍 <b>พื้นที่:</b> {_location(request)}\n"
        f"🔧 <b>ประเภท:</b> {issue}\n"
        f"─────────────────────\n"
        f"🔒 <b>ปิดห้อง:</b> {_fmt_date(ooo_start_date)}\n"
        f"🔓 <b>เปิดห้อง:</b> {_fmt_date(ooo_end_date)}\n"
        f"{approver_line}"
        f"👤 <b>ช่าง:</b> {technician.full_name}\n"
        f"{tag_line}"
        f"─────────────────────\n"
        f"🔗 <a href=\"{link}\">ดูรายละเอียดงาน</a>\n"
        f"."
    )

    targets = _targets(s.TELEGRAM_GROUP_ALL, s.TELEGRAM_GROUP_REPORTER)
    if targets:
        _send_bg(s.TELEGRAM_BOT_TOKEN, targets, text)


def _build_status_body(request, old_status, new_status, changed_by,
                       note_line, tag_line, title):
    """สร้าง body ข้อความ status change (ไม่รวม suffix link)"""
    issue = request.issue_type.name if request.issue_type else (request.other_issue or "-")
    old_th = STATUS_TH.get(old_status, old_status)
    new_th = STATUS_TH.get(new_status, new_status)
    header = title if title else "🔄 <b>UPDATE</b>"
    return (
        f"{header}  |  {request.request_number}\n"
        f"─────────────────────\n"
        f"📍 <b>พื้นที่:</b> {_location(request)}\n"
        f"🔧 <b>ประเภท:</b> {issue}\n"
        f"📊 <b>สถานะ:</b> {old_th} → {new_th}\n"
        f"👤 <b>โดย:</b> {changed_by.full_name}\n"
        f"{tag_line}"
        f"{note_line}"
        f"─────────────────────\n"
    )


def notify_status_change(request, old_status: str, new_status: str, changed_by,
                         note: str = None, tag_user=None, title: str = None,
                         technician_only: bool = False, tech_tag_users=None):
    """แจ้งเตือน: สถานะงานเปลี่ยน

    tag_user        — User หรือ list[User] ที่จะ @mention ในข้อความหลัก
    title           — หัวข้อ HTML (default: UPDATE)
    technician_only — ส่งเฉพาะกลุ่ม Technician (เช่น REJECT)
    tech_tag_users  — ส่งข้อความแยกไปกลุ่ม Technician พร้อม tag เหล่านี้ (เช่น COMPLETED)
    """
    s = _get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return

    link = f"{_app_base_url()}/requests/{request.id}"
    note_line = f"💬 <b>หมายเหตุ:</b> {note}\n" if note else ""
    suffix = f"🔗 <a href=\"{link}\">ดูรายละเอียดงาน</a>\n."

    # สร้าง tag line สำหรับข้อความหลัก
    def _make_tag_line(users):
        if not users:
            return ""
        lst = users if isinstance(users, list) else [users]
        m = " ".join(_mention(u) for u in lst if u)
        return f"🔔 {m}\n" if m else ""

    tag_line = _make_tag_line(tag_user)
    body = _build_status_body(request, old_status, new_status, changed_by,
                              note_line, tag_line, title)
    text = body + suffix

    # ── เลือก group ──
    if technician_only or new_status == "assigned":
        ids = [s.TELEGRAM_GROUP_TECHNICIAN]
    else:
        ids = [s.TELEGRAM_GROUP_ALL]
        if new_status in ("in_progress", "transferred"):
            ids.append(s.TELEGRAM_GROUP_TECHNICIAN)
        if new_status == "pending_inspection":
            ids.append(s.TELEGRAM_GROUP_INSPECTOR)
        if new_status in ("completed", "cancelled", "reopened", "external_tech", "pending"):
            ids.append(s.TELEGRAM_GROUP_REPORTER)

    targets = _targets(*ids)
    if targets:
        _send_bg(s.TELEGRAM_BOT_TOKEN, targets, text)

    # ── ส่งข้อความแยกให้กลุ่ม Technician พร้อม tag (COMPLETED) ──
    if tech_tag_users:
        tech_target = _targets(s.TELEGRAM_GROUP_TECHNICIAN)
        if tech_target:
            tech_tag_line = _make_tag_line(tech_tag_users)
            body_tech = _build_status_body(request, old_status, new_status, changed_by,
                                           note_line, tech_tag_line, title)
            text_tech = body_tech + suffix
            # ส่งให้ tech group — ถ้า group นี้อยู่ใน targets แล้ว ก็ส่งอีกครั้งเป็นเวอร์ชัน tag
            _send_bg(s.TELEGRAM_BOT_TOKEN, tech_target, text_tech)
