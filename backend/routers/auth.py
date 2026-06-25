import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import Token, LoginRequest, UserOut, ChangePasswordRequest
from ..auth import verify_password, create_access_token, get_current_user, hash_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Rate limiting (in-memory, resets on deploy) ───────────────────────────────
_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_LIMIT = 5
_LOGIN_WINDOW = 60  # seconds


def _check_rate_limit(ip: str):
    now = time.time()
    attempts = _login_attempts[ip]
    attempts[:] = [t for t in attempts if now - t < _LOGIN_WINDOW]
    if len(attempts) >= _LOGIN_LIMIT:
        raise HTTPException(status_code=429, detail="Login ผิดหลายครั้งเกินไป กรุณารอ 1 นาที")
    attempts.append(now)


def _validate_new_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว")
    if not any(c.isalpha() for c in password):
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว")


@router.post("/login", response_model=Token)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    user = db.query(User).filter(
        func.lower(User.username) == data.username.strip().lower()
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="ไม่พบชื่อผู้ใช้นี้ในระบบ")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

    # Clear rate limit on successful login
    _login_attempts.pop(ip, None)

    token = create_access_token({"sub": str(user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
        must_change_password=bool(user.must_change_password),
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="รหัสผ่านเดิมไม่ถูกต้อง")
    _validate_new_password(data.new_password)
    current_user.password_hash = hash_password(data.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"ok": True}
