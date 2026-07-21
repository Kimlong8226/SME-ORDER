@echo off
chcp 65001 > nul
echo =====================================
echo    Restart Backend (FastAPI Service)
echo =====================================

echo Stopping existing Backend process on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a 2>nul
)

timeout /t 1 > NUL

echo Restarting Backend Service...
cd /d "%~dp0backend"
start "Backend API (Port 8000)" cmd /k "python -m uvicorn main:app --port 8000 --reload"

echo =====================================
echo    Backend Restarted Successfully!
echo    URL: http://localhost:8000
echo =====================================
pause