@echo off
rem Double-click this file to start the local dev server and open the browser.
rem To stop: close the "Jintoria Dev Server" window (or press Ctrl+C in it).
cd /d "%~dp0"
set PATH=%PATH%;C:\Program Files\nodejs
start "Jintoria Dev Server" cmd /k npx.cmd http-server -c-1 -p 8080 .
ping -n 3 127.0.0.1 >nul
start "" http://127.0.0.1:8080/shell.html
