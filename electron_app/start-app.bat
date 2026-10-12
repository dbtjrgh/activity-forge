@echo off
rem Starts SparkOn Manager with this console window visible (to read the output).
rem ASCII only on purpose: cmd.exe parses .bat with the ANSI codepage (see ..\CLAUDE.md).
rem The steps live in start-app.ps1 only. The desktop shortcut runs start-app.vbs,
rem which starts the same script with no window and writes start-app.log.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1" -Console
rem Keep the window so a crash message stays readable.
pause
