@echo off
set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8787
if "%DATA_DIR%"=="" set DATA_DIR=./data
echo Starting Commonweave v1.0.27 clean-slate host on http://0.0.0.0:%PORT%
node server-v127.mjs
