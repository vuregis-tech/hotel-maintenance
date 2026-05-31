import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime, date, timedelta
from collections import Counter

from ..database import get_db
from ..models import MaintenanceRequest, WorkOrder, User, IssueType
from ..schemas import ReportSummary
from ..auth import require_roles

router = APIRouter(prefix="/api/reports", tags=["reports"])


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

    return ReportSummary(
        total=len(all_reqs),
        pending=cs("pending"), assigned=cs("assigned"),
        in_progress=cs("in_progress"),
        pending_inspection=cs("pending_inspection"),
        completed=cs("completed"), reopened=cs("reopened"),
        cancelled=cs("cancelled"), external_tech=cs("external_tech"),
        urgent_count=sum(1 for r in all_reqs if r.is_urgent),
        avg_completion_hours=avg_hours,
    )


@router.get("/list")
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
    reqs = q.order_by(desc(MaintenanceRequest.created_at)).all()

    area_summary = {}
    for r in reqs:
        key = (r.main_area_id, r.sub_area_id)
        main_name = r.main_area.name if r.main_area else "อื่นๆ"
        sub_name = r.sub_area.name if r.sub_area else (r.other_location or "-")
        if key not in area_summary:
            area_summary[key] = {"main_area": main_name, "sub_area": sub_name,
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
                "request_number": r.request_number,
                "reported_at": r.reported_at.isoformat() if r.reported_at else None,
                "main_area": r.main_area.name if r.main_area else "อื่นๆ",
                "sub_area": r.sub_area.name if r.sub_area else (r.other_location or "-"),
                "issue": r.issue_type.name if r.issue_type else (r.other_issue or "-"),
                "description": r.description,
                "status": r.status,
                "is_urgent": r.is_urgent,
                "reporter": r.reporter.full_name if r.reporter else "-",
                "technician": r.work_orders[0].technician.full_name
                              if r.work_orders and r.work_orders[0].technician else "-",
            }
            for r in reqs
        ],
    }


@router.get("/top-assets")
def get_top_assets(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    top_n: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "supervisor")),
):
    """Top N อุปกรณ์/สถานที่ที่เสียบ่อยที่สุด"""
    q = _date_filter(db.query(MaintenanceRequest), MaintenanceRequest, date_from, date_to)
    reqs = q.all()

    # นับตาม issue_type + location (sub_area)
    asset_counter = Counter()
    asset_meta = {}

    for r in reqs:
        issue_name = r.issue_type.name if r.issue_type else (r.other_issue or "ไม่ระบุ")
        location = ""
        if r.main_area:
            location = r.main_area.name
            if r.sub_area:
                location += f" › {r.sub_area.name}"
        elif r.other_location:
            location = r.other_location

        key = f"{issue_name}||{location}"
        asset_counter[key] += 1
        if key not in asset_meta:
            asset_meta[key] = {"issue": issue_name, "location": location}

    top = asset_counter.most_common(top_n)
    result = []
    for key, count in top:
        meta = asset_meta[key]
        # หาจำนวนที่เสร็จและค้าง
        completed = sum(1 for r in reqs
                        if (r.issue_type.name if r.issue_type else (r.other_issue or "ไม่ระบุ")) == meta["issue"]
                        and r.status == "completed")
        result.append({
            "issue": meta["issue"],
            "location": meta["location"],
            "total": count,
            "completed": completed,
            "pending": count - completed,
        })

    return result


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
