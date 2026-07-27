$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$launcher = Join-Path $projectRoot "scripts\avvia-priorato.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Priorato Accoglienza.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $projectRoot.Path
$shortcut.WindowStyle = 7
$shortcut.Description = "Avvia Priorato Accoglienza nel browser"
$shortcut.Save()

Write-Host "Collegamento creato:"
Write-Host $shortcutPath
