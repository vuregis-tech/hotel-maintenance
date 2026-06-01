from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import Token, LoginRequest, UserOut
from ..auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    # case-insensitive username lookup
    user = db.query(User).filter(
        func.lower(User.username) == data.username.strip().lower()
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="ไม่พบชื่อผู้ใช้นี้ในระบบ")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
