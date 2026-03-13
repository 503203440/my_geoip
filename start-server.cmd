@echo off
echo ========================================
echo   GeoIP 服务启动工具
echo ========================================
echo.

REM 检查 .env 文件是否存在
if not exist ".env" (
    echo [警告] .env 文件不存在!
    echo.
    echo 建议先配置 .env 文件以获得完整功能
    echo 复制示例配置：copy .env.example .env
    echo.
    choice /C YN /M "是否继续启动服务"
    if errorlevel 2 exit /b 1
)

echo [信息] 启动 GeoIP 服务...
echo.

bun --env-file=.env run index.ts
