@echo off
REM This helper shows the directory structure. The delivered project already contains these files.
cd /d "%~dp0"
if not exist backend\app mkdir backend\app
if not exist frontend\src mkdir frontend\src
echo WorkSphere folder structure is ready.
tree /F
pause
