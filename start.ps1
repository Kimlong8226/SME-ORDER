Write-Host "===========================================" -ForegroundColor Green
Write-Host " Starting Central Kitchen Order System..." -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# 1. 启动后端 FastAPI
$BackendDir = Join-Path $ScriptDir "backend"
Start-Process cmd -ArgumentList "/k cd /d ""$BackendDir"" && python -m uvicorn main:app --port 8000" -WindowStyle Normal

Start-Sleep -Seconds 2

# 2. 启动前端 Vite
$FrontendDir = Join-Path $ScriptDir "frontend"
Start-Process cmd -ArgumentList "/k cd /d ""$FrontendDir"" && npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# 3. 打开浏览器
Start-Process "http://localhost:5173/"

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host " Frontend: http://localhost:5173/" -ForegroundColor Cyan
Write-Host " Backend:  http://localhost:8000/" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
