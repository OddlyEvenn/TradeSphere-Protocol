#!/bin/bash

# Port for Backend
BACKEND_PORT=5000
# Port for Frontend
FRONTEND_PORT=5173

echo "---------------------------------------"
echo "Stopping TradeSphere Protocol Services"
echo "---------------------------------------"

# Stop Backend
echo "Attempting to stop Backend on port $BACKEND_PORT..."
if fuser $BACKEND_PORT/tcp >/dev/null 2>&1; then
    fuser -k $BACKEND_PORT/tcp
    echo "Backend process on port $BACKEND_PORT has been terminated."
else
    echo "No process found running on port $BACKEND_PORT."
fi

# Stop Frontend
echo "Attempting to stop Frontend on port $FRONTEND_PORT..."
if fuser $FRONTEND_PORT/tcp >/dev/null 2>&1; then
    fuser -k $FRONTEND_PORT/tcp
    echo "Frontend process on port $FRONTEND_PORT has been terminated."
else
    echo "No process found running on port $FRONTEND_PORT."
fi

echo "---------------------------------------"
echo "Stop sequence complete."
echo "---------------------------------------"
