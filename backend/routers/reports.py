import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc, or_
from typing import Optional, List
from datetime import datetime, date, timedelta
from collections import Counter

from ..database import get_db
from ..models import MaintenanceRequest, WorkOrder, User, IssueType, RepairLog
from ..schemas import ReportSummary, RequestOut
from ..auth import require_roles
from ..timeutil import bangkok_now

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _latest_active_wo(r):
    """WO ตัวล่าสุดที่ไม่ถูก reject/transfer/cancel — ตัวที่รับผิดชอบงานจริง"""
    wos = sorted(r.work_orders, key=lambda w: w.id)
    for w in reversed(wos):
        if w.status not in ("rejected", "transferred", "cancelled"):
            return w
    return wos[-1] if wos else None


def _date_filter(q, model, date_from, date_to):
    if date_from:
        q = q.filter(model.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.filter(model.created_at <= datetime.combine(date_to, datetime.max.time()))
    return q


@router.get("/summary", response_model=ReportSummary)
def get_summary(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    q = _date_filter(db.query(MaintenanceRequest), MaintenanceRequest, date_from, date_to)
    all_reqs = q.all()

    def cs(s): return sum(1 for r in all_reqs if r.status == s)

    avg_hours = None
    completed = [r for r in all_reqs if r.status == "completed" and r.reported_at]
    if completed:
        hrs = []
        for r in completed:
            wo = db.query(WorkOrder).filter(WorkOrder.request_id == r.id,
                                            WorkOrder.completed_at != None).first()
            if wo and wo.completed_at:
                hrs.append((wo.completed_at - r.reported_at).total_seconds() / 3600)
        if hrs:
            avg_hours = round(sum(hrs) / len(hrs), 1)

    req_ids = [r.id for r in all_reqs]
    today_str = bangkok_now().strftime("%Y-%m-%d")
    if req_ids:
        ooo_ids = db.query(WorkOrder.request_id).filter(
            WorkOrder.request_id.in_(req_ids),
            WorkOrder.ooo_room == True,
            WorkOrder.status.in_(["assigned", "in_progress", "external"]),
            or_(WorkOrder.ooo_end_date == None, WorkOrder.ooo_end_date >= today_str),
        ).distinct().all()
        ooo_count = len(ooo_ids)
    else:
        ooo_count = 0

    return ReportSummary(
        total=len(all_reqs),
        pending=cs("pending"), assigned=cs("assigned"),
        in_progress=cs("in_progress"),
        pending_inspection=cs("pending_inspection"),
        completed=cs("completed"), reopened=cs("reopened"),
        cancelled=cs("cancelled"), external_tech=cs("external_tech"),
        ooo_count=ooo_count,
        urgent_count=sum(1 for r in all_reqs if r.is_urgent),
        avg_completion_hours=avg_hours,
    )


@router.get("/list", response_model=List[RequestOut])
def get_report_list(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    main_area_id: Optional[int] = None,
    sub_area_id: Optional[int] = None,
    skip: int = 0, limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    q = _date_filter(db.query(MaintenanceRequest), MaintenanceRequest, date_from, date_to)
    if status:
        q = q.filter(MaintenanceRequest.status == status)
    if main_area_id:
        q = q.filter(MaintenanceRequest.main_area_id == main_area_id)
    if sub_area_id:
        q = q.filter(MaintenanceRequest.sub_area_id == sub_area_id)
    q = q.options(
        joinedload(MaintenanceRequest.main_area),
        joinedload(MaintenanceRequest.sub_area),
        joinedload(MaintenanceRequest.issue_type),
        joinedload(MaintenanceRequest.reporter),
        selectinload(MaintenanceRequest.work_orders).joinedload(WorkOrder.technician),
    )
    return q.order_by(desc(MaintenanceRequest.created_at)).offset(skip).limit(limit).all()


@router.get("/technicians")
def get_technician_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    technicians = db.query(User).filter(User.role == "technician",
                                        User.is_active == True).all()
    result = []
    for tech in technicians:
        q = db.query(WorkOrder).filter(WorkOrder.technician_id == tech.id)
        if date_from:
            q = q.filter(WorkOrder.assigned_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            q = q.filter(WorkOrder.assigned_at <= datetime.combine(date_to, datetime.max.time()))
        work_orders = q.all()

        total = len(work_orders)
        completed = [wo for wo in work_orders if wo.status == "completed"]
        pending = [wo for wo in work_orders if wo.status in ("assigned", "in_progress")]
        external = [wo for wo in work_orders if wo.status == "external"]

        # reopen count: งานที่ถูกตีกลับ
        reopen_count = 0
        for wo in work_orders:
            from ..models import RequestHistory
            reopen_count += db.query(RequestHistory).filter(
                RequestHistory.request_id == wo.request_id,
                RequestHistory.new_status == "reopened",
            ).count()

        # เวลาเฉลี่ยซ่อม (accepted → completed)
        avg_hours = None
        hrs = []
        for wo in completed:
            start = wo.accepted_at or wo.assigned_at
            if wo.completed_at and start:
                hrs.append((wo.completed_at - start).total_seconds() / 3600)
        if hrs:
            avg_hours = round(sum(hrs) / len(hrs), 1)

        jobs_detail = []
        for wo in work_orders:
            req = wo.request
            if req:
                jobs_detail.append({
                    "request_number": req.request_number,
                    "reported_at": req.reported_at.isoformat() if req.reported_at else None,
                    "location": (req.main_area.name if req.main_area else "") +
                                (" › " + req.sub_area.name if req.sub_area else "") +
                                (req.other_location or ""),
                    "issue": req.issue_type.name if req.issue_type else (req.other_issue or "-"),
                    "description": req.description,
                    "status": req.status,
                    "is_urgent": req.is_urgent,
                    "assigned_at": wo.assigned_at.isoformat() if wo.assigned_at else None,
                    "accepted_at": wo.accepted_at.isoformat() if wo.accepted_at else None,
                    "completed_at": wo.completed_at.isoformat() if wo.completed_at else None,
                    "total_cost": wo.total_cost,
                    "is_external": wo.is_external,
                    "ooo_room": wo.ooo_room,
                    "ooo_days": wo.ooo_days,
                })

        result.append({
            "id": tech.id,
            "full_name": tech.full_name,
            "position": tech.position,
            "department": tech.department,
            "total": total,
            "completed": len(completed),
            "pending": len(pending),
            "external": len(external),
            "reopen_count": reopen_count,
            "avg_hours": avg_hours,
            "total_cost": sum(wo.total_cost or 0 for wo in completed),
            "jobs": jobs_detail,
        })

    result.sort(key=lambda x: x["total"], reverse=True)
    return result


@router.get("/by-area")
def get_area_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    main_area_id: Optional[int] = None,
    sub_area_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    q = _date_filter(db.query(MaintenanceRequest), MaintenanceRequest, date_from, date_to)
    if main_area_id:
        q = q.filter(MaintenanceRequest.main_area_id == main_area_id)
    if sub_area_id:
        q = q.filter(MaintenanceRequest.sub_area_id == sub_area_id)
    if status:
        q = q.filter(MaintenanceRequest.status == status)
    q = q.options(
        joinedload(MaintenanceRequest.main_area),
        joinedload(MaintenanceRequest.sub_area),
        joinedload(MaintenanceRequest.issue_type),
        joinedload(MaintenanceRequest.reporter),
        selectinload(MaintenanceRequest.work_orders).joinedload(WorkOrder.technician),
    )
    reqs = q.order_by(desc(MaintenanceRequest.created_at)).all()

    area_summary = {}
    for r in reqs:
        main_name = r.main_area.name if r.main_area else "อื่นๆ"
        sub_name = r.sub_area.name if r.sub_area else (r.other_location or "-")
        # งานที่ไม่มี sub_area แยกกลุ่มตามชื่อ other_location — ไม่ให้คนละที่ปนแถวเดียวกัน
        key = (r.main_area_id, r.sub_area_id, sub_name if not r.sub_area_id else None)
        if key not in area_summary:
            area_summary[key] = {"main_area": main_name, "sub_area": sub_name,
                                 "main_area_id": r.main_area_id, "sub_area_id": r.sub_area_id,
                                 "other_location": r.other_location if not r.sub_area_id else None,
                                 "total": 0, "completed": 0, "pending": 0, "urgent": 0}
        area_summary[key]["total"] += 1
        if r.status == "completed":
            area_summary[key]["completed"] += 1
        elif r.status not in ("cancelled",):
            area_summary[key]["pending"] += 1
        if r.is_urgent:
            area_summary[key]["urgent"] += 1

    return {
        "summary": sorted(area_summary.values(), key=lambda x: x["total"], reverse=True),
        "requests": [
            {
                "id": r.id,
                "main_area_id": r.main_area_id,
                "sub_area_id": r.sub_area_id,
                "request_number": r.request_number,
                "reported_at": r.reported_at.isoformat() if r.reported_at else None,
                "main_area": r.main_area.name if r.main_area else "อื่นๆ",
                "sub_area": r.sub_area.name if r.sub_area else (r.other_location or "-"),
                "issue": r.issue_type.name if r.issue_type else (r.other_issue or "-"),
                "description": r.description,
                "status": r.status,
                "is_urgent": r.is_urgent,
                "reporter": r.reporter.full_name if r.reporter else "-",
                "technician": (lambda w: w.technician.full_name if w and w.technician else "-")(_latest_active_wo(r)),
            }
            for r in reqs
        ],
    }


@router.get("/top-assets")
def get_top_assets(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    top_n: int = 5,
    group_by: str = "spot",   # "spot" = ประเภทงาน+สถานที่ (จุดเสียซ้ำ) | "issue" = รวมทั้งโรงแรมตามประเภทงาน
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    """Top N อุปกรณ์/สถานที่ที่เสียบ่อยที่สุด"""
    q = _date_filter(db.query(MaintenanceRequest), MaintenanceRequest, date_from, date_to)
    reqs = q.all()

    # นับตาม issue_type + location (sub_area) — นับเสร็จ/ค้างต่อคู่ (issue, location) ไม่ใช่ต่อ issue อย่างเดียว
    groups = {}
    for r in reqs:
        if r.status == "cancelled":
            continue  # งานยกเลิกไม่นับเป็นความถี่การเสีย
        issue_name = r.issue_type.name if r.issue_type else (r.other_issue or "ไม่ระบุ")
        location = ""
        if r.main_area:
            location = r.main_area.name
            if r.sub_area:
                location += f" › {r.sub_area.name}"
        elif r.other_location:
            location = r.other_location

        key = issue_name if group_by == "issue" else (issue_name, location)
        g = groups.setdefault(key, {
            "issue": issue_name,
            "location": "" if group_by == "issue" else location,
            "loc_set": set(),
            "total": 0, "completed": 0, "pending": 0, "jobs": [],
        })
        g["loc_set"].add(location)
        g["total"] += 1
        if r.status == "completed":
            g["completed"] += 1
        else:
            g["pending"] += 1
        g["jobs"].append({
            "id": r.id,
            "request_number": r.request_number,
            "reported_at": r.reported_at.isoformat() if r.reported_at else None,
            "description": r.description,
            "status": r.status,
            "is_urgent": r.is_urgent,
            "location": location,
        })

    result = sorted(groups.values(), key=lambda g: g["total"], reverse=True)[:top_n]
    for g in result:
        g["locations_count"] = len(g.pop("loc_set"))
        g["jobs"].sort(key=lambda j: j["reported_at"] or "", reverse=True)
    return result


@router.get("/area-history")
def get_area_history(
    main_area_id: Optional[int] = None,
    sub_area_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    """ประวัติการซ่อมของพื้นที่ แยกตามประเภทงาน — jobs รวมรายละเอียดการซ่อมล่าสุด"""
    if not main_area_id and not sub_area_id:
        raise HTTPException(status_code=400, detail="กรุณาระบุพื้นที่")

    q = _date_filter(db.query(MaintenanceRequest), MaintenanceRequest, date_from, date_to)
    if main_area_id:
        q = q.filter(MaintenanceRequest.main_area_id == main_area_id)
    if sub_area_id:
        q = q.filter(MaintenanceRequest.sub_area_id == sub_area_id)
    q = q.options(
        joinedload(MaintenanceRequest.issue_type),
        joinedload(MaintenanceRequest.reporter),
        selectinload(MaintenanceRequest.work_orders).joinedload(WorkOrder.technician),
    )
    reqs = q.order_by(desc(MaintenanceRequest.created_at)).all()

    by_issue = {}
    jobs = []
    for r in reqs:
        issue_name = r.issue_type.name if r.issue_type else (r.other_issue or "ไม่ระบุ")
        b = by_issue.setdefault(issue_name, {
            "issue": issue_name, "issue_type_id": r.issue_type_id,
            "total": 0, "completed": 0,
        })
        b["total"] += 1
        if r.status == "completed":
            b["completed"] += 1

        # ช่างจาก WO ล่าสุดที่ active / ข้อมูลการซ่อมจาก WO ล่าสุดที่มีการบันทึกซ่อมจริง
        wo = _latest_active_wo(r)
        technician = wo.technician.full_name if wo and wo.technician else None
        repaired = next((w for w in sorted(r.work_orders, key=lambda w: w.id, reverse=True)
                         if w.repair_details), None)
        repair_details = repaired.repair_details if repaired else None
        total_cost = repaired.total_cost if repaired else None
        completed_at = repaired.completed_at if repaired else None

        jobs.append({
            "id": r.id,
            "request_number": r.request_number,
            "reported_at": r.reported_at.isoformat() if r.reported_at else None,
            "issue": issue_name,
            "description": r.description,
            "status": r.status,
            "is_urgent": r.is_urgent,
            "reporter": r.reporter.full_name if r.reporter else "-",
            "technician": technician or "-",
            "repair_details": repair_details,
            "total_cost": total_cost,
            "completed_at": completed_at.isoformat() if completed_at else None,
        })

    return {
        "by_issue": sorted(by_issue.values(), key=lambda x: x["total"], reverse=True),
        "jobs": jobs,
    }


@router.get("/staff-kpi")
def get_staff_kpi(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    """Staff Performance KPI"""
    from ..models import RequestHistory
    technicians = db.query(User).filter(User.role == "technician",
                                        User.is_active == True).all()
    result = []
    for tech in technicians:
        q = db.query(WorkOrder).filter(WorkOrder.technician_id == tech.id)
        if date_from:
            q = q.filter(WorkOrder.assigned_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            q = q.filter(WorkOrder.assigned_at <= datetime.combine(date_to, datetime.max.time()))
        wos = q.all()

        completed = [wo for wo in wos if wo.status == "completed"]

        # เวลาเฉลี่ย accepted → completed
        accept_to_complete = []
        assign_to_accept = []
        for wo in completed:
            start = wo.accepted_at or wo.assigned_at
            if wo.completed_at and start:
                accept_to_complete.append((wo.completed_at - start).total_seconds() / 3600)
            if wo.accepted_at and wo.assigned_at:
                assign_to_accept.append((wo.accepted_at - wo.assigned_at).total_seconds() / 60)

        avg_repair = round(sum(accept_to_complete) / len(accept_to_complete), 1) if accept_to_complete else None
        avg_response = round(sum(assign_to_accept) / len(assign_to_accept), 1) if assign_to_accept else None

        # จำนวนครั้งที่ถูกตีกลับ
        reopen_count = 0
        for wo in wos:
            reopen_count += db.query(RequestHistory).filter(
                RequestHistory.request_id == wo.request_id,
                RequestHistory.new_status == "reopened",
            ).count()

        total_cost = sum(wo.total_cost or 0 for wo in completed)

        result.append({
            "id": tech.id,
            "full_name": tech.full_name,
            "position": tech.position,
            "department": tech.department,
            "total_jobs": len(wos),
            "completed": len(completed),
            "pending": len([wo for wo in wos if wo.status in ("assigned", "in_progress")]),
            "external": len([wo for wo in wos if wo.status == "external"]),
            "reopen_count": reopen_count,
            "avg_repair_hours": avg_repair,
            "avg_response_minutes": avg_response,
            "total_cost": round(total_cost, 2),
        })

    result.sort(key=lambda x: x["completed"], reverse=True)
    return result


@router.get("/materials")
def get_materials_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    sub_area_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    """รายงานการใช้วัสดุสิ้นเปลือง"""
    from collections import defaultdict

    if not date_from:
        date_from = bangkok_now().date()
    if not date_to:
        date_to = bangkok_now().date()

    q = (
        db.query(RepairLog)
        .join(WorkOrder, RepairLog.work_order_id == WorkOrder.id)
        .join(MaintenanceRequest, WorkOrder.request_id == MaintenanceRequest.id)
        .filter(RepairLog.created_at >= datetime.combine(date_from, datetime.min.time()))
        .filter(RepairLog.created_at <= datetime.combine(date_to, datetime.max.time()))
        .filter(RepairLog.materials_used.isnot(None))
    )
    if sub_area_id:
        q = q.filter(MaintenanceRequest.sub_area_id == sub_area_id)

    logs = q.all()

    grouped = defaultdict(lambda: {"total_qty": 0.0, "total_cost": 0.0, "usages": []})

    for log in logs:
        try:
            materials = json.loads(log.materials_used)
        except Exception:
            continue
        if not materials:
            continue

        req = log.work_order.request
        main_area = req.main_area.name if req and req.main_area else "อื่นๆ"
        sub_area = (req.sub_area.name if req and req.sub_area
                    else (req.other_location if req else None) or "-")

        for mat in materials:
            name = (mat.get("name") or "").strip()
            unit = mat.get("unit") or "ชิ้น"
            qty = float(mat.get("qty") or 0)
            unit_cost = float(mat.get("unit_cost") or 0)
            if not name or qty <= 0:
                continue
            key = f"{name}||{unit}"
            grouped[key]["name"] = name
            grouped[key]["unit"] = unit
            grouped[key]["total_qty"] += qty
            grouped[key]["usages"].append({
                "repair_log_id": log.id,
                "date": log.created_at.isoformat(),
                "qty": qty,
                "main_area": main_area,
                "sub_area": sub_area,
                "request_number": req.request_number if req else "-",
                "recorded_by": log.created_by.full_name if log.created_by else "-",
            })

    items = []
    for v in grouped.values():
        v["total_qty"] = round(v["total_qty"], 4)
        items.append(v)
    items.sort(key=lambda x: x["total_qty"], reverse=True)

    return {
        "items": items,
        "total_entries": sum(len(i["usages"]) for i in items),
    }
