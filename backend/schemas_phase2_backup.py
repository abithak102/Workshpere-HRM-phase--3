
from datetime import date
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from typing import Literal

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["EMPLOYEE", "HR", "ADMIN"] = "EMPLOYEE"


class UserAdminUpdate(BaseModel):
    role: Literal["EMPLOYEE", "HR", "ADMIN"] | None = None
    is_active: bool | None = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class EmployeeCreate(BaseModel):
    user_id: int | None = None
    full_name: str = Field(min_length=2, max_length=150)
    designation: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)
    joining_date: date
    salary: float = Field(ge=0)
    status: str = "ACTIVE"


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    joining_date: date | None = None
    salary: float | None = Field(default=None, ge=0)
    status: str | None = None


class EmployeeOut(BaseModel):
    id: int
    user_id: int | None
    full_name: str
    designation: str
    department: str
    joining_date: date
    salary: float
    status: str

    model_config = ConfigDict(from_attributes=True)


class LeaveCreate(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=1000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date must not be before start date")
        if self.leave_type not in {"SICK", "CASUAL", "PAID"}:
            raise ValueError("Invalid leave type")
        return self


class LeaveOut(BaseModel):
    id: int
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    reason: str
    status: str

    model_config = ConfigDict(from_attributes=True)

class PayrollCreate(BaseModel):
    employee_id: int
    basic_salary: float = Field(ge=0)
    allowances: float = Field(default=0, ge=0)
    deductions: float = Field(default=0, ge=0)
    bonus: float = Field(default=0, ge=0)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


class PayrollOut(BaseModel):
    id: int
    employee_id: int
    basic_salary: float
    allowances: float
    deductions: float
    bonus: float
    net_salary: float
    month: str

    model_config = ConfigDict(from_attributes=True)


   

class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    is_read: bool

    model_config = ConfigDict(from_attributes=True)
