@echo off
REM DegenClaw CLI (Git Bash gerekir). Ornek: degenclaw.cmd leaderboard
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
bash "%ROOT%\degenclaw-run.sh" %*
