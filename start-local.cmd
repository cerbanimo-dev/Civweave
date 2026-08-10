@echo off
set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8787
if "%DATA_DIR%"=="" set DATA_DIR=./data
echo Starting Civweave v1.0.27 clean-slate host on http://0.0.0.0:%PORT%
node releases/1.0.81/server/launch-archived.mjs
