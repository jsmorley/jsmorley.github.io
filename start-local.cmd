@echo off
cd /d "%~dp0"
echo Open http://localhost:4000 for read-only viewing.
echo Open http://localhost:4000/editor.html to edit on this PC.
echo Keep Pageant running with your GitHub key loaded.
echo Keep this window open. Press Ctrl+C to stop.
python -u tools/local_server.py
if errorlevel 1 pause
