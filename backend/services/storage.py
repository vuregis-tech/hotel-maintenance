"""
Image storage service — Cloudinary (production) หรือ local (fallback)
"""
import os
import logging
import cloudinary
import cloudinary.uploader
from ..config import get_settings

logger = logging.getLogger(__name__)
_configured = False


def _configure():
    global _configured
    if _configured:
        return
    s = get_settings()
    if s.CLOUDINARY_CLOUD_NAME and s.CLOUDINARY_API_KEY and s.CLOUDINARY_API_SECRET:
        cloudinary.config(
            cloud_name=s.CLOUDINARY_CLOUD_NAME,
            api_key=s.CLOUDINARY_API_KEY,
            api_secret=s.CLOUDINARY_API_SECRET,
            secure=True,
        )
        _configured = True
        logger.info("Cloudinary configured ✓")
    else:
        logger.warning("Cloudinary not configured — using local storage")


def is_cloudinary_enabled() -> bool:
    _configure()
    return _configured


def _is_railway() -> bool:
    return bool(os.environ.get("RAILWAY_PUBLIC_DOMAIN"))


def upload_image(file_bytes: bytes, folder: str = "hotel-maintenance") -> str:
    """
    อัปโหลดรูป → คืน URL ที่เข้าถึงได้
    - ถ้ามี Cloudinary → อัปโหลดขึ้น cloud, คืน https://res.cloudinary.com/...
    - ถ้าไม่มี และอยู่บน Railway → raise error (local storage ไม่ persist)
    - ถ้าไม่มี และ dev local → บันทึก local, คืน /uploads/filename
    """
    _configure()

    if _configured:
        try:
            result = cloudinary.uploader.upload(
                file_bytes,
                folder=folder,
                resource_type="image",
                quality="auto",
                fetch_format="auto",
            )
            url = result["secure_url"]
            logger.info(f"Uploaded to Cloudinary: {url}")
            return url
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            raise RuntimeError(f"อัปโหลดรูปล้มเหลว: {e}")

    if _is_railway():
        raise RuntimeError(
            "ไม่สามารถบันทึกรูปภาพได้ — กรุณาตั้งค่า CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET ใน Railway environment variables"
        )

    # Local dev fallback only
    import uuid
    os.makedirs("uploads", exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    path = os.path.join("uploads", filename)
    with open(path, "wb") as f:
        f.write(file_bytes)
    logger.info(f"Saved locally: {path}")
    return f"/uploads/{filename}"


def upload_video(file_bytes: bytes, folder: str = "hotel-maintenance", extension: str = ".mp4") -> str:
    """
    อัปโหลดวิดีโอ → คืน URL ที่เข้าถึงได้
    - Cloudinary: resource_type="video"
    - local dev: บันทึก uploads/ ด้วย extension ที่ถูกต้อง
    """
    _configure()

    if _configured:
        try:
            result = cloudinary.uploader.upload(
                file_bytes,
                folder=folder,
                resource_type="video",
            )
            url = result["secure_url"]
            logger.info(f"Video uploaded to Cloudinary: {url}")
            return url
        except Exception as e:
            logger.error(f"Cloudinary video upload failed: {e}")
            raise RuntimeError(f"อัปโหลดวิดีโอล้มเหลว: {e}")

    if _is_railway():
        raise RuntimeError(
            "ไม่สามารถบันทึกวิดีโอได้ — กรุณาตั้งค่า CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET ใน Railway environment variables"
        )

    # Local dev fallback only
    import uuid
    os.makedirs("uploads", exist_ok=True)
    ext = extension if extension.startswith('.') else f'.{extension}'
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join("uploads", filename)
    with open(path, "wb") as f:
        f.write(file_bytes)
    logger.info(f"Video saved locally: {path}")
    return f"/uploads/{filename}"


def get_image_url(stored: str) -> str:
    """แปลง stored value → URL ที่แสดงใน browser"""
    if stored.startswith("http"):
        return stored          # Cloudinary URL — ใช้ได้เลย
    if stored.startswith("/"):
        return stored          # local path — ใช้ได้เลย
    return f"/uploads/{stored}"  # legacy filename only
