# WorkSphere backend

## 1. Install Python
Use Python 3.11+ and MySQL 8+ (or MariaDB).

## 2. Create database
In MySQL Workbench or MySQL command line:
```sql
CREATE DATABASE worksphere CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3. Configure environment
Copy `.env.example` to `.env`, then set your actual MySQL password and a long random SECRET_KEY.

## 4. Install and run (Windows CMD)
```cmd
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload
```
API docs: http://127.0.0.1:8000/docs

Public registration deliberately creates EMPLOYEE accounts only. Promote the first HR/ADMIN user manually in MySQL after registering:
```sql
USE worksphere;
UPDATE users SET role='ADMIN' WHERE username='your_username';
```
Do this only in your local development database. Do not expose this database or API publicly without production hardening.
