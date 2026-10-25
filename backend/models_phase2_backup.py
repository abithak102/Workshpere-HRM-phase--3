
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="EMPLOYEE")
    is_active = Column(Boolean, nullable=False, default=True, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)
    full_name = Column(String(150), nullable=False)
    designation = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    joining_date = Column(Date, nullable=False)
    salary = Column(Float, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="ACTIVE")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    check_in = Column(DateTime(timezone=True), nullable=True)
    check_out = Column(DateTime(timezone=True), nullable=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="PRESENT")


class Leave(Base):
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id = Column(Integer, primary_key=True, index=True)
    leave_type = Column(String(20), unique=True, nullable=False)
    total_days_allowed = Column(Integer, nullable=False, default=0)


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "leave_type",
            name="uq_leave_balance_employee_type",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type = Column(String(20), nullable=False)
    remaining_days = Column(Integer, nullable=False, default=0)


class Payroll(Base):
    __tablename__ = "payroll"
    __table_args__ = (
        UniqueConstraint("employee_id", "month", name="uq_payroll_employee_month"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    basic_salary = Column(Float, nullable=False)
    allowances = Column(Float, nullable=False, default=0, server_default="0")
    deductions = Column(Float, nullable=False, default=0)
    bonus = Column(Float, nullable=False, default=0)
    net_salary = Column(Float, nullable=False)
    month = Column(String(7), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
