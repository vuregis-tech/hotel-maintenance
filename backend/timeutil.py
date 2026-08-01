"""
Bangkok-time helpers — server บน Railway รันเป็น UTC แต่วันที่/เวลาทางธุรกิจ
(shift times, duty dates, request numbers, "วันนี้") เป็นเวลาไทยทั้งหมด
"""
from datetime import datetime, timedelta


def bangkok_now():
    """คืน datetime เวลา Bangkok (aware ถ้ามี zoneinfo, ไม่งั้น naive UTC+7)"""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo('Asia/Bangkok'))
    except Exception:
        return datetime.utcnow() + timedelta(hours=7)


def bangkok_today_str():
    """วันนี้ตามปฏิทิน Bangkok เป็น 'YYYY-MM-DD'"""
    return bangkok_now().strftime("%Y-%m-%d")


def bangkok_day_start_server_clock(days_ago: int = 0):
    """เที่ยงคืน Bangkok แปลงเป็นนาฬิกาของ server (naive) เพื่อเทียบกับ
    timestamp ที่บันทึกด้วย datetime.now()/func.now() (นาฬิกา server)

    ใช้ offset จริงระหว่างนาฬิกา Bangkok กับนาฬิกา server จึงถูกต้องทั้งบน
    Railway (UTC, offset ~7h) และเครื่อง dev ที่ตั้งเวลาไทยอยู่แล้ว (offset ~0)
    """
    srv_now = datetime.now()
    bkk_now = bangkok_now().replace(tzinfo=None)
    offset = bkk_now - srv_now
    midnight = bkk_now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
    return midnight - offset
