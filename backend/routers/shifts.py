from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timedelta, date as date_type

from ..database import get_db
from ..models import Shift, ShiftAssignment, OnDutySchedule, User
from ..schemas import ShiftOut, ShiftCreate, ShiftUpdate, ShiftAssignmentOut, ShiftAssignmentBulkCreate
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/api/shifts", tags=["shifts"])


# ── Shift Definitions ─────────────────────────────────

@router.get("", response_model=List[ShiftOut])
def list_shifts(include_inactive: bool = False,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    q = db.query(Shift)
    if not include_inactive:
        q = q.filter(Shift.is_active == True)
    return q.order_by(Shift.sort_order, Shift.start_time, Shift.id).all()


@router.post("", response_model=ShiftOut)
def create_shift(data: ShiftCreate,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles("admin", "supervisor"))):
    shift = Shift(**data.model_dump())
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.put("/{shift_id}", response_model=ShiftOut)
def update_shift(shift_id: int, data: ShiftUpdate,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles("admin", "supervisor"))):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="ไม่พบ Shift")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(shift, k, v)
    db.commit()
    db.refresh(shift)
    return shift


@router.delete("/{shift_id}")
def delete_shift(shift_id: int,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(require_roles("admin", "supervisor"))):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="ไม่พบ Shift")
    # Soft-delete: mark inactive, leave assignments intact for history
    shift.is_active = False
    db.commit()
    return {"ok": True}


# ── Shift Assignments ─────────────────────────────────

@router.get("/assignments", response_model=List[ShiftAssignmentOut])
def list_assignments(year: int, month: int,
                     db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    """รายการ assignments ในเดือนที่ระบุ"""
    prefix = f"{year:04d}-{month:02d}-"
    return (db.query(ShiftAssignment)
            .filter(ShiftAssignment.assignment_date.like(f"{prefix}%"))
            .order_by(ShiftAssignment.assignment_date, ShiftAssignment.shift_id)
            .all())


@router.post("/assignments/bulk", response_model=List[ShiftAssignmentOut])
def bulk_create_assignments(data: ShiftAssignmentBulkCreate,
                             db: Session = Depends(get_db),
                             current_user: User = Depends(require_roles("admin", "supervisor"))):
    """สร้าง assignments ช่วงวันที่ × หลายคน (skip ถ้าซ้ำ)"""
    shift = db.query(Shift).filter(Shift.id == data.shift_id, Shift.is_active == True).first()
    if not shift:
        raise HTTPException(status_code=404, detail="ไม่พบ Shift")

    try:
        d_from = date_type.fromisoformat(data.date_from)
        d_to = date_type.fromisoformat(data.date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="รูปแบบวันที่ไม่ถูกต้อง")

    if d_from > d_to:
        d_from, d_to = d_to, d_from

    delta = (d_to - d_from).days + 1
    if delta > 366:
        raise HTTPException(status_code=400, detail="ช่วงวันที่ไม่ควรเกิน 1 ปี")

    # Verify all technician_ids exist and are technicians/supervisors
    for tid in data.technician_ids:
        tech = db.query(User).filter(User.id == tid, User.is_active == True,
                                     User.role.in_(["technician", "supervisor"])).first()
        if not tech:
            raise HTTPException(status_code=404, detail=f"ไม่พบช่าง id={tid}")

    created = []
    for i in range(delta):
        date_str = (d_from + timedelta(days=i)).isoformat()
        for tech_id in data.technician_ids:
            exists = db.query(ShiftAssignment).filter(
                ShiftAssignment.shift_id == data.shift_id,
                ShiftAssignment.technician_id == tech_id,
                ShiftAssignment.assignment_date == date_str
            ).first()
            if not exists:
                a = ShiftAssignment(
                    shift_id=data.shift_id,
                    technician_id=tech_id,
                    assignment_date=date_str,
                    created_by_id=current_user.id
                )
                db.add(a)
                created.append(a)

    db.commit()
    if not created:
        return []
    created_ids = [a.id for a in created]
    return (db.query(ShiftAssignment)
            .options(joinedload(ShiftAssignment.shift),
                     joinedload(ShiftAssignment.technician),
                     joinedload(ShiftAssignment.created_by))
            .filter(ShiftAssignment.id.in_(created_ids))
            .all())


@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles("admin", "supervisor"))):
    a = db.query(ShiftAssignment).filter(ShiftAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="ไม่พบรายการ")
    db.delete(a)
    db.commit()
    return {"ok": True}


# ── On-duty now (used by JobDrawer assign modal) ──────

@router.get("/on-duty-now")
def get_on_duty_now(db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    """ช่างที่กำลัง On Shift ตอนนี้ — รองรับ Shift ข้ามวัน"""
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo('Asia/Bangkok'))
    except Exception:
        now = datetime.utcnow() + timedelta(hours=7)
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now.date() - timedelta(days=1)).isoformat()
    current_time = now.strftime("%H:%M")

    shifts = db.query(Shift).filter(Shift.is_active == True).all()

    # Fallback: ยังไม่ได้ config Shift ใหม่ → ใช้ OnDutySchedule เดิม
    if not shifts:
        rows = db.query(OnDutySchedule).filter(
            OnDutySchedule.duty_date == today_str
        ).all()
        return {"technician_ids": [r.technician_id for r in rows]}

    active_ids: set[int] = set()

    for shift in shifts:
        is_overnight = shift.end_time <= shift.start_time  # e.g. 23:00 → 07:00
        if is_overnight:
            # Still in shift that started yesterday
            if current_time < shift.end_time:
                rows = db.query(ShiftAssignment).filter(
                    ShiftAssignment.shift_id == shift.id,
                    ShiftAssignment.assignment_date == yesterday_str
                ).all()
                active_ids.update(r.technician_id for r in rows)
            # Shift started today and still running (past midnight tomorrow)
            if current_time >= shift.start_time:
                rows = db.query(ShiftAssignment).filter(
                    ShiftAssignment.shift_id == shift.id,
                    ShiftAssignment.assignment_date == today_str
                ).all()
                active_ids.update(r.technician_id for r in rows)
        else:
            if shift.start_time <= current_time < shift.end_time:
                rows = db.query(ShiftAssignment).filter(
                    ShiftAssignment.shift_id == shift.id,
                    ShiftAssignment.assignment_date == today_str
                ).all()
                active_ids.update(r.technician_id for r in rows)

    return {"technician_ids": list(active_ids)}
