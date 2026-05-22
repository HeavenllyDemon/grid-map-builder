@echo off
setlocal
cd /d "%~dp0"
set GRID_MAP_BUILDER_OPEN=1
node portable\server.mjs
pause
