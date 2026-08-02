@echo off
set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8787
if "%DATA_DIR%"=="" set DATA_DIR=./data
echo Starting Commonweave v1.0.26 diagnostic host on http://0.0.0.0:%PORT%
node server-v126.mjs
