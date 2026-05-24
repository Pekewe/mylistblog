@echo off
title 发布清单总站 - 服务器
echo 正在启动服务器...
echo.
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "server/app.js"
pause
