@echo off
cd /d "%~dp0backend"
if not exist .env (
  copy .env.example .env
  echo Edit backend\.env and set your MySQL password and SECRET_KEY, then run this file again.
  notepad .env
  pause
  exit /b 1
)
if not exist .venv py -m venv .venv
call .venv\Scripts\activate
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload
