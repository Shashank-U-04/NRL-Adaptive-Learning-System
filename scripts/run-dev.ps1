# NRL - Windows PowerShell launcher (no WSL/foreman required)
# Starts backend (uvicorn) and frontend (npm) in parallel and tails both.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

# Python resolution order:
#   1. C:\nrl_venv  (local short-path venv used for torch on Windows)
#   2. .venv at repo root
#   3. python on PATH
$pythonExe = if (Test-Path "C:\nrl_venv\Scripts\python.exe") {
    "C:\nrl_venv\Scripts\python.exe"
} elseif (Test-Path "$root\.venv\Scripts\python.exe") {
    "$root\.venv\Scripts\python.exe"
} else {
    "python"
}

# Imports use `backend.app.*` so PYTHONPATH must be the repo root.
$env:PYTHONPATH = $root

Write-Host ""
Write-Host "Starting NRL dev servers..."
Write-Host "  python   -> $pythonExe"
Write-Host "  backend  -> http://localhost:8000"
Write-Host "  frontend -> http://localhost:3000"
Write-Host ""

$backend = Start-Process -FilePath $pythonExe `
    -ArgumentList "-m", "uvicorn", "backend.app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000" `
    -WorkingDirectory $root `
    -PassThru -NoNewWindow

$frontend = Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory "$root\frontend" `
    -PassThru -NoNewWindow

try {
    Wait-Process -Id $backend.Id, $frontend.Id
}
finally {
    if (-not $backend.HasExited)  { Stop-Process -Id $backend.Id  -Force -ErrorAction SilentlyContinue }
    if (-not $frontend.HasExited) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
}
