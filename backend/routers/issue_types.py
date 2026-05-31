from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import IssueType, User
from ..schemas import IssueTypeOut, IssueTypeCreate
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/api/issue-types", tags=["issue_types"])


@router.get("", response_model=List[IssueTypeOut])
def list_issue_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(IssueType).filter(IssueType.is_active == True).order_by(IssueType.name).all()


@router.post("", response_model=IssueTypeOut)
def create_issue_type(data: IssueTypeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    it = IssueType(name=data.name)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


@router.put("/{type_id}", response_model=IssueTypeOut)
def update_issue_type(type_id: int, data: IssueTypeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    it = db.query(IssueType).filter(IssueType.id == type_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="ไม่พบประเภทงาน")
    it.name = data.name
    db.commit()
    db.refresh(it)
    return it


@router.delete("/{type_id}")
def delete_issue_type(type_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    it = db.query(IssueType).filter(IssueType.id == type_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="ไม่พบประเภทงาน")
    it.is_active = False
    db.commit()
    return {"ok": True}
