@echo off
set BACKEND_PORT=5001
set FRONTEND_PORT=5173
set BASE_DIR=%~dp0

echo ---------------------------------------
echo TradeSphere Protocol: Start Sequence (Integrated)
echo ---------------------------------------

echo [1/3] Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul

echo [2/3] Starting Backend (Background)...
:: Running in background within the SAME terminal
start /B cmd /c "cd /d %BASE_DIR%backend && npm run dev"

echo [3/3] Starting Frontend (Foreground)...
echo Rendering Trade Finance Protocol in 5s...
timeout /t 5 /nobreak >nul

cd /d "%BASE_DIR%frontend"
npm run dev

pause
