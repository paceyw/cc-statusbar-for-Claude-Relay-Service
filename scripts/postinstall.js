#!/usr/bin/env node

/**
 * 安装后配置脚本（强韧版）
 * - 自动配置全局 Claude Code 设置
 * - 写入绝对 Node 路径与绝对 statusline.js 路径
 * - 指定 workingDirectory，避免 IDE 后台 PATH/工作目录差异
 * - 注入 env（CC_STATUS_MAXLEN 默认 120，CC_SCRAPE_URL 若安装环境存在则带入）
 * - 对 ~/.claude/settings.json 做安全备份与合并
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

// 新增：时间戳与路径工具
function ts() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(p) {
    try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

function getClaudePaths() {
    const claudeDir = path.join(os.homedir(), '.claude');
    const settingsFile = path.join(claudeDir, 'settings.json');
    const backupDir = path.join(claudeDir, '.backup');
    return { claudeDir, settingsFile, backupDir };
}

function resolveNodeAbsolute() {
    // 使用当前执行的 node 绝对路径，最稳妥
    return process.execPath;
}

function getPackageDir() {
    // scripts/postinstall.js 的上级为包根目录
    return path.resolve(__dirname, '..');
}

function getStatuslinePath() {
    return path.join(getPackageDir(), 'statusline.js');
}

function buildStatusLineConfig(options = {}) {
    const pkgDir = getPackageDir();
    const statuslineScript = path.join(pkgDir, 'statusline.js');
    
    const maxlen = String(options.maxlen || process.env.CC_STATUS_MAXLEN || '120');
    const scrapeUrl = options.scrapeUrl || process.env.CC_SCRAPE_URL;

    // 构建环境变量对象
    const envObj = {
        CC_STATUS_MAXLEN: maxlen,
    };
    if (scrapeUrl) envObj.CC_SCRAPE_URL = scrapeUrl;

    // 使用与本地工作配置完全相同的格式
    // 这是Claude Code实际期望的配置格式
    return {
        type: 'command',
        command: `node "${statuslineScript}"`,  // 使用带引号的绝对路径，支持空格路径
        cwd: pkgDir,                           // 使用cwd而不是workingDirectory  
        interval: 60000,                       // 使用interval而不是refreshInterval
        shell: true,                           // 启用shell模式，这是关键！
        timeout: 10000,                        // 添加timeout字段
        env: envObj,                           // 环境变量
        description: "Claude API监控状态栏 - 显示请求、Token和费用统计（全局安装版）"
    };
}

// 创建/更新全局 Claude Code 配置（强韧版）
function setupGlobalConfig(options = {}) {
    try {
        const { claudeDir, settingsFile, backupDir } = getClaudePaths();
        ensureDir(claudeDir);
        ensureDir(backupDir);

        // 读取现有 settings
        let settings = {};
        if (fs.existsSync(settingsFile)) {
            try {
                const content = fs.readFileSync(settingsFile, 'utf8');
                settings = JSON.parse(content);
                log(`📝 检测到现有 ~/.claude/settings.json，准备备份并合并`, COLORS.yellow);
                // 备份旧文件
                const backupPath = path.join(backupDir, `settings.${ts()}.json`);
                fs.copyFileSync(settingsFile, backupPath);
                log(`📦 已备份到: ${backupPath}`, COLORS.yellow);
            } catch (e) {
                log(`⚠️  现有设置文件解析失败，将以空配置重建: ${e.message}`, COLORS.yellow);
                settings = {};
            }
        } else {
            log(`📁 首次创建 ~/.claude/settings.json`, COLORS.yellow);
        }

        const robust = buildStatusLineConfig(options);

        // 是否强制覆盖
        const force = Boolean(options.force);
        if (force || !settings.statusLine) {
            settings.statusLine = robust;
        } else {
            // 字段级合并，尽量保留用户其他字段
            const prev = settings.statusLine || {};
            settings.statusLine = {
                ...prev,
                ...robust,
                env: { ...(prev.env || {}), ...(robust.env || {}) }
            };
        }

        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        log(`✅ 已更新全局 Claude Code 配置`, COLORS.green);
        log(`📍 配置文件位置: ${settingsFile}`, COLORS.reset);
        log(`🧭 command: ${settings.statusLine.command}`, COLORS.reset);
        log(`🧩 args[0]: ${settings.statusLine.args && settings.statusLine.args[0]}`, COLORS.reset);
        log(`📂 workingDirectory: ${settings.statusLine.workingDirectory}`, COLORS.reset);
        return true;
    } catch (error) {
        log(`❌ 配置失败: ${error.message}`, COLORS.red);
        return false;
    }
}

// 显示安装完成信息（保持原有，但提示为强韧版）
function showInstallationInfo() {
    log(``, COLORS.reset);
    log(`${COLORS.bold}🎉 Claude Code StatusBar 安装完成！（已写入强韧版配置）${COLORS.reset}`, COLORS.green);
    log(``, COLORS.reset);
    log(`📋 使用方法:`, COLORS.bold);
    log(`  • 全局命令: cc-statusbar 或 claude-statusbar`, COLORS.reset);
    log(`  • 测试状态栏: cc-statusbar`, COLORS.reset);
    log(`  • 自修复: cc-statusbar repair`, COLORS.reset);
    log(`  • 查看帮助: cc-statusbar --help`, COLORS.reset);
    log(``, COLORS.reset);
    log(`🔧 配置Claude Code:`, COLORS.bold);
    log(`  • 全局配置已自动设置（绝对路径 + 工作目录 + env 注入）`, COLORS.green);
    log(`  • 重启 Claude Code 生效`, COLORS.yellow);
    log(`  • 配置文件: ~/.claude/settings.json`, COLORS.reset);
    log(``, COLORS.reset);
    log(`📚 更多信息请查看: https://github.com/PaceyWang/claude-code-statusbar`, COLORS.reset);
    log(``, COLORS.reset);
}

// 主函数
function main() {
    try {
        log(`🚀 正在配置 Claude Code StatusBar...`, COLORS.bold);
        const success = setupGlobalConfig({});
        if (success) {
            showInstallationInfo();
        } else {
            log(`❌ 安装完成但配置可能有问题，请手动检查配置或运行 cc-statusbar repair`, COLORS.red);
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

module.exports = { setupGlobalConfig, buildStatusLineConfig };