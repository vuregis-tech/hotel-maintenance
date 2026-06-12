from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False, default="")
    position = Column(String(100), nullable=False, default="")
    # roles: admin, supervisor, technician, staff
    role = Column(String(20), nullable=False, default="staff")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reported_requests = relationship("MaintenanceRequest", foreign_keys="MaintenanceRequest.reporter_id", back_populates="reporter")
    assigned_orders = relationship("WorkOrder", foreign_keys="WorkOrder.assigned_by_id", back_populates="assigned_by")
    technician_orders = relationship("WorkOrder", foreign_keys="WorkOrder.technician_id", back_populates="technician")
    inspections = relationship("Inspection", foreign_keys="Inspection.inspector_id", back_populates="inspector")
    co_assignments = relationship("CoAssignment", foreign_keys="CoAssignment.technician_id", back_populates="technician")


class MainArea(Base):
    __tablename__ = "main_areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)

    sub_areas = relationship("SubArea", back_populates="main_area", cascade="all, delete-orphan")
    requests = relationship("MaintenanceRequest", back_populates="main_area")


class SubArea(Base):
    __tablename__ = "sub_areas"

    id = Column(Integer, primary_key=True, index=True)
    main_area_id = Column(Integer, ForeignKey("main_areas.id"), nullable=False)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)

    main_area = relationship("MainArea", back_populates="sub_areas")
    requests = relationship("MaintenanceRequest", back_populates="sub_area")


class IssueType(Base):
    __tablename__ = "issue_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)

    requests = relationship("MaintenanceRequest", back_populates="issue_type")


# statuses: pending, assigned, in_progress, external_tech, pending_inspection,
#           completed, reopened, cancelled
class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(20), unique=True, index=True, nullable=False)

    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_at = Column(DateTime(timezone=True), nullable=True)

    main_area_id = Column(Integer, ForeignKey("main_areas.id"), nullable=True)
    sub_area_id = Column(Integer, ForeignKey("sub_areas.id"), nullable=True)
    other_location = Column(String(200), nullable=True)

    guest_inhouse = Column(Boolean, default=False)
    is_urgent = Column(Boolean, default=False)

    issue_type_id = Column(Integer, ForeignKey("issue_types.id"), nullable=True)
    other_issue = Column(String(200), nullable=True)
    description = Column(Text, nullable=False)

    priority = Column(String(20), nullable=False, default="normal")  # normal, urgent, very_urgent
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    last_edited_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_edited_at = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(30), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reported_requests")
    last_edited_by = relationship("User", foreign_keys=[last_edited_by_id])
    main_area = relationship("MainArea", back_populates="requests")
    sub_area = relationship("SubArea", back_populates="requests")
    issue_type = relationship("IssueType", back_populates="requests")
    images = relationship("RequestImage", back_populates="request", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="request", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="request", cascade="all, delete-orphan")
    history = relationship("RequestHistory", back_populates="request", cascade="all, delete-orphan")


class RequestImage(Base):
    __tablename__ = "request_images"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("MaintenanceRequest", back_populates="images")


class Department(Base):
    """แผนกที่ Admin จัดการได้"""
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    show_in_ooo = Column(Boolean, default=False)  # แสดงชื่อ user ใน dropdown ผู้รับแจ้งตอนปิด OOO
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OnDutySchedule(Base):
    """ตารางช่าง On Duty รายวัน"""
    __tablename__ = "on_duty_schedules"

    id = Column(Integer, primary_key=True, index=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    duty_date = Column(String(10), nullable=False)   # YYYY-MM-DD
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    technician = relationship("User", foreign_keys=[technician_id], overlaps="created_by")
    created_by = relationship("User", foreign_keys=[created_by_id], overlaps="technician")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)   # tech pressed "รับงาน"

    repair_details = Column(Text, nullable=True)
    # materials stored as JSON: [{"name":"..","qty":1,"unit":"..","unit_cost":0}]
    materials_used = Column(Text, nullable=True)
    total_cost = Column(Float, nullable=True)
    ooo_room = Column(Boolean, default=False)
    ooo_days = Column(Integer, nullable=True)
    ooo_start_date = Column(String(10), nullable=True)   # YYYY-MM-DD
    ooo_end_date = Column(String(10), nullable=True)     # YYYY-MM-DD
    ooo_notified_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_external = Column(Boolean, default=False)   # ต้องใช้ช่างภายนอก
    external_note = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    # statuses: assigned, in_progress, completed, external, rejected, transferred
    status = Column(String(20), nullable=False, default="assigned")
    # ข้อ 4: ปฏิเสธงาน
    rejection_reason = Column(Text, nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    # ข้อ 6: โอนงานต่อ
    transferred_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    transfer_note = Column(Text, nullable=True)

    request = relationship("MaintenanceRequest", back_populates="work_orders")
    technician = relationship("User", foreign_keys=[technician_id], back_populates="technician_orders")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], back_populates="assigned_orders")
    transferred_to = relationship("User", foreign_keys=[transferred_to_id],
                                  overlaps="technician,technician_orders,assigned_by,assigned_orders")
    ooo_notified_user = relationship("User", foreign_keys=[ooo_notified_user_id],
                                     overlaps="technician,technician_orders,assigned_by,assigned_orders,transferred_to")
    co_assignments = relationship("CoAssignment", back_populates="work_order", cascade="all, delete-orphan")
    repair_logs = relationship("RepairLog", back_populates="work_order",
                               order_by="RepairLog.created_at", cascade="all, delete-orphan")


class RepairLog(Base):
    """บันทึกการซ่อมแบบ series — ไม่ทับของเก่า"""
    __tablename__ = "repair_logs"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    repair_details = Column(Text, nullable=False)
    materials_used = Column(Text, nullable=True)  # JSON
    total_cost = Column(Float, nullable=True)
    is_complete = Column(Boolean, default=False)  # True = ส่งตรวจแล้ว
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    work_order = relationship("WorkOrder", back_populates="repair_logs")
    created_by = relationship("User", foreign_keys=[created_by_id])


class CoAssignment(Base):
    """ช่างร่วมปฏิบัติงาน"""
    __tablename__ = "co_assignments"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    work_order = relationship("WorkOrder", back_populates="co_assignments")
    technician = relationship("User", foreign_keys=[technician_id], back_populates="co_assignments")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # result: pass, fail
    result = Column(String(10), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("MaintenanceRequest", back_populates="inspections")
    inspector = relationship("User", foreign_keys=[inspector_id], back_populates="inspections")
    images = relationship("InspectionImage", back_populates="inspection", cascade="all, delete-orphan")


class InspectionImage(Base):
    __tablename__ = "inspection_images"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection = relationship("Inspection", back_populates="images")


class RequestHistory(Base):
    __tablename__ = "request_history"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    old_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("MaintenanceRequest", back_populates="history")
    changed_by = relationship("User")
