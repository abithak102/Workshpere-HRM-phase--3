
import os
from datetime import date, datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import (
    User, Employee, Attendance, Leave, Payroll, Notification,
    LeavePolicy, LeaveBalance,
)
from schemas import (
    UserCreate, UserOut, Token,
    EmployeeCreate, EmployeeUpdate, EmployeeOut,
    LeaveCreate, LeaveOut, PayrollCreate, PayrollOut,
    NotificationOut,
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_roles,
)
from schemas import (
    UserCreate, UserOut, Token,
    EmployeeCreate, EmployeeUpdate, EmployeeOut,
    LeaveCreate, LeaveOut, PayrollCreate, PayrollOut,
    NotificationOut,
    AdminUserCreate, UserAdminUpdate,
)
Base.metadata.create_all(bind=engine)
def seed_leave_policies():
    from database import SessionLocal

    db = SessionLocal()
    try:
        defaults = {
            "SICK": 12,
            "CASUAL": 12,
            "PAID": 15,
        }

        for leave_type, total_days in defaults.items():
            policy = db.query(LeavePolicy).filter(
                LeavePolicy.leave_type == leave_type
            ).first()

            if policy is None:
                db.add(LeavePolicy(
                    leave_type=leave_type,
                    total_days_allowed=total_days,
                ))

        db.commit()
    finally:
        db.close()


seed_leave_policies()

app = FastAPI(title="WorkSphere HRMS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def notify(db, user_id, title, message):
    db.add(Notification(
        user_id=user_id, title=title, message=message
    ))


def get_my_employee(db, user):
    employee = db.query(Employee).filter(
        Employee.user_id == user.id
    ).first()
    if not employee:
        raise HTTPException(
            status_code=404,
            detail="No employee profile is linked to this user",
        )
    return employee


def utc_now():
    return datetime.now(timezone.utc)


@app.on_event("startup")
def create_initial_admin():
    username = os.getenv("ADMIN_USERNAME", "admin")
    email = os.getenv("ADMIN_EMAIL", "admin@worksphere.local")
    password = os.getenv("ADMIN_PASSWORD", "")

    if not password:
        return

    from sqlalchemy.orm import Session as DBSession

    with DBSession(engine) as db:
        existing = db.query(User).filter(
            or_(User.username == username, User.email == email)
        ).first()

        if existing is None:
            db.add(User(
                username=username,
                email=email,
                hashed_password=hash_password(password),
                role="ADMIN",
            ))
            db.commit()


@app.get("/")
def root():
    return {"message": "WorkSphere HRMS API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------- AUTH ----------------

@app.post("/auth/register", response_model=UserOut, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    # Public registration can only create EMPLOYEE accounts.
    username = data.username.strip()
    email = str(data.email).lower()

    if db.query(User).filter(
        or_(User.username == username, User.email == email)
    ).first():
        raise HTTPException(
            status_code=409,
            detail="Username or email already exists",
        )

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(data.password),
        role="EMPLOYEE",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    identity = form.username.strip()
    user = db.query(User).filter(
        or_(
            User.username == identity,
            User.email == identity.lower(),
        )
    ).first()

    if not user or not verify_password(
        form.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account is inactive. Contact an administrator.",
        )
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "role": user.role,
    }


@app.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# ---------------- EMPLOYEES ----------------

@app.post(
    "/employees",
    response_model=EmployeeOut,
    status_code=201,
)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR", "ADMIN")),
):
    values = data.model_dump()

    if values["status"] not in {"ACTIVE", "INACTIVE"}:
        raise HTTPException(status_code=422, detail="Invalid status")

    if values["user_id"] is not None:
        linked_user = db.query(User).filter(
            User.id == values["user_id"]
        ).first()
        if not linked_user:
            raise HTTPException(status_code=404, detail="User not found")
        if db.query(Employee).filter(
            Employee.user_id == values["user_id"]
        ).first():
            raise HTTPException(
                status_code=409,
                detail="User already has an employee profile",
            )

    employee = Employee(**values)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@app.get("/employees", response_model=list[EmployeeOut])
def list_employees(
    search: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Employee)

    if user.role == "EMPLOYEE":
        query = query.filter(Employee.user_id == user.id)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            Employee.full_name.ilike(term),
            Employee.department.ilike(term),
            Employee.designation.ilike(term),
        ))

    return query.order_by(Employee.id.desc()).all()


@app.get("/employees/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if user.role == "EMPLOYEE" and employee.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return employee


@app.put("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR", "ADMIN")),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    values = data.model_dump(exclude_unset=True)

    if values.get("status") not in (None, "ACTIVE", "INACTIVE"):
        raise HTTPException(status_code=422, detail="Invalid status")

    for key, value in values.items():
        setattr(employee, key, value)

    db.commit()
    db.refresh(employee)
    return employee


# ---------------- ATTENDANCE ----------------


@app.post("/attendance/check-in")
def check_in(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = get_my_employee(db, user)
    today = date.today()

    if employee.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Employee is inactive")

    record = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == today,
    ).first()

    if record and record.check_in:
        raise HTTPException(status_code=409, detail="Already checked in")

    checkin_time = utc_now()

    # Convert UTC time to Indian Standard Time.
    local_checkin = checkin_time
    if local_checkin.tzinfo is None:
        local_checkin = local_checkin.replace(tzinfo=timezone.utc)

    from datetime import timedelta
    local_checkin = local_checkin.astimezone(
        timezone(timedelta(hours=5, minutes=30))
    )

    is_late = (
        local_checkin.hour > 9
        or (local_checkin.hour == 9 and local_checkin.minute > 15)
    )

    attendance_status = "LATE" if is_late else "PRESENT"

    if record:
        record.check_in = checkin_time
        record.status = attendance_status
    else:
        record = Attendance(
            employee_id=employee.id,
            date=today,
            check_in=checkin_time,
            status=attendance_status,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    return {
        "message": "Check-in successful",
        "attendance_id": record.id,
        "status": record.status,
    }

@app.post("/attendance/check-out")
def check_out(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = get_my_employee(db, user)
    record = db.query(Attendance).filter(
        Attendance.employee_id == employee.id,
        Attendance.date == date.today(),
    ).first()

    if not record or not record.check_in:
        raise HTTPException(status_code=400, detail="Check in first")

    if record.check_out:
        raise HTTPException(status_code=409, detail="Already checked out")

    record.check_out = utc_now()
    db.commit()
    db.refresh(record)

    start = record.check_in
    end = record.check_out
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    hours = round((end - start).total_seconds() / 3600, 2)

    if hours < 0:
        raise HTTPException(status_code=400, detail="Invalid attendance times")

        standard_hours = 8
    overtime_hours = round(max(0, hours - standard_hours), 2)

    return {
        "message": "Check-out successful",
        "working_hours": hours,
        "overtime_hours": overtime_hours,
        "status": record.status,
    }


@app.get("/attendance")
def attendance_history(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Attendance)

    if user.role == "EMPLOYEE":
        employee = get_my_employee(db, user)
        query = query.filter(Attendance.employee_id == employee.id)
    elif employee_id is not None:
        query = query.filter(Attendance.employee_id == employee_id)

    records = query.order_by(Attendance.date.desc()).all()
    result = []

    for item in records:
        hours = None
        if item.check_in and item.check_out:
            start = item.check_in
            end = item.check_out
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            hours = round((end - start).total_seconds() / 3600, 2)

        
        overtime = (
            round(max(0, hours - 8), 2)
            if hours is not None
            else None
        )

        result.append({
            "id": item.id,
            "employee_id": item.employee_id,
            "date": item.date,
            "check_in": item.check_in,
            "check_out": item.check_out,
            "working_hours": hours,
            "overtime_hours": overtime,
            "status": item.status,
        })
    return result

# ---------------- ABSENT MARKING ----------------

@app.post("/attendance/mark-absent/{employee_id}")
def mark_absent(
    employee_id: int,
    absent_date: date,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ADMIN", "HR")),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Cannot mark an inactive employee absent",
        )

    if absent_date > date.today():
        raise HTTPException(
            status_code=400,
            detail="Cannot mark a future date absent",
        )

    record = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == absent_date,
    ).first()

    if record:
        if record.check_in:
            raise HTTPException(
                status_code=409,
                detail="Employee has already checked in on this date",
            )

        raise HTTPException(
            status_code=409,
            detail="Attendance record already exists for this date",
        )

    record = Attendance(
        employee_id=employee_id,
        date=absent_date,
        status="ABSENT",
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "message": "Employee marked absent successfully",
        "employee_id": employee_id,
        "date": absent_date,
        "status": record.status,
    }

# ---------------- LEAVE POLICIES & BALANCES ----------------

def ensure_leave_balances(db, employee_id: int):
    """Create missing employee balances from configured leave policies."""
    policies = db.query(LeavePolicy).all()

    for policy in policies:
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type == policy.leave_type,
        ).first()

        if balance is None:
            db.add(LeaveBalance(
                employee_id=employee_id,
                leave_type=policy.leave_type,
                remaining_days=policy.total_days_allowed,
            ))

    db.flush()


@app.get("/leave-policies")
def list_leave_policies(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(LeavePolicy).order_by(LeavePolicy.id).all()


@app.get("/leave-balances")
def list_leave_balances(
    employee_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == "EMPLOYEE":
        employee = get_my_employee(db, user)
        target_id = employee.id
    else:
        target_id = employee_id

    if target_id is not None:
        employee = db.query(Employee).filter(
            Employee.id == target_id
        ).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        ensure_leave_balances(db, target_id)
        db.commit()

        return db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == target_id
        ).order_by(LeaveBalance.leave_type).all()

    return db.query(LeaveBalance).order_by(
        LeaveBalance.employee_id,
        LeaveBalance.leave_type,
    ).all()


# ---------------- LEAVES ----------------

@app.post("/leaves", response_model=LeaveOut, status_code=201)
def apply_leave(
    data: LeaveCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee = get_my_employee(db, user)
    ensure_leave_balances(db, employee.id)

    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == employee.id,
        LeaveBalance.leave_type == data.leave_type,
    ).first()

    if balance is None:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No leave policy configured for this leave type",
        )

    days_requested = (data.end_date - data.start_date).days + 1

    pending_leaves = db.query(Leave).filter(
        Leave.employee_id == employee.id,
        Leave.leave_type == data.leave_type,
        Leave.status == "PENDING",
    ).all()

    pending_days = sum(
        (leave.end_date - leave.start_date).days + 1
        for leave in pending_leaves
    )

    if days_requested + pending_days > balance.remaining_days:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient {data.leave_type} leave balance. "
                f"Remaining: {balance.remaining_days}; "
                f"already pending: {pending_days} days."
            ),
        )

    leave = Leave(
        employee_id=employee.id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        status="PENDING",
    )

    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave


@app.get("/leaves", response_model=list[LeaveOut])
def list_leaves(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Leave)

    if user.role == "EMPLOYEE":
        employee = get_my_employee(db, user)
        query = query.filter(Leave.employee_id == employee.id)

    return query.order_by(Leave.id.desc()).all()


@app.patch("/leaves/{leave_id}/decision", response_model=LeaveOut)
def decide_leave(
    leave_id: int,
    decision: str = Query(..., pattern="^(APPROVED|REJECTED)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR", "ADMIN")),
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()

    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")

    if leave.status != "PENDING":
        raise HTTPException(status_code=409, detail="Leave already decided")

    if decision == "APPROVED":
        ensure_leave_balances(db, leave.employee_id)

        balance = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == leave.employee_id,
            LeaveBalance.leave_type == leave.leave_type,
        ).first()

        days_requested = (leave.end_date - leave.start_date).days + 1

        if balance is None or balance.remaining_days < days_requested:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Insufficient leave balance to approve this request",
            )

        balance.remaining_days -= days_requested

    leave.status = decision

    employee = db.query(Employee).filter(
        Employee.id == leave.employee_id
    ).first()

    if employee and employee.user_id:
        notify(
            db,
            employee.user_id,
            f"Leave {decision.lower()}",
            f"Your leave request #{leave.id} was {decision.lower()}.",
        )

    db.commit()
    db.refresh(leave)
    return leave


# ---------------- PAYROLL ----------------

@app.post("/payroll", response_model=PayrollOut, status_code=201)
def generate_payroll(
    data: PayrollCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR", "ADMIN")),
):
    employee = db.query(Employee).filter(
        Employee.id == data.employee_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if db.query(Payroll).filter(
        Payroll.employee_id == data.employee_id,
        Payroll.month == data.month,
    ).first():
        raise HTTPException(
            status_code=409,
            detail="Payroll already exists for this employee and month",
        )

    net = (
    Decimal(str(data.basic_salary))
    + Decimal(str(data.allowances))
    + Decimal(str(data.bonus))
    - Decimal(str(data.deductions))
)

    if net < 0:
        raise HTTPException(
            status_code=422,
            detail="Deductions cannot exceed salary plus bonus",
        )

    net = net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    payroll = Payroll(
        employee_id=data.employee_id,
        basic_salary=data.basic_salary,
        allowances=data.allowances,
        deductions=data.deductions,
        bonus=data.bonus,
        net_salary=float(net),
        month=data.month,
    )
    db.add(payroll)

    if employee.user_id:
        notify(
            db,
            employee.user_id,
            "Payroll generated",
            f"Your payroll for {data.month} has been generated.",
        )

    db.commit()
    db.refresh(payroll)
    return payroll


@app.get("/payroll", response_model=list[PayrollOut])
def list_payroll(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Payroll)

    if user.role == "EMPLOYEE":
        employee = get_my_employee(db, user)
        query = query.filter(Payroll.employee_id == employee.id)
    elif employee_id is not None:
        query = query.filter(Payroll.employee_id == employee_id)

    return query.order_by(Payroll.month.desc()).all()


# ---------------- NOTIFICATIONS ----------------

@app.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(Notification.id.desc()).all()


@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    item.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}


# ---------------- DASHBOARD ----------------

@app.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("HR", "ADMIN")),
):
    today = date.today()

    total_employees = db.query(Employee).count()
    active_employees = db.query(Employee).filter(
        Employee.status == "ACTIVE"
    ).count()

    present_today = db.query(Attendance).filter(
        Attendance.date == today,
        Attendance.status == "PRESENT",
    ).count()

    pending_leaves = db.query(Leave).filter(
        Leave.status == "PENDING"
    ).count()

    payroll_total = db.query(
        func.coalesce(func.sum(Payroll.net_salary), 0)
    ).scalar()

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "present_today": present_today,
        "pending_leaves": pending_leaves,
        "total_payroll_all_months": float(payroll_total or 0),
    }

# ---------------- ADMIN USER MANAGEMENT ----------------

@app.get("/admin/users", response_model=list[UserOut])
def admin_list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    return db.query(User).order_by(User.id.desc()).all()


@app.post("/admin/users", response_model=UserOut, status_code=201)
def admin_create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    username = data.username.strip()
    email = str(data.email).lower()

    existing = db.query(User).filter(
        or_(User.username == username, User.email == email)
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Username or email already exists",
        )

    new_user = User(
        username=username,
        email=email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.patch("/admin/users/{user_id}", response_model=UserOut)
def admin_update_user(
    user_id: int,
    data: UserAdminUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    target = db.query(User).filter(User.id == user_id).first()

    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    values = data.model_dump(exclude_unset=True)

    # Do not allow an administrator to deactivate their own account.
    if target.id == admin.id and values.get("is_active") is False:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account",
        )

    for key, value in values.items():
        setattr(target, key, value)

    db.commit()
    db.refresh(target)
    return target


@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    target = db.query(User).filter(User.id == user_id).first()

    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account",
        )

    linked_employee = db.query(Employee).filter(
        Employee.user_id == target.id
    ).first()

    linked_notification = db.query(Notification).filter(
        Notification.user_id == target.id
    ).first()

    if linked_employee or linked_notification:
        raise HTTPException(
            status_code=409,
            detail="This user has linked records. Deactivate the account instead.",
        )

    db.delete(target)
    db.commit()
    return {"message": "User deleted successfully"}

