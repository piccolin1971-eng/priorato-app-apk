@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set "LOG=%CD%\priorato-server.log"
echo [%date% %time%] Avvio server in %CD% > "%LOG%"

where npm >nul 2>&1
if errorlevel 1 (
  echo ERRORE: npm non trovato. Installa Node.js. >> "%LOG%"
  exit /b 1
)

if not exist "node_modules\" (
  echo ERRORE: cartella node_modules mancante. >> "%LOG%"
  echo Esegui: npm install >> "%LOG%"
  exit /b 1
)

call npm run dev >> "%LOG%" 2>&1
echo [%date% %time%] Server terminato, codice %ERRORLEVEL% >> "%LOG%"
exit /b %ERRORLEVEL%
