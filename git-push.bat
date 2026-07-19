@echo off
chcp 65001 > nul
echo =====================================
echo    SME-ORDER 一键 Git 推送脚本
echo =====================================

REM 1. 添加所有修改
echo 正在暂存修改 (git add .)...
git add .

REM 2. 提交修改
set /p commit_msg="请输入本次提交的说明 (直接回车默认使用 'update'): "
if "%commit_msg%"=="" set commit_msg=update

echo 正在本地提交 (git commit)...
git commit -m "%commit_msg%"

REM 3. 推送到 GitHub
echo 正在推送到 GitHub (git push)...
git push origin main

echo =====================================
echo    推送完成！
echo =====================================
pause
