#!/bin/bash

# Port configurations
BACKEND_PORT=5000
FRONTEND_PORT=5173

echo "---------------------------------------"
echo "TradeSphere Protocol: Start Sequence"
echo "---------------------------------------"

# Function to kill process on a specific port (Windows compatible)
kill_port() {
    local port=$1
    echo "Checking port $port..."
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Windows (Git Bash / Cygwin)
        pid=$(netstat -ano | findstr :$port | awk '{print $5}' | head -n 1)
        if [ ! -z "$pid" ]; then
            echo "Killing process on port $port (PID: $pid)..."
            taskkill //F //PID $pid
        fi
    else
        # Linux / MacOS
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
            echo "Killing process on port $port..."
            lsof -ti :$port | xargs kill -9
        fi
    fi
}

# 1. Stop existing services
kill_port $FRONTEND_PORT
kill_port $BACKEND_PORT

echo "---------------------------------------"
echo "Starting Backend Service..."
echo "---------------------------------------"
cd backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start (simple delay)
sleep 2

echo "---------------------------------------"
echo "Starting Frontend Service..."
echo "---------------------------------------"
cd ../frontend
npm run dev

# Cleanup background process on exit
trap "kill $BACKEND_PID" EXIT
