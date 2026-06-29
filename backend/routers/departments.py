from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Department
from ..schemas import DepartmentCreate, DepartmentUpdate, DepartmentOut
from ..auth import get_current_user, require_roles
from ..models import User

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    return db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()


@router.post("", response_model=DepartmentOut)
def create_department(data: DepartmentCreate,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles("admin"))):
    if db.query(Department).filter(Department.name == data.name.strip()).first():
        raise HTTPException(status_code=400, detail="ชื่อแผนกซ้ำ")
    dept = Department(name=data.name.strip(), show_in_ooo=data.show_in_ooo)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: int, data: DepartmentUpdate,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles("admin"))):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="ไม่พบแผนก")
    if data.name is not None and data.name.strip():
        old_name = dept.name
        new_name = data.name.strip()
        dept.name = new_name
        # sync users ที่มี department ชื่อเดิม
        if old_name != new_name:
            db.query(User).filter(User.department == old_name).update({"department": new_name})
    if data.show_in_ooo is not None:
        dept.show_in_ooo = data.show_in_ooo
    if data.can_receive_jobs is not None:
        dept.can_receive_jobs = data.can_receive_jobs
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{dept_id}")
def delete_department(dept_id: int,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(require_roles("admin"))):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="ไม่พบแผนก")
    # Clear department from users so future jobs don't carry a deleted dept name
    db.query(User).filter(User.department == dept.name).update({"department": None})
    dept.is_active = False
    db.commit()
    return {"ok": True}
