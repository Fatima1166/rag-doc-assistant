@echo off
rem Starts the FastAPI backend - no Docker needed.
rem Usage: backend\run.cmd (or "npm run backend" from the project root)
cd /d "%~dp0"
set "PYTHONPATH=%~dp0;%~dp0..\.venv\Lib\site-packages;%PYTHONPATH%"

if exist "C:\Python314\python.exe" (
  "C:\Python314\python.exe" -m app.main
) else if exist "..\.venv\Scripts\python.exe" (
  "..\.venv\Scripts\python.exe" -m app.main
) else (
  python -m app.main
)
