#!/bin/bash

echo "正在安装 Claude Code StatusBar..."
echo

# 检查是否有sudo权限
if [ "$EUID" -ne 0 ]; then 
    echo "提示: 如果遇到权限问题，请使用 sudo 运行此脚本"
    echo
fi

# 运行安装脚本
node install.js

if [ $? -ne 0 ]; then
    echo
    echo "安装失败！请查看上述错误信息"
    exit 1
fi

echo
echo "安装完成！"