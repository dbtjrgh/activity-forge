@echo off
rem Opens the activity mass-production screen in a browser.
rem
rem NOTE: comments here are ASCII on purpose. cmd.exe parses .bat files with the
rem system ANSI codepage, so Korean text in a .bat gets mangled and the broken
rem bytes are read as commands. See ../CLAUDE.md.
rem
rem Must run from this folder - node_modules lives here. A desktop shortcut is
rem fine because %~dp0 still points back here.
rem
rem The issue repos (sparkon_mNN) are found through workRoot in .user.json.
rem Since 2026-09-11 this repo lives outside the work folder, so sibling-folder
rem lookup no longer applies. Check the work folder shown at the top of the screen.
rem
rem To change the port:  forge-ui.bat 5301
cd /d "%~dp0"
call yarn forge ui %1
rem Keep the window so a crash message stays readable.
pause
