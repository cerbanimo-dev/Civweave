@echo off
set PORT=4173
if not "%1"=="" set PORT=%1
where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  node server.mjs %PORT%
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  py -3 -m http.server %PORT% --bind 0.0.0.0
  goto :eof
)
echo Node.js or Python 3 is required.
exit /b 1
