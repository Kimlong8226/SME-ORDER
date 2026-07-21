@echo off
chcp 65001 > nul
echo =====================================
echo    Git Push Script
echo =====================================

echo Adding changes...
git add .

set /p commit_msg="Enter commit message (Press Enter for default 'update'): "
if "%commit_msg%"=="" set commit_msg=update

echo Committing changes...
git commit -m "%commit_msg%"

echo Pushing to remote repository...
git push

echo =====================================
echo    Push Completed!
echo =====================================
pause