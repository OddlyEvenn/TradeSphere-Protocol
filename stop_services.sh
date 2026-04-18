# #!/bin/bash

# # Port configurations
# BACKEND_PORT=5000
# FRONTEND_PORT=5173

# echo "---------------------------------------"
# echo "Stopping TradeSphere Protocol Services"
# echo "---------------------------------------"

# # Function to kill process on a specific port (Windows compatible)
# kill_port() {
#     local port=$1
#     echo "Attempting to stop process on port $port..."
    
#     if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
#         # Windows (Git Bash / Cygwin)
#         pid=$(netstat -ano | findstr :$port | awk '{print $5}' | head -n 1)
#         if [ ! -z "$pid" ]; then
#             taskkill //F //PID $pid
#             echo "Process on port $port (PID: $pid) has been terminated."
#         else
#             echo "No process found running on port $port."
#         fi
#     else
#         # Linux / MacOS
#         if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
#             lsof -ti :$port | xargs kill -9
#             echo "Process on port $port has been terminated."
#         else
#             echo "No process found running on port $port."
#         fi
#     fi
# }

# # Stop Frontend
# kill_port $FRONTEND_PORT

# # Stop Backend
# kill_port $BACKEND_PORT

# echo "---------------------------------------"
# echo "Stop sequence complete."
# echo "---------------------------------------"


@echo off

set BACKEND_PORT=5001
set FRONTEND_PORT=5173

echo ---------------------------------------
echo NUCLEAR STOP: TradeSphere Services
echo ---------------------------------------

:: Kill processes on specific ports
for %%p in (%BACKEND_PORT% %FRONTEND_PORT%) do (
    echo Checking port %%p...

    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        echo Killing PID %%a on port %%p
        taskkill /F /PID %%a >nul 2>&1
    )

    echo Port %%p cleared
)

echo ---------------------------------------
echo Killing ALL Node processes...
echo ---------------------------------------

taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM nodemon.exe >nul 2>&1
taskkill /F /IM ts-node.exe >nul 2>&1

echo All Node processes terminated

echo ---------------------------------------
echo Final port check
echo ---------------------------------------

echo Port 5001:
netstat -ano | findstr :5001 || echo FREE

echo Port 5173:
netstat -ano | findstr :5173 || echo FREE

echo ---------------------------------------
echo DONE
echo ---------------------------------------

pause