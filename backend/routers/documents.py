
import os
import uuid
from pathlib import Path
from datetime import date, timedelta
from models import Notification
from fastapi import Form

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from database import get_db
from models import Employee, EmployeeDocument, Notification, User
from auth import get_current_user, require_roles


router = APIRouter(
    prefix="/documents",
    tags=["Document Management"],
)

UPLOAD_DIR = (
    Path(__file__).resolve().parent.parent
    / "uploads"
    / "documents"
)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def get_employee_for_user(db: Session, user: User):
    return db.query(Employee).filter(
        Employee.user_id == user.id
    ).first()
def notify_hr_admins(db: Session, title: str, message: str):
    users = db.query(User).filter(
        User.role.in_(["HR", "ADMIN"])
    ).all()

    for user in users:
        db.add(Notification(
            user_id=user.id,
            title=title,
            message=message,
        ))


@router.post("/upload/{employee_id}")
async def upload_document(
    employee_id: int,
    file: UploadFile = File(...),
    expiry_date: date | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    is_hr_admin = current_user.role in ("HR", "ADMIN")
    is_own_employee = employee.user_id == current_user.id

    if not (is_hr_admin or is_own_employee):
        raise HTTPException(
            status_code=403,
            detail="You cannot upload documents for this employee",
        )

    extension = ALLOWED_TYPES.get(file.content_type or "")
    if not extension:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, JPG and PNG files are allowed",
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size must not exceed 5 MB",
        )

    stored_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / stored_filename

    try:
        file_path.write_bytes(content)

        document = EmployeeDocument(
            employee_id=employee.id,
            uploaded_by=current_user.id,
            document_name=Path(file.filename or "document").stem[:200],
            original_filename=Path(file.filename or "document").name[:255],
            stored_filename=stored_filename,
            content_type=file.content_type,
            file_size=len(content),
            expiry_date=expiry_date,
        )

        db.add(document)
        db.flush()

        if expiry_date is not None:
            today = date.today()
            alert_limit = today + timedelta(days=30)

            if expiry_date <= alert_limit:
                notify_hr_admins(
                    db,
                    "Document Expiry Alert",
                    (
                        f"Document '{document.document_name}' "
                        f"for employee '{employee.full_name}' "
                        f"expires on {expiry_date.isoformat()}."
                    ),
                )

        db.commit()
        db.refresh(document)

        return {
            "message": "Document uploaded successfully",
            "id": document.id,
            "employee_id": document.employee_id,
            "document_name": document.document_name,
            "original_filename": document.original_filename,
            "file_size": document.file_size,
            "uploaded_at": document.uploaded_at,
            "expiry_date": document.expiry_date,
        }

    except Exception:
        db.rollback()
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500,
            detail="Could not save the document",
        )
    finally:
        await file.close()


@router.get("/employee/{employee_id}")
def list_documents(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found",
        )

    is_hr_admin = current_user.role in ("HR", "ADMIN")
    is_own_employee = employee.user_id == current_user.id

    if not (is_hr_admin or is_own_employee):
        raise HTTPException(
            status_code=403,
            detail="You cannot view these documents",
        )

    documents = db.query(EmployeeDocument).filter(
        EmployeeDocument.employee_id == employee_id
    ).order_by(EmployeeDocument.uploaded_at.desc()).all()

    return [
        {
            "id": doc.id,
            "employee_id": doc.employee_id,
            "document_name": doc.document_name,
            "original_filename": doc.original_filename,
            "content_type": doc.content_type,
            "file_size": doc.file_size,
            "uploaded_at": doc.uploaded_at,
            "expiry_date": doc.expiry_date,
        }
        for doc in documents
    ]


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    document = db.query(EmployeeDocument).filter(
        EmployeeDocument.id == document_id
    ).first()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    file_path = UPLOAD_DIR / document.stored_filename

    db.delete(document)
    db.commit()

    if file_path.exists():
        file_path.unlink()

    return {"message": "Document deleted successfully"}
