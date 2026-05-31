from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import MainArea, SubArea
from ..schemas import MainAreaOut, SubAreaOut, AreaCreate, SubAreaCreate
from ..auth import get_current_user, require_roles
from ..models import User

router = APIRouter(prefix="/api/areas", tags=["areas"])


@router.get("", response_model=List[MainAreaOut])
def list_areas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MainArea).filter(MainArea.is_active == True).order_by(MainArea.name).all()


@router.post("", response_model=MainAreaOut)
def create_area(data: AreaCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    area = MainArea(name=data.name)
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.put("/{area_id}", response_model=MainAreaOut)
def update_area(area_id: int, data: AreaCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    area = db.query(MainArea).filter(MainArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="ไม่พบพื้นที่")
    area.name = data.name
    db.commit()
    db.refresh(area)
    return area


@router.delete("/{area_id}")
def delete_area(area_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    area = db.query(MainArea).filter(MainArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="ไม่พบพื้นที่")
    area.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/sub", response_model=SubAreaOut)
def create_sub_area(data: SubAreaCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    parent = db.query(MainArea).filter(MainArea.id == data.main_area_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="ไม่พบพื้นที่หลัก")
    sub = SubArea(name=data.name, main_area_id=data.main_area_id)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/sub/{sub_id}", response_model=SubAreaOut)
def update_sub_area(sub_id: int, data: AreaCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    sub = db.query(SubArea).filter(SubArea.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="ไม่พบพื้นที่ย่อย")
    sub.name = data.name
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/sub/{sub_id}")
def delete_sub_area(sub_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    sub = db.query(SubArea).filter(SubArea.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="ไม่พบพื้นที่ย่อย")
    sub.is_active = False
    db.commit()
    return {"ok": True}
