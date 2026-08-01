"""
Client สำหรับเรียก Inventory Stock app (server-to-server)

ใช้ตอน Work Order บันทึก material เพื่อตัด/คืน stock แบบ idempotent
ออกแบบให้ "ไม่มีวัน raise" — ถ้า Inventory ล่ม/timeout จะคืน None
เพื่อไม่ให้การบันทึกงานซ่อมล้มเหลวเพราะระบบ stock
"""
import logging
import httpx
from ..config import get_settings

logger = logging.getLogger(__name__)


def sync_materials(submission_id: str, work_order_id: str, reference_no: str,
                   materials: list[dict]) -> dict | None:
    """
    แจ้ง Inventory ให้ตัด stock ตามวัสดุที่ใช้ในการบันทึกครั้งนี้ (additive)

    submission_id: str(RepairLog.id) — ไม่ซ้ำต่อการบันทึกหนึ่งครั้ง (กันตัดซ้ำจาก retry)
    materials: [{"item_id": int, "qty": float}, ...]  (เฉพาะรายการที่มาจากคลัง)
    คืน dict ผลลัพธ์ หรือ None ถ้าติดต่อไม่ได้ — ออกแบบให้ไม่มีวัน raise
    """
    try:
        settings = get_settings()
        base = (settings.INVENTORY_API_URL or "").rstrip("/")
        if not base or not submission_id:
            return None

        lines = []
        for m in (materials or []):
            if not m.get("item_id"):
                continue
            try:
                lines.append({"item_id": int(m["item_id"]), "qty": float(m["qty"])})
            except (TypeError, ValueError):
                continue  # ข้ามแถวที่จำนวนไม่ถูกต้อง — ไม่ให้ทั้งงานพัง

        if not lines:
            return None  # ไม่มีวัสดุจากคลัง → ไม่ต้องเรียก

        payload = {
            "submission_id": str(submission_id),
            "work_order_id": work_order_id or "",
            "reference_no": reference_no or "",
            "materials": lines,
        }

        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                f"{base}/api/integration/sync-materials",
                json=payload,
                headers={"X-API-Key": settings.INVENTORY_API_KEY},
            )
        if resp.status_code == 200:
            return resp.json()
        logger.warning("Inventory sync failed [%s]: %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("Inventory sync unreachable: %s", e)
    return None
