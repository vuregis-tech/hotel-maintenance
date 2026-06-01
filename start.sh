#!/bin/bash
set -e

cd "$(dirname "$0")"

PYEXEC=/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python
SITE="$(pwd)/venv/lib/python3.9/site-packages"

echo "🏨 Hotel Maintenance System"
echo "==========================="

# Kill old processes
pkill -f "uvicorn.run" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start backend
echo "▶️  Starting backend (port 8000)..."
$PYEXEC -u -c "
import sys
sys.path.insert(0, '$SITE')
import uvicorn
uvicorn.run('backend.main:app', host='127.0.0.1', port=8000, log_level='info')
" > /tmp/hotel_backend.log 2>&1 &

BACKEND_PID=$!
sleep 3

# Check backend started
if curl -s http://127.0.0.1:8000/api/areas > /dev/null 2>&1; then
    echo "✅ Backend running (PID: $BACKEND_PID)"
else
    echo "❌ Backend failed to start. Check /tmp/hotel_backend.log"
    exit 1
fi

# Start frontend
echo "▶️  Starting frontend (port 5173)..."
npm run dev > /tmp/hotel_frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

echo ""
echo "✅ System is ready!"
echo ""
echo "🌐 Open: http://localhost:5173"
echo "👤 Admin: admin / admin1234"
echo ""
echo "Logs:"
echo "  Backend:  /tmp/hotel_backend.log"
echo "  Frontend: /tmp/hotel_frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
