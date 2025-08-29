#!/usr/bin/env node

/**
 * Claude Code StatusBar - 全局可执行文件
 * 用于全局安装后在任意目录调用
 */

const path = require('path');
const { spawn } = require('child_process');

// 获取当前模块的安装路径
const moduleDir = path.resolve(__dirname, '..');
const statuslineScript = path.join(moduleDir, 'statusline.js');

// 传递所有命令行参数
const args = process.argv.slice(2);

// 启动statusline脚本
const child = spawn('node', [statuslineScript, ...args], {
    stdio: 'inherit',
    cwd: moduleDir
});

// 处理退出
child.on('exit', (code) => {
    process.exit(code);
});

// 处理错误
child.on('error', (err) => {
    console.error('启动statusline失败:', err.message);
    process.exit(1);
});