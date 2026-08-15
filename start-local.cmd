@echo off
setlocal
if "%HOST%"=="" set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8787
if "%DATA_DIR%"=="" set DATA_DIR=./data
npm start
