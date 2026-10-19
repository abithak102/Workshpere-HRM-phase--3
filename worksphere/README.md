# WorkSphere HRMS — Full-stack starter

**Stack:** React + Vite, Python + FastAPI, SQLAlchemy, MySQL, JWT, Pydantic.

## Prerequisites
- Python 3.11 or newer
- Node.js 20 or newer (includes npm)
- MySQL 8+ / MySQL Community Server

## 1. Create the database
Open MySQL Workbench and execute:
```sql
CREATE DATABASE worksphere CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. Configure backend
Open CMD in `worksphere\backend`:
```cmd
copy .env.example .env
notepad .env
```
Set `DATABASE_URL` to your actual MySQL password and replace `SECRET_KEY` with a long random secret. Never share or commit `.env`.

Then run:
```cmd
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload
```
Backend docs: http://127.0.0.1:8000/docs

## 3. Configure frontend
Open a **second** CMD window in `worksphere\frontend`:
```cmd
npm install
npm run dev
```
Open the Vite URL shown in CMD, usually http://localhost:5173.

## 4. Create the first administrator
1. Register an account in the UI.
2. In MySQL Workbench execute, replacing `your_username`:
```sql
USE worksphere;
UPDATE users SET role='ADMIN' WHERE username='your_username';
```
3. Sign out and sign in again so the new JWT contains the ADMIN role.
4. Create employee records and optionally link them to user accounts by entering the user's numeric ID. Use `/api/users` in Swagger as ADMIN to see IDs.

## CMD quick start (after MySQL is configured)
Backend and frontend should run in separate terminal windows. Use `start-backend.bat` and `start-frontend.bat` in the project root for convenience, after editing backend `.env`.

## Implemented endpoints
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/employees` (write permissions are role-restricted)
- `POST /api/attendance/check-in`, `/check-out`, `GET /api/attendance`, `POST /api/attendance/mark`
- `POST/GET /api/leaves`, `PATCH /api/leaves/{id}`
- `POST/GET /api/payroll`
- `GET /api/notifications`, `PATCH /api/notifications/{id}`
- `GET /api/dashboard`

## Important limitations before production
This is a runnable learning/MVP scaffold, not a production-certified HR/payroll product. Add Alembic migrations, automated tests, audit logs, rate limiting, account recovery, refresh/revocation strategy, stronger privacy controls, timezone-aware attendance rules, payroll/tax rules for your jurisdiction, and deployment secrets management before real company use. Do not expose the development API or database publicly. Employee salary is visible to authenticated users in this starter and should be restricted by role/ownership before production.
