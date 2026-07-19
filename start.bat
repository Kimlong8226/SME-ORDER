@echo off
title Central Kitchen Order System Startup

echo ===========================================
echo  Starting Central Kitchen Order System...
echo ===========================================

cd /d "%~dp0backend"
start "Backend API (Port 8000)" cmd /k "python -m uvicorn main:app --port 8000"

timeout /t 2 > NUL

cd /d "%~dp0frontend"
start "Frontend Web (Port 5173)" cmd /k "npm run dev"

timeout /t 3 > NUL

start http://localhost:5173/

echo ===========================================
echo  All services started successfully!
echo  Frontend: http://localhost:5173/
echo  Backend:  http://localhost:8000/
echo ===========================================

pause
