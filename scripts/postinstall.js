#!/usr/bin/env node

/**
 * 安装后配置脚本
 * 自动配置全局Claude Code设置
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const COLORS = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
}

// 获取Claude配置目录路径
function getClaudeConfigDir() {
    const homeDir = os.homedir();
    return path.join(homeDir, '.claude');
}

// 创建全局Claude Code配置
function setupGlobalConfig() {
    try {
        const claudeDir = getClaudeConfigDir();
        const settingsFile = path.join(claudeDir, 'settings.json');
        
        // 确保.claude目录存在
        if (!fs.existsSync(claudeDir)) {
            fs.mkdirSync(claudeDir, { recursive: true });
            log(`✅ 已创建Claude配置目录: ${claudeDir}`, COLORS.green);
        }
        
        // 检查现有配置
        let settings = {};
        if (fs.existsSync(settingsFile)) {
            const content = fs.readFileSync(settingsFile, 'utf8');
            try {
                settings = JSON.parse(content);
                log(`📝 发现现有配置文件`, COLORS.yellow);
            } catch (e) {
                log(`⚠️  配置文件格式错误，将创建新的配置`, COLORS.yellow);
            }
        }
        
        // 添加或更新statusLine配置
        settings.statusLine = {
            type: "command",
            command: "cc-statusbar",
            args: [],
            refreshInterval: 60000
        };
        
        // 保存配置
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        log(`✅ 已更新全局Claude Code配置`, COLORS.green);
        log(`📍 配置文件位置: ${settingsFile}`, COLORS.reset);
        
        return true;
    } catch (error) {
        log(`❌ 配置失败: ${error.message}`, COLORS.red);
        return false;
    }
}

// 显示安装完成信息
function showInstallationInfo() {
    log(``, COLORS.reset);
    log(`${COLORS.bold}🎉 Claude Code StatusBar 安装完成！${COLORS.reset}`, COLORS.green);
    log(``, COLORS.reset);
    log(`📋 使用方法:`, COLORS.bold);
    log(`  • 全局命令: cc-statusbar 或 claude-statusbar`, COLORS.reset);
    log(`  • 测试状态栏: cc-statusbar`, COLORS.reset);
    log(`  • 查看帮助: cc-statusbar --help`, COLORS.reset);
    log(``, COLORS.reset);
    log(`🔧 配置Claude Code:`, COLORS.bold);
    log(`  • 全局配置已自动设置`, COLORS.green);
    log(`  • 重启Claude Code即可生效`, COLORS.yellow);
    log(`  • 配置文件: ~/.claude/settings.json`, COLORS.reset);
    log(``, COLORS.reset);
    log(`📚 更多信息请查看: https://github.com/PaceyWang/claude-code-statusbar`, COLORS.reset);
    log(``, COLORS.reset);
}

// 主函数
function main() {
    try {
        log(`🚀 正在配置Claude Code StatusBar...`, COLORS.bold);
        
        const configSuccess = setupGlobalConfig();
        
        if (configSuccess) {
            showInstallationInfo();
        } else {
            log(`❌ 安装完成但配置可能有问题，请手动检查配置`, COLORS.red);
        }
        
    } catch (error) {
        log(`❌ 安装配置失败: ${error.message}`, COLORS.red);
        process.exit(1);
    }
}

// 只在直接运行时执行
if (require.main === module) {
    main();
}

module.exports = { setupGlobalConfig };