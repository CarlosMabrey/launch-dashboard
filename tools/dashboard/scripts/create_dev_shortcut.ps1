$WshShell = New-Object -ComObject WScript.Shell
$ShortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Launcher.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""Set-Location -Path 'c:\launcher'; npm run electron-dev"""
$Shortcut.WorkingDirectory = "c:\launcher"
$Shortcut.IconLocation = "c:\launcher\assets\icon.ico"
$Shortcut.Description = "Launch JellyOS Launcher in Dev Mode"
$Shortcut.Save()

Write-Host "Shortcut created at: $ShortcutPath"
