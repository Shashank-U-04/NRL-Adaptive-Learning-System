# NRL - One-shot Windows dev setup. Idempotent; safe to re-run.

$ErrorActionPreference = "Stop"

Write-Host "================================================="
Write-Host " NRL Adaptive Learning - local dev setup (Windows)"
Write-Host "================================================="

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

# Python resolution: prefer C:\nrl_venv (short path for torch), fallback to .venv
$pythonExe = $null
if (Test-Path "C:\nrl_venv\Scripts\python.exe") {
    $pythonExe = "C:\nrl_venv\Scripts\python.exe"
    Write-Host "[setup] using existing venv at C:\nrl_venv"
} elseif (Test-Path "$root\.venv\Scripts\python.exe") {
    $pythonExe = "$root\.venv\Scripts\python.exe"
    Write-Host "[setup] using existing venv at .venv"
} else {
    Write-Host "[setup] creating .venv at repo root"
    python -m venv "$root\.venv"
    $pythonExe = "$root\.venv\Scripts\python.exe"
}

Write-Host "[setup] installing backend deps"
& $pythonExe -m pip install --upgrade pip --quiet
& $pythonExe -m pip install -r "$root\backend\requirements.txt" --quiet

Write-Host "[setup] installing frontend deps"
Push-Location "$root\frontend"
try {
    npm install --silent
} finally {
    Pop-Location
}

if (-not (Test-Path "$root\.env")) {
    Write-Host "[setup] creating .env from .env.example"
    Copy-Item "$root\.env.example" "$root\.env"
    Write-Host ""
    Write-Host " WARNING: .env created with defaults. Edit it before running:"
    Write-Host "    - DATABASE_URL  (Neon connection string)"
    Write-Host "    - SECRET_KEY    (long random value for prod)"
    Write-Host ""
}

Write-Host ""
Write-Host "Setup complete."
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Start Ollama in a separate terminal:   ollama serve"
Write-Host "  2. Seed the database (one time):"
Write-Host "       `$env:PYTHONPATH = '$root'"
Write-Host "       & '$pythonExe' -m backend.seed"
Write-Host "  3. Run frontend + backend together:       .\scripts\run-dev.ps1"
