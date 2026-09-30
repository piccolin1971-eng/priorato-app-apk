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

for /f %%i in ('node -p "require('./package.json').version"') do set "APPVER=%%i"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "APPDATE=%%i"

set "DEST=%USERPROFILE%\Desktop\app\priorato"
mkdir "%DEST%" >nul 2>&1

set "SETUP_SRC=release\Priorato-Accoglienza-Setup-%APPVER%.exe"
set "PORTABLE_SRC=release\Priorato-Accoglienza-%APPVER%.exe"
set "SETUP_DST=%DEST%\Priorato-Accoglienza-Setup-%APPVER%-%APPDATE%.exe"
set "PORTABLE_DST=%DEST%\Priorato-Accoglienza-%APPVER%-%APPDATE%.exe"

copy /Y "%SETUP_SRC%" "%SETUP_DST%" >nul
if errorlevel 1 (
  echo Non trovato: %SETUP_SRC%
  pause
  exit /b 1
)
copy /Y "%PORTABLE_SRC%" "%PORTABLE_DST%" >nul
if errorlevel 1 (
  echo Non trovato: %PORTABLE_SRC%
  pause
  exit /b 1
)

powershell -NoProfile -Command "Unblock-File -LiteralPath '%SETUP_DST%'; Unblock-File -LiteralPath '%PORTABLE_DST%'"
echo.
echo Pronto:
echo   %SETUP_DST%
echo   %PORTABLE_DST%
echo.
pause
