import os
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from dotenv import load_dotenv
from .database import Base, engine, get_db
from .models import User, Employee, Attendance, Leave, Payroll, Notification

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-this-secret-before-deployment")
ALGORITHM = "HS256"
TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)
Base.metadata.create_all(bind=engine)
app = FastAPI(title="WorkSphere HRMS API", version="1.0.0")
origins = [os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
class LoginIn(BaseModel):
    username: str
    password: str
class EmployeeIn(BaseModel):
    user_id: Optional[int] = None
    full_name: str = Field(min_length=2, max_length=160)
    designation: str = "Employee"
    department: str = "General"
    joining_date: date = Field(default_factory=date.today)
    salary: float = Field(ge=0)
    status: str = "ACTIVE"
class AttendanceIn(BaseModel):
    employee_id: int
    date: date = Field(default_factory=date.today)
    status: str = "PRESENT"
class LeaveIn(BaseModel):
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=2000)
class LeaveDecision(BaseModel):
    status: str
class PayrollIn(BaseModel):
    employee_id: int
    deductions: float = Field(default=0, ge=0)
    bonus: float = Field(default=0, ge=0)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
class ReadIn(BaseModel):
    is_read: bool = True

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class UserOut(ORMModel):
    id: int; username: str; email: str; role: str; created_at: datetime
class EmployeeOut(ORMModel):
    id: int; user_id: Optional[int]; full_name: str; designation: str; department: str; joining_date: date; salary: float; status: str
class AttendanceOut(ORMModel):
    id: int; employee_id: int; check_in: Optional[datetime]; check_out: Optional[datetime]; date: date; status: str
class LeaveOut(ORMModel):
    id: int; employee_id: int; leave_type: str; start_date: date; end_date: date; reason: str; status: str; created_at: datetime
class PayrollOut(ORMModel):
    id: int; employee_id: int; basic_salary: float; deductions: float; bonus: float; net_salary: float; month: str; created_at: datetime
class NotificationOut(ORMModel):
    id: int; user_id: int; title: str; message: str; is_read: bool; created_at: datetime

def make_token(user: User):
    expiry = datetime.utcnow() + timedelta(minutes=TOKEN_MINUTES)
    return jwt.encode({"sub": str(user.id), "role": user.role, "exp": expiry}, SECRET_KEY, algorithm=ALGORITHM)

def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate":"Bearer"})
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload.get("sub", 0))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, uid)
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return user

def roles(*allowed):
    def guard(user: User = Depends(current_user)):
        if user.role not in allowed: raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return guard

def notify(db: Session, user_id: int | None, title: str, message: str):
    if user_id:
        db.add(Notification(user_id=user_id, title=title, message=message))

def get_my_employee(db: Session, user: User):
    emp = db.scalar(select(Employee).where(Employee.user_id == user.id))
    if not emp: raise HTTPException(status_code=404, detail="Employee profile not found. Ask HR to link your account.")
    return emp

@app.get("/")
def root(): return {"message":"WorkSphere HRMS API is running", "docs":"/docs"}

@app.post("/api/auth/register", response_model=UserOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where((User.username == data.username) | (User.email == data.email))):
        raise HTTPException(status_code=409, detail="Username or email already exists")
    user = User(username=data.username, email=str(data.email), hashed_password=password_hash.hash(data.password), role="EMPLOYEE")
    db.add(user); db.commit(); db.refresh(user)
    return user

@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username))
    if not user or not password_hash.verify(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return {"access_token":make_token(user), "token_type":"bearer", "user":{"id":user.id,"username":user.username,"email":user.email,"role":user.role}}

@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)): return user

@app.get("/api/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(roles("ADMIN"))): return list(db.scalars(select(User).order_by(User.id.desc())).all())

@app.get("/api/employees", response_model=list[EmployeeOut])
def employees(q: str = "", department: str = "", db: Session = Depends(get_db), _: User = Depends(current_user)):
    stmt = select(Employee).order_by(Employee.id.desc())
    if q: stmt = stmt.where(Employee.full_name.ilike(f"%{q}%"))
    if department: stmt = stmt.where(Employee.department == department)
    return list(db.scalars(stmt).all())

@app.post("/api/employees", response_model=EmployeeOut, status_code=201)
def add_employee(data: EmployeeIn, db: Session = Depends(get_db), _: User = Depends(roles("HR","ADMIN"))):
    if data.status not in ("ACTIVE","INACTIVE"): raise HTTPException(422, "Invalid employee status")
    if data.user_id and not db.get(User, data.user_id): raise HTTPException(404, "User not found")
    if data.user_id and db.scalar(select(Employee).where(Employee.user_id == data.user_id)): raise HTTPException(409, "User already linked to an employee")
    emp = Employee(**data.model_dump()); db.add(emp); db.commit(); db.refresh(emp); return emp

@app.put("/api/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, data: EmployeeIn, db: Session = Depends(get_db), _: User = Depends(roles("HR","ADMIN"))):
    emp = db.get(Employee, employee_id)
    if not emp: raise HTTPException(404, "Employee not found")
    for k,v in data.model_dump().items(): setattr(emp,k,v)
    db.commit(); db.refresh(emp); return emp

@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db), _: User = Depends(roles("ADMIN"))):
    emp = db.get(Employee, employee_id)
    if not emp: raise HTTPException(404, "Employee not found")
    emp.status = "INACTIVE"; db.commit(); return {"message":"Employee marked inactive"}

@app.post("/api/attendance/check-in", response_model=AttendanceOut)
def check_in(db: Session = Depends(get_db), user: User = Depends(current_user)):
    emp = get_my_employee(db,user); today = date.today()
    row = db.scalar(select(Attendance).where(Attendance.employee_id==emp.id, Attendance.date==today))
    if row and row.check_in: raise HTTPException(409,"Already checked in today")
    if not row: row = Attendance(employee_id=emp.id,date=today,status="PRESENT"); db.add(row)
    row.check_in = datetime.utcnow(); db.commit(); db.refresh(row); return row

@app.post("/api/attendance/check-out", response_model=AttendanceOut)
def check_out(db: Session = Depends(get_db), user: User = Depends(current_user)):
    emp=get_my_employee(db,user); row=db.scalar(select(Attendance).where(Attendance.employee_id==emp.id,Attendance.date==date.today()))
    if not row or not row.check_in: raise HTTPException(400,"Check in before checking out")
    if row.check_out: raise HTTPException(409,"Already checked out today")
    row.check_out=datetime.utcnow()
    if (row.check_out-row.check_in).total_seconds() < 4*3600: row.status="HALF_DAY"
    db.commit(); db.refresh(row); return row

@app.get("/api/attendance", response_model=list[AttendanceOut])
def attendance(employee_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt=select(Attendance).order_by(Attendance.date.desc())
    if user.role == "EMPLOYEE": stmt=stmt.where(Attendance.employee_id==get_my_employee(db,user).id)
    elif employee_id: stmt=stmt.where(Attendance.employee_id==employee_id)
    return list(db.scalars(stmt).all())

@app.post("/api/attendance/mark", response_model=AttendanceOut)
def mark_attendance(data: AttendanceIn, db: Session = Depends(get_db), _: User = Depends(roles("HR","ADMIN"))):
    if data.status not in ("PRESENT","ABSENT","HALF_DAY"): raise HTTPException(422,"Invalid attendance status")
    if not db.get(Employee,data.employee_id): raise HTTPException(404,"Employee not found")
    row=db.scalar(select(Attendance).where(Attendance.employee_id==data.employee_id,Attendance.date==data.date))
    if row: row.status=data.status
    else: row=Attendance(employee_id=data.employee_id,date=data.date,status=data.status); db.add(row)
    db.commit(); db.refresh(row); return row

@app.post("/api/leaves", response_model=LeaveOut, status_code=201)
def apply_leave(data: LeaveIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if data.end_date < data.start_date: raise HTTPException(422,"End date must be on or after start date")
    if data.leave_type not in ("SICK","CASUAL","PAID"): raise HTTPException(422,"Invalid leave type")
    emp=get_my_employee(db,user) if user.role=="EMPLOYEE" else db.get(Employee,data.employee_id)
    if not emp: raise HTTPException(404,"Employee not found")
    row=Leave(employee_id=emp.id,leave_type=data.leave_type,start_date=data.start_date,end_date=data.end_date,reason=data.reason,status="PENDING")
    db.add(row); db.commit(); db.refresh(row)
    notify(db,emp.user_id,"Leave request submitted",f"Your leave request ({row.start_date} to {row.end_date}) is pending review."); db.commit()
    return row

@app.get("/api/leaves", response_model=list[LeaveOut])
def leaves(db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt=select(Leave).order_by(Leave.created_at.desc())
    if user.role=="EMPLOYEE": stmt=stmt.where(Leave.employee_id==get_my_employee(db,user).id)
    return list(db.scalars(stmt).all())

@app.patch("/api/leaves/{leave_id}", response_model=LeaveOut)
def decide_leave(leave_id: int, data: LeaveDecision, db: Session = Depends(get_db), _: User = Depends(roles("HR","ADMIN"))):
    if data.status not in ("APPROVED","REJECTED"): raise HTTPException(422,"Status must be APPROVED or REJECTED")
    row=db.get(Leave,leave_id)
    if not row: raise HTTPException(404,"Leave request not found")
    if row.status != "PENDING": raise HTTPException(409,"Leave request already processed")
    row.status=data.status; emp=db.get(Employee,row.employee_id)
    notify(db,emp.user_id,"Leave request updated",f"Your leave request was {data.status.lower()}.")
    db.commit(); db.refresh(row); return row

@app.post("/api/payroll", response_model=PayrollOut, status_code=201)
def generate_payroll(data: PayrollIn, db: Session = Depends(get_db), _: User = Depends(roles("HR","ADMIN"))):
    emp=db.get(Employee,data.employee_id)
    if not emp: raise HTTPException(404,"Employee not found")
    if db.scalar(select(Payroll).where(Payroll.employee_id==emp.id,Payroll.month==data.month)): raise HTTPException(409,"Payroll already exists for this employee and month")
    row=Payroll(employee_id=emp.id,basic_salary=emp.salary,deductions=data.deductions,bonus=data.bonus,net_salary=round(emp.salary-data.deductions+data.bonus,2),month=data.month)
    if row.net_salary < 0: raise HTTPException(422,"Deductions cannot exceed salary plus bonus")
    db.add(row); db.flush(); notify(db,emp.user_id,"Payroll generated",f"Payroll for {data.month} is ready. Net salary: {row.net_salary:.2f}")
    db.commit(); db.refresh(row); return row

@app.get("/api/payroll", response_model=list[PayrollOut])
def payroll(db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt=select(Payroll).order_by(Payroll.month.desc())
    if user.role=="EMPLOYEE": stmt=stmt.where(Payroll.employee_id==get_my_employee(db,user).id)
    return list(db.scalars(stmt).all())

@app.get("/api/notifications", response_model=list[NotificationOut])
def notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return list(db.scalars(select(Notification).where(Notification.user_id==user.id).order_by(Notification.created_at.desc())).all())

@app.patch("/api/notifications/{notification_id}", response_model=NotificationOut)
def read_notification(notification_id: int, data: ReadIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    row=db.get(Notification,notification_id)
    if not row or row.user_id != user.id: raise HTTPException(404,"Notification not found")
    row.is_read=data.is_read; db.commit(); db.refresh(row); return row

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role == "EMPLOYEE":
        emp=get_my_employee(db,user)
        return {"role":user.role,"total_employees":1,"attendance_today":db.scalar(select(func.count(Attendance.id)).where(Attendance.employee_id==emp.id,Attendance.date==date.today(),Attendance.status=="PRESENT")) or 0,"pending_leaves":db.scalar(select(func.count(Leave.id)).where(Leave.employee_id==emp.id,Leave.status=="PENDING")) or 0,"payroll_total":db.scalar(select(func.coalesce(func.sum(Payroll.net_salary),0)).where(Payroll.employee_id==emp.id)) or 0}
    return {"role":user.role,"total_employees":db.scalar(select(func.count(Employee.id)).where(Employee.status=="ACTIVE")) or 0,"attendance_today":db.scalar(select(func.count(Attendance.id)).where(Attendance.date==date.today(),Attendance.status=="PRESENT")) or 0,"pending_leaves":db.scalar(select(func.count(Leave.id)).where(Leave.status=="PENDING")) or 0,"payroll_total":db.scalar(select(func.coalesce(func.sum(Payroll.net_salary),0))) or 0}
