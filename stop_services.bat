@echo off
set BACKEND_PORT=5000
set FRONTEND_PORT=5173

echo ---------------------------------------
echo Stopping TradeSphere Protocol Services
echo ---------------------------------------

echo Checking port %BACKEND_PORT% (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    echo Terminating Backend PID: %%a
    taskkill /F /PID %%a
)

echo Checking port %FRONTEND_PORT% (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    echo Terminating Frontend PID: %%a
    taskkill /F /PID %%a
)

echo ---------------------------------------
echo Stop sequence complete. All ports cleared.
echo ---------------------------------------
timeout /t 3
