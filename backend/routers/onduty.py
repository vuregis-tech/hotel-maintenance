from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from ..database import get_db
from ..models import OnDutySchedule, User
from ..schemas import OnDutyCreate, OnDutyOut
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/api/onduty", tags=["onduty"])


@router.get("", response_model=List[OnDutyOut])
def list_onduty(duty_date: str = None,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    """ดึงรายชื่อช่าง On Duty — ถ้าไม่ระบุวัน จะใช้วันนี้"""
    target = duty_date or date.today().isoformat()
    return (db.query(OnDutySchedule)
            .filter(OnDutySchedule.duty_date == target)
            .all())


@router.get("/month", response_model=List[OnDutyOut])
def list_onduty_month(year: int, month: int,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    """ดึงรายชื่อช่าง On Duty ทั้งเดือน"""
    prefix = f"{year:04d}-{month:02d}-"
    return (db.query(OnDutySchedule)
            .filter(OnDutySchedule.duty_date.like(f"{prefix}%"))
            .order_by(OnDutySchedule.duty_date)
            .all())


@router.post("", response_model=OnDutyOut)
def set_onduty(data: OnDutyCreate,
               db: Session = Depends(get_db),
               current_user: User = Depends(require_roles("supervisor", "admin"))):
    """กำหนดช่าง On Duty วันที่ระบุ"""
    tech = db.query(User).filter(User.id == data.technician_id,
                                 User.role == "technician").first()
    if not tech:
        raise HTTPException(status_code=404, detail="ไม่พบช่าง")
    existing = (db.query(OnDutySchedule)
                .filter(OnDutySchedule.technician_id == data.technician_id,
                        OnDutySchedule.duty_date == data.duty_date).first())
    if existing:
        raise HTTPException(status_code=400, detail="ช่างคนนี้มี On Duty วันนี้แล้ว")
    record = OnDutySchedule(technician_id=data.technician_id,
                            duty_date=data.duty_date,
                            created_by_id=current_user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}")
def remove_onduty(record_id: int,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles("supervisor", "admin"))):
    record = db.query(OnDutySchedule).filter(OnDutySchedule.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="ไม่พบรายการ")
    db.delete(record)
    db.commit()
    return {"ok": True}


@router.get("/me/today")
def am_i_on_duty(db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    """ตรวจว่า user ปัจจุบัน On Duty วันนี้ไหม"""
    today = date.today().isoformat()
    record = (db.query(OnDutySchedule)
              .filter(OnDutySchedule.technician_id == current_user.id,
                      OnDutySchedule.duty_date == today).first())
    return {"on_duty": record is not None, "date": today}
