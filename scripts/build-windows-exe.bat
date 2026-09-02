@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0.."

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm non trovati.
  pause
  exit /b 1
)

set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run electron:build
if errorlevel 1 (
  echo Build fallita.
  pause
  exit /b 1
)

set "DEST=%USERPROFILE%\Desktop\app\priorato"
mkdir "%DEST%" >nul 2>&1
copy /Y "release\Priorato-Accoglienza-Setup-0.1.0.exe" "%DEST%\Priorato Accoglienza Setup.exe" >nul
echo.
echo Pronto: %DEST%\Priorato Accoglienza Setup.exe
echo.
pause
