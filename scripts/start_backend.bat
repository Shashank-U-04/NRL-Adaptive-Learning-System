@echo off
echo ===================================
echo   NRL Adaptive Learning System Backend Server
echo ===================================
echo.
echo Starting FastAPI on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
cd /d "%~dp0..\backend"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
