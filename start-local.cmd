@echo off
set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8787
if "%DATA_DIR%"=="" set DATA_DIR=./data
node server.mjs
