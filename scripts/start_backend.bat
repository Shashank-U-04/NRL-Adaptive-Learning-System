@echo off
echo ===================================
echo   NRL 2.0 Backend Server
echo ===================================
echo.
echo Starting FastAPI on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
pause
