# Start backend + frontend for Resume Screening
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting backend on http://127.0.0.1:8000 ..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\backend'; .\venv\Scripts\activate; uvicorn main:app --reload --port 8000"
)

Start-Sleep -Seconds 2

Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd '$root\frontend'; npm run dev"
)

Write-Host ""
Write-Host "Open http://localhost:5173 in your browser."
Write-Host "Keep both terminal windows open while using the app."
