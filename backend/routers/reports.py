
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Employee, Attendance, Leave, Payroll, User
from auth import require_roles

router = APIRouter(
    prefix="/reports",
    tags=["Reports & Analytics"],
)


@router.get("/summary")
def reports_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR", "ADMIN")),
):
    total_employees = db.query(Employee).count()
    active_employees = db.query(Employee).filter(
        Employee.status == "ACTIVE"
    ).count()
    inactive_employees = db.query(Employee).filter(
        Employee.status == "INACTIVE"
    ).count()

    pending_leaves = db.query(Leave).filter(
        Leave.status == "PENDING"
    ).count()
    approved_leaves = db.query(Leave).filter(
        Leave.status == "APPROVED"
    ).count()
    rejected_leaves = db.query(Leave).filter(
        Leave.status == "REJECTED"
    ).count()

    attendance_records = db.query(Attendance).count()
    present_records = db.query(Attendance).filter(
        Attendance.status == "PRESENT"
    ).count()
    absent_records = db.query(Attendance).filter(
        Attendance.status == "ABSENT"
    ).count()

    payroll_total = db.query(
    func.coalesce(func.sum(Payroll.net_salary), 0)
).scalar()
    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "inactive_employees": inactive_employees,
        "attendance_records": attendance_records,
        "present_records": present_records,
        "absent_records": absent_records,
        "pending_leaves": pending_leaves,
        "approved_leaves": approved_leaves,
        "rejected_leaves": rejected_leaves,
        "total_payroll": float(payroll_total or 0),
    }


@router.get("/payroll")
def payroll_report(
    month: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR", "ADMIN")),
):
    query = db.query(Payroll)

    if month:
        query = query.filter(Payroll.month == month)

    records = query.order_by(Payroll.month.desc()).all()

    return {
        "month": month or "ALL",
        "record_count": len(records),
        "total_net_salary": sum(
            record.net_salary for record in records
        ),
        "records": [
            {
                "id": record.id,
                "employee_id": record.employee_id,
                "month": record.month,
                "basic_salary": record.basic_salary,
                "allowances": record.allowances,
                "deductions": record.deductions,
                "net_salary": record.net_salary,
            }
            for record in records
        ],
    }

@router.get("/my")
def my_personal_reports(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("EMPLOYEE", "HR", "ADMIN")),
):
    # Find the employee profile linked to the logged-in user.
    employee = db.query(Employee).filter(
        Employee.user_id == user.id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found for this account.",
        )

    attendance_records = db.query(Attendance).filter(
        Attendance.employee_id == employee.id
    ).all()

    leave_records = db.query(Leave).filter(
        Leave.employee_id == employee.id
    ).all()

    payroll_records = db.query(Payroll).filter(
        Payroll.employee_id == employee.id
    ).order_by(Payroll.month.desc()).all()

    return {
        "employee": {
            "id": employee.id,
            "full_name": employee.full_name,
            "designation": employee.designation,
            "department": employee.department,
        },
        "attendance": [
            {
                "id": record.id,
                "date": str(record.date),
                "status": record.status,
            }
            for record in attendance_records
        ],
        "leaves": [
            {
                "id": record.id,
                "leave_type": record.leave_type,
                "start_date": str(record.start_date),
                "end_date": str(record.end_date),
                "status": record.status,
            }
            for record in leave_records
        ],
        "payroll": [
            {
                "id": record.id,
                "month": record.month,
                "basic_salary": record.basic_salary,
                "allowances": record.allowances,
                "deductions": record.deductions,
                "net_salary": record.net_salary,
            }
            for record in payroll_records
        ],
    }

@router.get("/my")
def my_personal_reports(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("EMPLOYEE", "HR", "ADMIN")),
):
    employee = db.query(Employee).filter(
        Employee.user_id == user.id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found for this account.",
        )

    attendance_records = db.query(Attendance).filter(
        Attendance.employee_id == employee.id
    ).order_by(Attendance.date.desc()).all()

    leave_records = db.query(Leave).filter(
        Leave.employee_id == employee.id
    ).order_by(Leave.start_date.desc()).all()

    payroll_records = db.query(Payroll).filter(
        Payroll.employee_id == employee.id
    ).order_by(Payroll.month.desc()).all()

    return {
        "employee": {
            "id": employee.id,
            "full_name": employee.full_name,
            "designation": employee.designation,
            "department": employee.department,
        },
        "attendance": [
            {
                "id": record.id,
                "date": str(record.date),
                "status": record.status,
                "check_in": str(record.check_in) if record.check_in else None,
                "check_out": str(record.check_out) if record.check_out else None,
            }
            for record in attendance_records
        ],
        "leaves": [
            {
                "id": record.id,
                "leave_type": record.leave_type,
                "start_date": str(record.start_date),
                "end_date": str(record.end_date),
                "status": record.status,
            }
            for record in leave_records
        ],
        "payroll": [
            {
                "id": record.id,
                "month": record.month,
                "basic_salary": record.basic_salary,
                "allowances": record.allowances,
                "deductions": record.deductions,
                "net_salary": record.net_salary,
            }
            for record in payroll_records
        ],
    }
