from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"


# ── User ──────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    department: str
    position: str
    role: str = "staff"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    department: str
    position: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Areas ─────────────────────────────────────────────
class SubAreaOut(BaseModel):
    id: int
    name: str
    is_active: bool

    class Config:
        from_attributes = True


class MainAreaOut(BaseModel):
    id: int
    name: str
    is_active: bool
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
    qty: float = 1
    unit: str = "ชิ้น"
    unit_cost: float = 0.0


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
    ooo_room: bool = False
    ooo_days: Optional[int] = None
    # if True → external technician needed
    is_external: bool = False
    external_note: Optional[str] = None


class WorkOrderReassign(BaseModel):
    technician_id: int


class WorkOrderCoAssign(BaseModel):
    technician_id: int


class RecallBody(BaseModel):
    new_technician_id: Optional[int] = None


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
    ooo_days: Optional[int]
    is_external: bool
    external_note: Optional[str]
    completed_at: Optional[datetime]
    status: str
    co_assignments: List[CoAssignmentOut] = []

    class Config:
        from_attributes = True


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
    issue_type_id: Optional[int] = None
    other_issue: Optional[str] = None
    description: str


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
    urgent_count: int
    avg_completion_hours: Optional[float]


Token.model_rebuild()
