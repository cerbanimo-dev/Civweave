@echo off
cd /d "%~dp0"
py -3 simulator.py --open
if errorlevel 1 pause
