@echo off
echo [Claude Code Statusbar] 正在配置Windows环境...

REM 获取插件安装路径
set PLUGIN_PATH=%~dp0statusline.js

REM 创建Claude配置目录
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"

REM 备份现有配置
if exist "%USERPROFILE%\.claude\settings.json" (
    copy "%USERPROFILE%\.claude\settings.json" "%USERPROFILE%\.claude\settings.json.backup" >nul 2>&1
)

REM 生成新的settings.json配置
echo {> "%USERPROFILE%\.claude\settings.json"
echo   "statusLine": {>> "%USERPROFILE%\.claude\settings.json"
echo     "type": "command",>> "%USERPROFILE%\.claude\settings.json"
echo     "command": "%PLUGIN_PATH%">> "%USERPROFILE%\.claude\settings.json"
echo   }>> "%USERPROFILE%\.claude\settings.json"
echo }>> "%USERPROFILE%\.claude\settings.json"

echo [Claude Code Statusbar] 配置完成！
echo.
echo 请设置环境变量 CC_SCRAPE_URL 为您的API地址：
echo set CC_SCRAPE_URL=https://your-domain.com:6443/admin-next/api-stats?apiId=your-api-id
echo.
echo 然后重启Claude Code即可看到状态栏。
pause