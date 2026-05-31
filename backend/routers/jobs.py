import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, timedelta
import os, uuid, aiofiles

from ..database import get_db
from ..models import (MaintenanceRequest, RequestImage, WorkOrder, CoAssignment,
                      Inspection, InspectionImage, RequestHistory, User)
from ..schemas import (RequestCreate, RequestOut, WorkOrderCreate, WorkOrderComplete,
                       WorkOrderReassign, WorkOrderCoAssign, InspectionCreate, RecallBody)
from ..auth import get_current_user, require_roles

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
UPLOAD_DIR = "uploads"


def gen_request_number(db):
    today = datetime.now().strftime("%Y%m%d")
    count = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.request_number.like(f"MR{today}%")).count()
    return f"MR{today}{count + 1:03d}"


def add_history(db, request_id, old_status, new_status, user_id, note=None):
    db.add(RequestHistory(request_id=request_id, old_status=old_status,
                          new_status=new_status, changed_by_id=user_id, note=note))


def save_upload(file_bytes, ext):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(file_bytes)
    return filename


def get_req(db, job_id):
    """Fresh query after commit to avoid SQLite refresh issues"""
    return db.query(MaintenanceRequest).filter(MaintenanceRequest.id == job_id).first()


# ── List / Get ────────────────────────────────────────

@router.get("", response_model=List[RequestOut])
def list_requests(
    status: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MaintenanceRequest)
    if current_user.role == "staff":
        q = q.filter(MaintenanceRequest.reporter_id == current_user.id)
    elif current_user.role == "technician":
        assigned_ids = (db.query(WorkOrder.request_id)
                        .filter(WorkOrder.technician_id == current_user.id).subquery())
        co_ids = (db.query(CoAssignment.work_order_id)
                  .filter(CoAssignment.technician_id == current_user.id).subquery())
        co_req_ids = (db.query(WorkOrder.request_id)
                      .filter(WorkOrder.id.in_(co_ids)).subquery())
        q = q.filter(
            (MaintenanceRequest.id.in_(assigned_ids)) |
            (MaintenanceRequest.id.in_(co_req_ids)) |
            (MaintenanceRequest.status == "pending")
        )
    if status:
        q = q.filter(MaintenanceRequest.status == status)
    return q.order_by(desc(MaintenanceRequest.created_at)).offset(skip).limit(limit).all()


@router.get("/location-history")
def location_history(
    main_area_id: Optional[int] = None,
    sub_area_id: Optional[int] = None,
    other_location: Optional[str] = None,
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now() - timedelta(days=30 * months)
    q = db.query(MaintenanceRequest).filter(MaintenanceRequest.created_at >= since)
    if main_area_id:
        q = q.filter(MaintenanceRequest.main_area_id == main_area_id)
    if sub_area_id:
        q = q.filter(MaintenanceRequest.sub_area_id == sub_area_id)
    if other_location:
        q = q.filter(MaintenanceRequest.other_location.ilike(f"%{other_location}%"))
    reqs = q.order_by(desc(MaintenanceRequest.created_at)).limit(50).all()
    return [
        {
            "request_number": r.request_number,
            "reported_at": r.reported_at.isoformat() if r.reported_at else None,
            "issue": r.issue_type.name if r.issue_type else (r.other_issue or "-"),
            "description": r.description,
            "status": r.status,
            "technician": r.work_orders[0].technician.full_name if r.work_orders else "-",
        }
        for r in reqs
    ]


@router.get("/{job_id}", response_model=RequestOut)
def get_request(job_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    return req


# ── Create ────────────────────────────────────────────

@router.post("", response_model=RequestOut)
def create_request(data: RequestCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    req = MaintenanceRequest(
        request_number=gen_request_number(db),
        reporter_id=current_user.id,
        reported_at=datetime.now(),
        main_area_id=data.main_area_id,
        sub_area_id=data.sub_area_id,
        other_location=data.other_location,
        guest_inhouse=data.guest_inhouse,
        is_urgent=data.is_urgent,
        issue_type_id=data.issue_type_id,
        other_issue=data.other_issue,
        description=data.description,
        status="pending",
    )
    db.add(req)
    db.flush()
    req_id = req.id
    add_history(db, req_id, None, "pending", current_user.id, "สร้างงานใหม่")
    db.commit()
    return get_req(db, req_id)


# ── Upload Image ──────────────────────────────────────

@router.post("/{job_id}/images", response_model=RequestOut)
async def upload_image(job_id: int, file: UploadFile = File(...),
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    if not get_req(db, job_id):
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์รูปภาพ")
    data = await file.read()
    filename = save_upload(data, ext)
    db.add(RequestImage(request_id=job_id, filename=filename))
    db.commit()
    return get_req(db, job_id)


# ── Assign ────────────────────────────────────────────

@router.post("/{job_id}/assign", response_model=RequestOut)
def assign_work(job_id: int, data: WorkOrderCreate,
                db: Session = Depends(get_db),
                current_user: User = Depends(require_roles("supervisor", "admin"))):
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    if req.status not in ("pending", "reopened", "external_tech"):
        raise HTTPException(status_code=400, detail="ไม่สามารถจ่ายงานในสถานะนี้")
    tech = db.query(User).filter(User.id == data.technician_id,
                                 User.role == "technician").first()
    if not tech:
        raise HTTPException(status_code=404, detail="ไม่พบช่าง")

    old_wo = (db.query(WorkOrder)
              .filter(WorkOrder.request_id == job_id,
                      WorkOrder.status.in_(["assigned", "in_progress"]))
              .first())
    if old_wo:
        old_wo.status = "cancelled"

    old_status = req.status
    req.status = "assigned"
    db.add(WorkOrder(request_id=job_id, technician_id=data.technician_id,
                     assigned_by_id=current_user.id, status="assigned"))
    add_history(db, job_id, old_status, "assigned", current_user.id,
                f"จ่ายงานให้ {tech.full_name}")
    db.commit()
    return get_req(db, job_id)


# ── Accept Job ────────────────────────────────────────

@router.post("/{job_id}/accept", response_model=RequestOut)
def accept_job(job_id: int, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    """ช่างกดรับงาน — เฉพาะช่างที่ได้รับ assign เท่านั้น"""
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    if req.status != "assigned":
        raise HTTPException(status_code=400, detail="งานไม่ได้อยู่ในสถานะรอรับ")

    wo = (db.query(WorkOrder)
          .filter(WorkOrder.request_id == job_id,
                  WorkOrder.technician_id == current_user.id,
                  WorkOrder.status == "assigned").first())
    if not wo and current_user.role in ("admin", "supervisor"):
        wo = (db.query(WorkOrder)
              .filter(WorkOrder.request_id == job_id, WorkOrder.status == "assigned").first())
    if not wo:
        raise HTTPException(status_code=403, detail="งานนี้ไม่ได้ถูกมอบหมายให้คุณ")

    wo.status = "in_progress"
    wo.accepted_at = datetime.now()
    req.status = "in_progress"
    add_history(db, job_id, "assigned", "in_progress", current_user.id, "รับงานแล้ว")
    db.commit()
    return get_req(db, job_id)


# ── Recall (ดึงงานกลับ) ───────────────────────────────

@router.post("/{job_id}/recall", response_model=RequestOut)
def recall_job(job_id: int, data: RecallBody,
               db: Session = Depends(get_db),
               current_user: User = Depends(require_roles("supervisor", "admin"))):
    """หัวหน้าช่างดึงงานกลับ — ยกเลิก work order ปัจจุบัน แล้วกลับ pending หรือ re-assign"""
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    if req.status not in ("assigned", "in_progress"):
        raise HTTPException(status_code=400, detail="ดึงงานกลับได้เฉพาะสถานะ 'จ่ายงานแล้ว' หรือ 'กำลังดำเนินการ'")

    # ยกเลิก work order ปัจจุบัน
    active_wos = (db.query(WorkOrder)
                  .filter(WorkOrder.request_id == job_id,
                          WorkOrder.status.in_(["assigned", "in_progress"]))
                  .all())
    recalled_tech_name = ""
    for wo in active_wos:
        recalled_tech_name = wo.technician.full_name if wo.technician else ""
        wo.status = "cancelled"

    old_status = req.status

    if data.new_technician_id:
        # Re-assign ให้ช่างใหม่ทันที
        tech = db.query(User).filter(User.id == data.new_technician_id,
                                     User.role == "technician").first()
        if not tech:
            raise HTTPException(status_code=404, detail="ไม่พบช่าง")
        req.status = "assigned"
        db.add(WorkOrder(request_id=job_id, technician_id=data.new_technician_id,
                         assigned_by_id=current_user.id, status="assigned"))
        note = f"ดึงงานกลับจาก {recalled_tech_name} → Re-assign ให้ {tech.full_name}"
        add_history(db, job_id, old_status, "assigned", current_user.id, note)
    else:
        # กลับไป pending รอจ่ายงานใหม่
        req.status = "pending"
        note = f"ดึงงานกลับจาก {recalled_tech_name}"
        add_history(db, job_id, old_status, "pending", current_user.id, note)

    db.commit()
    return get_req(db, job_id)


# ── Re-assign / Co-assign ──────────────────────────────

@router.put("/{job_id}/reassign", response_model=RequestOut)
def reassign_work(job_id: int, data: WorkOrderReassign,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles("supervisor", "admin"))):
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    if req.status not in ("assigned", "in_progress", "external_tech"):
        raise HTTPException(status_code=400, detail="ไม่สามารถเปลี่ยนช่างในสถานะนี้")
    tech = db.query(User).filter(User.id == data.technician_id,
                                 User.role == "technician").first()
    if not tech:
        raise HTTPException(status_code=404, detail="ไม่พบช่าง")
    wo = (db.query(WorkOrder)
          .filter(WorkOrder.request_id == job_id,
                  WorkOrder.status.in_(["assigned", "in_progress", "external"])).first())
    if wo:
        wo.technician_id = data.technician_id
        wo.status = "assigned"
        wo.accepted_at = None
        wo.is_external = False
    old_status = req.status
    req.status = "assigned"
    add_history(db, job_id, old_status, "assigned", current_user.id,
                f"เปลี่ยนช่างเป็น {tech.full_name}")
    db.commit()
    return get_req(db, job_id)


@router.post("/{job_id}/co-assign", response_model=RequestOut)
def co_assign(job_id: int, data: WorkOrderCoAssign,
              db: Session = Depends(get_db),
              current_user: User = Depends(require_roles("supervisor", "admin"))):
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    tech = db.query(User).filter(User.id == data.technician_id,
                                 User.role == "technician").first()
    if not tech:
        raise HTTPException(status_code=404, detail="ไม่พบช่าง")
    wo = (db.query(WorkOrder)
          .filter(WorkOrder.request_id == job_id,
                  WorkOrder.status.in_(["assigned", "in_progress"])).first())
    if not wo:
        raise HTTPException(status_code=400, detail="ไม่มี work order ที่ active")
    existing = (db.query(CoAssignment)
                .filter(CoAssignment.work_order_id == wo.id,
                        CoAssignment.technician_id == data.technician_id).first())
    if existing:
        raise HTTPException(status_code=400, detail="ช่างคนนี้ถูก co-assign แล้ว")
    db.add(CoAssignment(work_order_id=wo.id, technician_id=data.technician_id))
    add_history(db, job_id, req.status, req.status, current_user.id,
                f"เพิ่มช่างร่วม: {tech.full_name}")
    db.commit()
    return get_req(db, job_id)


@router.delete("/{job_id}/co-assign/{co_id}", response_model=RequestOut)
def remove_co_assign(job_id: int, co_id: int,
                     db: Session = Depends(get_db),
                     current_user: User = Depends(require_roles("supervisor", "admin"))):
    co = db.query(CoAssignment).filter(CoAssignment.id == co_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="ไม่พบ co-assignment")
    db.delete(co)
    db.commit()
    return get_req(db, job_id)


# ── Complete Work ─────────────────────────────────────

@router.put("/{job_id}/complete", response_model=RequestOut)
def complete_work(job_id: int, data: WorkOrderComplete,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")

    # เฉพาะช่างที่ได้รับ assign โดยตรงเท่านั้นที่บันทึกการซ่อมได้
    wo = (db.query(WorkOrder)
          .filter(WorkOrder.request_id == job_id,
                  WorkOrder.technician_id == current_user.id,
                  WorkOrder.status.in_(["assigned", "in_progress"])).first())
    # admin/supervisor มีสิทธิ์ override (แต่ต้องมี work order อยู่)
    if not wo and current_user.role in ("admin", "supervisor"):
        wo = (db.query(WorkOrder)
              .filter(WorkOrder.request_id == job_id,
                      WorkOrder.status.in_(["assigned", "in_progress"])).first())
    if not wo:
        raise HTTPException(
            status_code=403,
            detail="เฉพาะช่างที่ได้รับมอบหมายงานเท่านั้นที่สามารถบันทึกการซ่อมได้"
        )

    materials_json = None
    total_cost = 0.0
    if data.materials:
        materials_json = json.dumps(
            [m.model_dump() for m in data.materials], ensure_ascii=False)
        total_cost = sum(m.qty * m.unit_cost for m in data.materials)

    wo.repair_details = data.repair_details
    wo.materials_used = materials_json
    wo.total_cost = total_cost if total_cost > 0 else None
    wo.ooo_room = data.ooo_room
    wo.ooo_days = data.ooo_days
    wo.completed_at = datetime.now()

    old_status = req.status
    if data.is_external:
        wo.is_external = True
        wo.external_note = data.external_note
        wo.status = "external"
        req.status = "external_tech"
        add_history(db, job_id, old_status, "external_tech", current_user.id,
                    f"ต้องใช้ช่างภายนอก: {data.external_note or ''}")
    else:
        wo.is_external = False
        wo.status = "completed"
        req.status = "pending_inspection"
        add_history(db, job_id, old_status, "pending_inspection", current_user.id,
                    "ซ่อมเสร็จ รอตรวจ")
    db.commit()
    return get_req(db, job_id)


# ── Inspection ────────────────────────────────────────

@router.post("/{job_id}/inspect", response_model=RequestOut)
def inspect_work(job_id: int, data: InspectionCreate,
                 db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    if req.status != "pending_inspection":
        raise HTTPException(status_code=400, detail="งานไม่อยู่ในสถานะรอตรวจ")
    if data.result not in ("pass", "fail"):
        raise HTTPException(status_code=400, detail="ผลต้องเป็น pass หรือ fail")

    insp = Inspection(request_id=job_id, inspector_id=current_user.id,
                      result=data.result, notes=data.notes)
    db.add(insp)
    old_status = req.status
    if data.result == "pass":
        req.status = "completed"
        add_history(db, job_id, old_status, "completed", current_user.id, data.notes)
    else:
        req.status = "reopened"
        add_history(db, job_id, old_status, "reopened", current_user.id,
                    f"ตรวจไม่ผ่าน: {data.notes or ''}")
    db.commit()
    return get_req(db, job_id)


@router.post("/{job_id}/inspect-images", response_model=RequestOut)
async def upload_inspection_image(
    job_id: int, inspection_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    insp = (db.query(Inspection)
            .filter(Inspection.id == inspection_id, Inspection.request_id == job_id).first())
    if not insp:
        raise HTTPException(status_code=404, detail="ไม่พบการตรวจ")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="รองรับเฉพาะรูปภาพ")
    data = await file.read()
    filename = save_upload(data, ext)
    db.add(InspectionImage(inspection_id=insp.id, filename=filename))
    db.commit()
    return get_req(db, job_id)


# ── Cancel ────────────────────────────────────────────

@router.put("/{job_id}/cancel", response_model=RequestOut)
def cancel_request(job_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    req = get_req(db, job_id)
    if not req:
        raise HTTPException(status_code=404, detail="ไม่พบงาน")
    if req.status not in ("pending",) and current_user.role not in ("admin",):
        raise HTTPException(status_code=400, detail="ไม่สามารถยกเลิกในสถานะนี้")
    if current_user.role == "staff" and req.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ยกเลิกงานนี้")
    old_status = req.status
    req.status = "cancelled"
    add_history(db, job_id, old_status, "cancelled", current_user.id, "ยกเลิกงาน")
    db.commit()
    return get_req(db, job_id)
