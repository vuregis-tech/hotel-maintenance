from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ReorderRequest(BaseModel):
    ids: List[int]


class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"
    must_change_password: bool = False


# ── User ──────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    department: str
    position: str
    role: str = "staff"
    telegram_username: Optional[str] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    telegram_username: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    department: Optional[str] = None
    position: str
    role: str
    is_active: bool
    must_change_password: bool = False
    telegram_username: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Areas ─────────────────────────────────────────────
class SubAreaOut(BaseModel):
    id: int
    name: str
    is_active: bool
    sort_order: int = 0

    class Config:
        from_attributes = True


class MainAreaOut(BaseModel):
    id: int
    name: str
    is_active: bool
    sort_order: int = 0
    sub_areas: List[SubAreaOut] = []

    class Config:
        from_attributes = True


class AreaCreate(BaseModel):
    name: str


class SubAreaCreate(BaseModel):
    name: str
    main_area_id: int


# ── Issue Types ───────────────────────────────────────
class IssueTypeOut(BaseModel):
    id: int
    name: str
    is_active: bool
    sort_order: int = 0

    class Config:
        from_attributes = True


class IssueTypeCreate(BaseModel):
    name: str


# ── Request Images ────────────────────────────────────
class RequestImageOut(BaseModel):
    id: int
    filename: str   # URL (Cloudinary) หรือ path (/uploads/xxx)
    url: Optional[str] = None   # computed in validator
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ── Materials ─────────────────────────────────────────
class MaterialItem(BaseModel):
    name: str
    qty: float = Field(default=1, ge=0)
    unit: str = "ชิ้น"
    unit_cost: float = Field(default=0, ge=0)

    @field_validator('qty', 'unit_cost', mode='before')
    @classmethod
    def blank_to_default(cls, v, info):
        # input จาก browser อาจส่ง "" มาเมื่อ user เคลียร์ช่องตัวเลข
        if v is None or (isinstance(v, str) and not v.strip()):
            return 1 if info.field_name == 'qty' else 0
        return v


# ── Co-Assignment ─────────────────────────────────────
class CoAssignmentOut(BaseModel):
    id: int
    technician: Optional[UserOut]
    assigned_at: datetime

    class Config:
        from_attributes = True


# ── Work Orders ───────────────────────────────────────
class WorkOrderCreate(BaseModel):
    technician_id: int


class WorkOrderComplete(BaseModel):
    repair_details: str
    materials: Optional[List[MaterialItem]] = None   # structured list
    images: Optional[List[str]] = None               # uploaded URLs for material photos
    ooo_room: bool = False
    ooo_days: Optional[int] = None
    ooo_start_date: Optional[str] = None
    ooo_end_date: Optional[str] = None
    ooo_notified_user_id: Optional[int] = None
    # if True → external technician needed
    is_external: bool = False
    external_note: Optional[str] = None
    # False = บันทึกระหว่างทำ (คงสถานะ in_progress), True = เสร็จแล้วพร้อมส่งตรวจ
    is_complete: bool = True


class WorkOrderReassign(BaseModel):
    technician_id: int


class WorkOrderCoAssign(BaseModel):
    technician_id: int


class RecallBody(BaseModel):
    new_technician_id: Optional[int] = None


class RejectBody(BaseModel):
    reason: str


class TransferBody(BaseModel):
    technician_id: int
    note: Optional[str] = None


class RepairLogOut(BaseModel):
    id: int
    repair_details: Optional[str] = None
    materials_used: Optional[str] = None
    total_cost: Optional[float] = None
    is_complete: bool = False
    images: List[str] = []
    created_at: datetime
    created_by: Optional[UserOut] = None

    @field_validator('images', mode='before')
    @classmethod
    def parse_images(cls, v):
        if not v:
            return []
        if isinstance(v, list):
            return v
        try:
            import json
            return json.loads(v)
        except Exception:
            return []

    class Config:
        from_attributes = True


class WorkOrderOut(BaseModel):
    id: int
    request_id: int
    technician: Optional[UserOut]
    assigned_by: Optional[UserOut]
    assigned_at: datetime
    accepted_at: Optional[datetime]
    repair_details: Optional[str]
    materials_used: Optional[str]   # JSON string
    total_cost: Optional[float]
    ooo_room: bool
    ooo_days: Optional[int] = None
    ooo_start_date: Optional[str] = None
    ooo_end_date: Optional[str] = None
    ooo_notified_user: Optional[UserOut] = None
    is_external: bool
    external_note: Optional[str]
    completed_at: Optional[datetime]
    status: str
    rejection_reason: Optional[str] = None
    rejected_at: Optional[datetime] = None
    transferred_to: Optional[UserOut] = None
    transfer_note: Optional[str] = None
    co_assignments: List[CoAssignmentOut] = []
    repair_logs: List[RepairLogOut] = []

    class Config:
        from_attributes = True


# ── Departments ───────────────────────────────────────
class DepartmentCreate(BaseModel):
    name: str
    show_in_ooo: bool = False


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    show_in_ooo: Optional[bool] = None
    can_receive_jobs: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    is_active: bool
    show_in_ooo: Optional[bool] = False
    can_receive_jobs: Optional[bool] = False

    class Config:
        from_attributes = True


# ── On-Duty ───────────────────────────────────────────
class OnDutyCreate(BaseModel):
    technician_id: int
    duty_date: str   # YYYY-MM-DD


class OnDutyOut(BaseModel):
    id: int
    technician: Optional[UserOut]
    duty_date: str
    created_by: Optional[UserOut]

    class Config:
        from_attributes = True


# ── Shifts ────────────────────────────────────────────
class ShiftCreate(BaseModel):
    name: str
    start_time: str   # "HH:MM"
    end_time: str     # "HH:MM"
    color: Optional[str] = "#3B82F6"
    sort_order: Optional[int] = 0


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class ShiftOut(BaseModel):
    id: int
    name: str
    start_time: str
    end_time: str
    color: str
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class ShiftAssignmentOut(BaseModel):
    id: int
    shift: ShiftOut
    technician: Optional[UserOut]
    assignment_date: str
    created_by: Optional[UserOut]

    class Config:
        from_attributes = True


class ShiftAssignmentBulkCreate(BaseModel):
    shift_id: int
    technician_ids: List[int]
    date_from: str   # "YYYY-MM-DD"
    date_to: str     # "YYYY-MM-DD"


# ── Inspections ───────────────────────────────────────
class InspectionCreate(BaseModel):
    result: str  # pass or fail
    notes: Optional[str] = None


class InspectionImageOut(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class InspectionOut(BaseModel):
    id: int
    request_id: int
    inspector: Optional[UserOut]
    result: str
    notes: Optional[str]
    created_at: datetime
    images: List[InspectionImageOut] = []

    class Config:
        from_attributes = True


# ── History ───────────────────────────────────────────
class RequestHistoryOut(BaseModel):
    id: int
    old_status: Optional[str]
    new_status: str
    note: Optional[str]
    timestamp: datetime
    changed_by: Optional[UserOut]

    class Config:
        from_attributes = True


# ── Maintenance Request ───────────────────────────────
class RequestCreate(BaseModel):
    main_area_id: Optional[int] = None
    sub_area_id: Optional[int] = None
    other_location: Optional[str] = None
    guest_inhouse: bool = False
    is_urgent: bool = False
    priority: str = "normal"
    scheduled_at: Optional[datetime] = None
    issue_type_id: Optional[int] = None
    other_issue: Optional[str] = None
    description: str


class RequestEdit(BaseModel):
    issue_type_id: Optional[int] = None
    other_issue: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    priority: Optional[str] = None
    guest_inhouse: Optional[bool] = None


class RequestOut(BaseModel):
    id: int
    request_number: str
    reporter: Optional[UserOut]
    reported_at: Optional[datetime]
    main_area: Optional[MainAreaOut]
    sub_area: Optional[SubAreaOut]
    other_location: Optional[str]
    guest_inhouse: bool
    is_urgent: bool
    priority: str = "normal"
    scheduled_at: Optional[datetime] = None
    last_edited_by: Optional[UserOut] = None
    last_edited_at: Optional[datetime] = None
    issue_type: Optional[IssueTypeOut]
    other_issue: Optional[str]
    description: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    images: List[RequestImageOut] = []
    work_orders: List[WorkOrderOut] = []
    inspections: List[InspectionOut] = []
    history: List[RequestHistoryOut] = []

    class Config:
        from_attributes = True


# ── Reports ───────────────────────────────────────────
class ReportSummary(BaseModel):
    total: int
    pending: int
    assigned: int
    in_progress: int
    pending_inspection: int
    completed: int
    reopened: int
    cancelled: int
    external_tech: int
    ooo_count: int
    urgent_count: int
    avg_completion_hours: Optional[float]


Token.model_rebuild()
