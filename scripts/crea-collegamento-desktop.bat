@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT="

rem Eseguito da priorato-app\scripts\
if exist "%~dp0..\package.json" (
  set "ROOT=%~dp0.."
)

rem Eseguito da cartella installazione (priorato-app come sottocartella)
if not defined ROOT if exist "%~dp0priorato-app\package.json" (
  set "ROOT=%~dp0priorato-app"
)

rem Eseguito dalla root priorato-app
if not defined ROOT if exist "%~dp0package.json" (
  set "ROOT=%~dp0"
)

if not defined ROOT (
  echo.
  echo Non trovo la cartella dell'app priorato-app.
  echo.
  echo Prova cosi:
  echo   1. Apri la cartella dove hai copiato priorato-app
  echo   2. Doppio clic su "CREA ICONA DESKTOP.bat" dentro quella cartella
  echo.
  echo Oppure apri priorato-app\scripts\ e lancia crea-collegamento-desktop.bat
  echo.
  pause
  exit /b 1
)

for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "LAUNCHER=%ROOT%\scripts\avvia-priorato.bat"

if not exist "%LAUNCHER%" (
  echo.
  echo Cartella trovata ma manca il file:
  echo %LAUNCHER%
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = '%ROOT%'; $launcher = '%LAUNCHER%'; $desktop = [Environment]::GetFolderPath('Desktop'); $lnk = Join-Path $desktop 'Priorato Accoglienza.lnk'; $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk); $s.TargetPath = $launcher; $s.WorkingDirectory = $root; $s.WindowStyle = 7; $s.Description = 'Avvia Priorato Accoglienza nel browser'; $s.Save(); Write-Host ''; Write-Host 'Collegamento creato:'; Write-Host $lnk"

if errorlevel 1 (
  echo.
  echo Errore nella creazione del collegamento.
  pause
  exit /b 1
)

echo.
pause
