from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from ..database import get_db
from ..models import User, Department
from ..schemas import UserCreate, UserUpdate, UserOut
from ..auth import get_current_user, hash_password, require_roles

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"admin", "supervisor", "technician", "staff"}


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin", "supervisor"))):
    return db.query(User).filter(User.is_active == True).order_by(User.full_name).all()


@router.get("/technicians", response_model=List[UserOut])
def list_technicians(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    can_receive_depts = [d.name for d in db.query(Department).filter(
        Department.can_receive_jobs == True, Department.is_active == True).all()]
    conditions = [User.role == "technician"]
    if can_receive_depts:
        conditions.append(User.department.in_(can_receive_depts))
    return (db.query(User)
              .filter(User.is_active == True, or_(*conditions))
              .order_by(User.full_name).all())


@router.get("/ooo-notify", response_model=List[UserOut])
def list_ooo_notify_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """User ในแผนกที่ติ๊ก 'แสดงชื่อตอนปิด OOO' — ใช้ใน dropdown ผู้รับแจ้ง"""
    dept_names = [d.name for d in db.query(Department).filter(
        Department.show_in_ooo == True, Department.is_active == True).all()]
    if not dept_names:
        return []
    return db.query(User).filter(
        User.department.in_(dept_names), User.is_active == True).order_by(User.full_name).all()


@router.post("", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="บทบาทไม่ถูกต้อง")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="ชื่อผู้ใช้นี้มีอยู่แล้ว")
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        department=data.department,
        position=data.position,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    if data.username is not None and data.username.strip():
        new_username = data.username.strip()
        if new_username != user.username:
            if db.query(User).filter(User.username == new_username).first():
                raise HTTPException(status_code=400, detail="ชื่อผู้ใช้นี้มีอยู่แล้ว")
            user.username = new_username
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.department is not None:
        user.department = data.department
    if data.position is not None:
        user.position = data.position
    if data.role is not None:
        if data.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="บทบาทไม่ถูกต้อง")
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password:
        user.password_hash = hash_password(data.password)
    if data.telegram_username is not None:
        val = data.telegram_username.strip().lstrip("@") or None
        user.telegram_username = val
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="ไม่สามารถลบบัญชีตัวเองได้")
    user.is_active = False
    db.commit()
    return {"ok": True}
