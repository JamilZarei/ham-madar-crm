@echo off
setlocal
set "CRM_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

"%CRM_PS%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-crm.ps1" %*
set "CRM_EXIT=%ERRORLEVEL%"
if not "%CRM_EXIT%"=="0" (
    echo CRM startup failed. Review the error above.
    pause
)
exit /b %CRM_EXIT%
