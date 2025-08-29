@echo off
echo 正在安装 Claude Code StatusBar...
echo.

REM 检查是否有管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 警告: 建议以管理员身份运行此脚本
    echo.
)

REM 运行安装脚本
node install.js

if %errorLevel% neq 0 (
    echo.
    echo 安装失败！请查看上述错误信息
    pause
    exit /b 1
)

echo.
echo 安装完成！按任意键退出...
pause >nul