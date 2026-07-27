@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "ROOT=%~dp0.."
set "URL=http://localhost:5173"
set "LOG=%ROOT%\priorato-server.log"
set "STARTED_SERVER=0"
cd /d "%ROOT%"

for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "LOG=%ROOT%\priorato-server.log"
rem Profilo browser fuori dal progetto: evita che Vite crashi sul watch di Chrome
set "PROFILE=%LOCALAPPDATA%\PrioratoAccoglienza\browser-profile"

if not defined PRIORATO_BROWSER set "PRIORATO_BROWSER=chrome"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm non trovati. Installa Node.js da https://nodejs.org
  pause
  exit /b 1
)

if not exist "%ROOT%\node_modules\" (
  echo.
  echo Manca node_modules. Apri Prompt comandi in:
  echo %ROOT%
  echo e lancia:  npm install
  echo.
  pause
  exit /b 1
)

call :server_ready
if %ERRORLEVEL%==0 goto open_browser

echo Avvio server Priorato...
set "STARTED_SERVER=1"
start "Priorato server" /MIN "%ROOT%\scripts\start-server.bat"

set /a WAIT_COUNT=0
:wait_loop
timeout /t 1 /nobreak >nul
call :server_ready
if %ERRORLEVEL%==0 goto open_browser
set /a WAIT_COUNT+=1
if %WAIT_COUNT% LSS 60 goto wait_loop

echo.
echo Il server non risponde dopo 60 secondi.
if exist "%LOG%" (
  echo.
  echo Ultime righe del log (%LOG%):
  echo ----------------------------------------
  powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 15"
  echo ----------------------------------------
)
echo.
echo Controlla anche la finestra minimizzata "Priorato server".
pause
if "%STARTED_SERVER%"=="1" call :stop_server
exit /b 1

:open_browser
if /I "%PRIORATO_BROWSER%"=="edge" goto open_edge
goto open_chrome

:open_chrome
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app=%URL% --new-window --user-data-dir="%PROFILE%"
  exit /b 0
)
echo Chrome non trovato, provo con Edge...
goto open_edge

:open_edge
set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%URL% --new-window --user-data-dir="%PROFILE%"
  exit /b 0
)

echo Nessun browser trovato. Installa Google Chrome o Microsoft Edge.
if "%STARTED_SERVER%"=="1" call :stop_server
pause
exit /b 1

:stop_server
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
)
exit /b 0

:server_ready
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
exit /b %ERRORLEVEL%
