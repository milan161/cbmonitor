@echo off
title CBMonitor Launcher
echo ========================================
echo  Starting CBMonitor - 可转债监控系统...
echo ========================================

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "BACKEND=%SCRIPT_DIR%\src\backend"
set "FRONTEND=%SCRIPT_DIR%\src\frontend"

:: Kill leftover ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8100 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak > nul

:: Start Backend
echo [1/2] Starting Backend (port 8100)...
start "CBMonitor Backend" cmd /k "cd /d %BACKEND% && python main.py"

echo Waiting 5 seconds for backend...
timeout /t 5 /nobreak > nul

:: Start Frontend
echo [2/2] Starting Frontend (port 5174)...
start "CBMonitor Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"

echo.
echo ========================================
echo  Backend : http://127.0.0.1:8100
echo  Frontend: http://localhost:5174
echo  API Docs: http://127.0.0.1:8100/docs
echo ========================================
timeout /t 3 /nobreak > nul
start http://localhost:5174
echo Done.
