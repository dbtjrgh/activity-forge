' Starts SparkOn Manager without a console window (desktop shortcut target).
' ASCII only on purpose. The work is in start-app.ps1; output goes to start-app.log.
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\start-app.ps1""", 0, False
