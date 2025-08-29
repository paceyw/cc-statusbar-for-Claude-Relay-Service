#!/usr/bin/env node

/**
 * 一键安装脚本
 * 本地打包并安装Claude Code StatusBar
 */

// 设置控制台编码支持
if (process.platform === 'win32') {
    // Windows 控制台 UTF-8 编码支持
    try {
        process.stdout.write('\x1b]0;Claude Code StatusBar Installer\x07');
    } catch (e) {
        // 忽略编码错误
    }
}

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const COLORS = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

/**
 * Windows 控制台 Emoji 兼容函数
 * 在不支持 Unicode emoji 的环境中使用文本替代
 */
function safeEmoji(emoji, fallback = '') {
    // Windows 命令提示符 emoji 兼容性检查
    if (process.platform === 'win32') {
        const isModernTerminal = process.env.WT_SESSION || 
                                process.env.TERM_PROGRAM === 'vscode' ||
                                process.env.ConEmuPID;
        if (!isModernTerminal) {
            return fallback;
        }
    }
    return emoji;
}

function log(message, color = COLORS.reset) {
    // 替换常用 emoji 为兼容版本
    const safeMessage = message
        .replace(/🔍/g, safeEmoji('🔍', '[检查]'))
        .replace(/📦/g, safeEmoji('📦', '[包]'))
        .replace(/🔧/g, safeEmoji('🔧', '[配置]'))
        .replace(/🔄/g, safeEmoji('🔄', '[处理]'))
        .replace(/🔗/g, safeEmoji('🔗', '[链接]'))
        .replace(/⚙️/g, safeEmoji('⚙️', '[设置]'))
        .replace(/✅/g, safeEmoji('✅', '[成功]'))
        .replace(/❌/g, safeEmoji('❌', '[失败]'))
        .replace(/⚠️/g, safeEmoji('⚠️', '[警告]'))
        .replace(/🎉/g, safeEmoji('🎉', '[完成]'))
        .replace(/💡/g, safeEmoji('💡', '[提示]'))
        .replace(/📝/g, safeEmoji('📝', '[记录]'))
        .replace(/🚀/g, safeEmoji('🚀', '[启动]'))
        .replace(/📋/g, safeEmoji('📋', '[列表]'))
        .replace(/🧪/g, safeEmoji('🧪', '[测试]'));
    
    console.log(`${color}${safeMessage}${COLORS.reset}`);
}

function exec(command, options = {}) {
    try {
        const result = execSync(command, { 
            stdio: options.silent ? 'pipe' : 'inherit',
            encoding: 'utf8',
            ...options 
        });
        return result;
    } catch (error) {
        if (!options.silent) {
            log(`❌ 命令执行失败: ${command}`, COLORS.red);
        }
        throw error;
    }
}

function showBanner() {
    log('', COLORS.reset);
    log('╔══════════════════════════════════════╗', COLORS.cyan);
    log('║      Claude Code StatusBar 安装器    ║', COLORS.cyan);
    log('║                                      ║', COLORS.cyan);
    log('║    🚀 一键打包并全局安装              ║', COLORS.cyan);
    log('╚══════════════════════════════════════╝', COLORS.cyan);
    log('', COLORS.reset);
}

function checkEnvironment() {
    log('🔍 检查环境...', COLORS.blue);
    
    // 检查是否在项目根目录
    if (!fs.existsSync('package.json') || !fs.existsSync('statusline.js')) {
        throw new Error('请在项目根目录运行此脚本');
    }
    
    // 检查npm
    try {
        exec('npm --version', { silent: true });
        log('✅ npm环境正常', COLORS.green);
    } catch (error) {
        throw new Error('npm不可用，请安装Node.js');
    }
    
    // 检查管理员权限（Windows）
    if (process.platform === 'win32') {
        try {
            exec('net session', { silent: true });
            log('✅ 检测到管理员权限', COLORS.green);
        } catch (error) {
            log('⚠️  建议以管理员身份运行以避免权限问题', COLORS.yellow);
        }
    }
}

function buildPackage() {
    log('📦 开始打包...', COLORS.blue);
    
    try {
        // 运行build脚本
        exec('npm run build');
        
        // 查找生成的.tgz文件
        const files = fs.readdirSync('.');
        const tgzFiles = files.filter(f => f.endsWith('.tgz'));
        
        if (tgzFiles.length === 0) {
            throw new Error('没有找到生成的.tgz包文件');
        }
        
        // 使用最新的.tgz文件
        const tgzFile = tgzFiles.sort((a, b) => {
            return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
        })[0];
        
        log(`✅ 打包完成: ${tgzFile}`, COLORS.green);
        return tgzFile;
        
    } catch (error) {
        throw new Error(`打包失败: ${error.message}`);
    }
}

function uninstallExisting() {
    log('🔄 检查现有安装...', COLORS.blue);
    
    try {
        // 尝试卸载现有版本
        const result = exec('npm uninstall -g claude-code-statusbar', { silent: true });
        log('✅ 已卸载现有版本', COLORS.green);
    } catch (error) {
        // 如果没有安装过，忽略错误
        log('💡 没有发现现有安装', COLORS.reset);
    }
}

function installPackage(tgzFile) {
    log('📥 开始安装...', COLORS.blue);
    
    try {
        exec(`npm install -g ${tgzFile}`);
        log('✅ 安装完成', COLORS.green);
    } catch (error) {
        throw new Error(`安装失败: ${error.message}`);
    }
}

function verifyInstallation() {
    log('🧪 验证安装...', COLORS.blue);
    
    try {
        // 检查命令是否可用
        exec('cc-statusbar --help', { silent: true });
        log('✅ 命令行工具安装成功', COLORS.green);
        
        // 检查配置文件
        const homeDir = require('os').homedir();
        const settingsFile = path.join(homeDir, '.claude', 'settings.json');
        
        if (fs.existsSync(settingsFile)) {
            const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            if (settings.statusLine && settings.statusLine.command === 'cc-statusbar') {
                log('✅ Claude Code配置已更新', COLORS.green);
            } else {
                log('⚠️  Claude Code配置可能需要手动更新', COLORS.yellow);
            }
        } else {
            log('💡 Claude Code配置将在首次使用时创建', COLORS.reset);
        }
        
    } catch (error) {
        throw new Error(`安装验证失败: ${error.message}`);
    }
}

function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function configureStatusbar() {
    log('⚙️  配置Claude API状态栏...', COLORS.blue);
    log('', COLORS.reset);
    
    log('🔗 请提供您的Claude管理页面URL:', COLORS.bold);
    log('   通常格式类似：https://your-domain.com/admin-next/api-stats?apiId=your-api-id', COLORS.reset);
    log('   💡 获取方法：登录Claude管理后台 → API统计页面 → 复制完整URL', COLORS.cyan);
    log('', COLORS.reset);

    let apiUrl = '';
    while (!apiUrl) {
        apiUrl = await prompt('📝 请输入API统计页面URL: ');
        
        if (!apiUrl) {
            log('❌ URL不能为空', COLORS.red);
            continue;
        }
        
        if (!apiUrl.startsWith('http')) {
            log('❌ 请输入完整的HTTP/HTTPS URL', COLORS.red);
            apiUrl = '';
            continue;
        }
        
        // 确认URL
        log(`✅ 您输入的URL: ${apiUrl}`, COLORS.green);
        const confirm = await prompt('🔄 是否正确？(y/n): ');
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            apiUrl = '';
        }
    }

    log('', COLORS.reset);
    log('📊 状态栏显示格式:', COLORS.bold);
    log('  固定格式: 🟢Claude | 640 Requests | 37.4M Tokens | $23.48(23%) | 到期: 2025/09/21 | 更新: 21:30:45', COLORS.cyan);
    log('  支持自适应换行，超长时分两行显示', COLORS.reset);
    log('', COLORS.reset);

    // 创建配置文件
    const config = {
        "_comment": "Claude Code 状态栏配置文件 - 由安装脚本生成",
        "api": {
            "url": apiUrl,
            "timeout": 15000,
            "retryAttempts": 3,
            "retryDelay": 1000,
            "cacheTimeout": 30000
        },
        "display": {
            "showRequests": true,
            "showTokens": true,
            "showCost": true,
            "showPercentage": true,
            "showTrends": true,
            "showApiStats": false,
            "showExpiry": true,
            "showLastUpdate": true,
            "maxLineLength": 100,
            "enableMultiLine": true
        },
        "statusbar": {
            "updateInterval": 30,
            "separator": " | ",
            "icons": {
                "normal": "🟢",
                "warning": "🟡",
                "critical": "🔴",
                "error": "❌",
                "trending_up": "📈",
                "trending_down": "📉"
            }
        },
        "alerts": {
            "costWarningThreshold": 60,
            "costCriticalThreshold": 80,
            "enableNotifications": false
        },
        "cache": {
            "enablePersistent": true,
            "maxHistorySize": 10,
            "offlineMode": false
        },
        "debug": {
            "enableLogging": false,
            "logLevel": "info",
            "logFile": ".claude/statusbar.log"
        }
    };

    // 确保.claude目录存在
    const claudeDir = path.join(process.cwd(), '.claude');
    if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
    }

    // 保存配置文件
    const configPath = path.join(claudeDir, 'cc-statusbar-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    log('✅ 配置文件已保存到: .claude/cc-statusbar-config.json', COLORS.green);
    log('', COLORS.reset);

    return config;
}

function showSuccessMessage(config) {
    log('', COLORS.reset);
    log('╔══════════════════════════════════════╗', COLORS.green);
    log('║           🎉 安装成功！              ║', COLORS.green);
    log('╚══════════════════════════════════════╝', COLORS.green);
    log('', COLORS.reset);
    
    log('📋 当前配置:', COLORS.bold);
    log(`  API URL: ${config.api.url.substring(0, 50)}...`, COLORS.cyan);
    log(`  更新间隔: ${config.statusbar.updateInterval}秒`, COLORS.cyan);
    log(`  显示格式: 固定详细格式，支持自适应换行`, COLORS.cyan);
    log('', COLORS.reset);
    
    log('📋 使用方法:', COLORS.bold);
    log('  node statusline.js              # 测试状态栏输出', COLORS.green);
    log('', COLORS.reset);
    
    log('🚀 Claude Code中使用:', COLORS.bold);
    log('  1. 重启Claude Code', COLORS.yellow);
    log('  2. 状态栏将显示在输入框下方', COLORS.reset);
    log('  3. 格式：🟢 | 480 Requests | 27.8M Tokens | $17.83(18%) | 到期: 2025/09/21 | 更新: 21:30:45', COLORS.cyan);
    log('', COLORS.reset);
    
    log('🔧 配置管理:', COLORS.bold);
    log('  编辑文件: .claude/cc-statusbar-config.json', COLORS.reset);
    log('  查看指南: CONFIG-GUIDE.md', COLORS.reset);
    log('', COLORS.reset);
}

// 主函数
async function main() {
    try {
        showBanner();
        checkEnvironment();
        const tgzFile = buildPackage();
        uninstallExisting();
        installPackage(tgzFile);
        verifyInstallation();
        
        // 配置状态栏
        const config = await configureStatusbar();
        showSuccessMessage(config);
        
        // 测试配置
        log('🧪 测试配置...', COLORS.blue);
        log('   ⏳ 首次运行可能需要下载浏览器文件，请耐心等待...', COLORS.reset);
        try {
            const { exec } = require('child_process');
            exec('node statusline.js', { 
                cwd: process.cwd(), 
                timeout: 120000, // 增加到2分钟超时
                env: { ...process.env, NODE_ENV: 'production' }
            }, (error, stdout, stderr) => {
                if (error) {
                    if (error.code === 'TIMEOUT') {
                        log('⚠️  测试超时: StatusBar可能需要更长时间初始化', COLORS.yellow);
                        log('💡 这通常发生在首次运行时需要下载浏览器文件', COLORS.reset);
                        log('💡 您可以稍后手动运行 node statusline.js 测试配置', COLORS.reset);
                    } else {
                        log(`⚠️  测试失败: ${error.message}`, COLORS.yellow);
                        if (stderr) {
                            log(`   错误详情: ${stderr.slice(0, 200)}...`, COLORS.gray);
                        }
                        log('💡 常见解决方案:', COLORS.reset);
                        log('   • 检查API URL是否正确', COLORS.reset);
                        log('   • 检查网络连接是否正常', COLORS.reset);
                        log('   • 确保API服务器可访问', COLORS.reset);
                    }
                } else if (stdout.includes('❌')) {
                    log('⚠️  配置可能需要调整，请检查API URL是否正确', COLORS.yellow);
                    log(`   状态栏输出: ${stdout.slice(0, 100)}...`, COLORS.gray);
                } else {
                    log('✅ 配置测试通过', COLORS.green);
                    if (stdout) {
                        log(`   状态栏输出: ${stdout.slice(0, 100)}...`, COLORS.gray);
                    }
                }
            });
        } catch (testError) {
            log(`⚠️  测试执行错误: ${testError.message}`, COLORS.yellow);
            log('💡 可稍后手动运行 node statusline.js 测试配置', COLORS.reset);
        }
        
    } catch (error) {
        log('', COLORS.reset);
        log(`❌ 安装失败: ${error.message}`, COLORS.red);
        log('', COLORS.reset);
        log('🔧 可能的解决方案:', COLORS.bold);
        log('  • 以管理员身份运行此脚本', COLORS.reset);
        log('  • 检查网络连接', COLORS.reset);
        log('  • 手动运行: npm run build && npm install -g <生成的.tgz文件>', COLORS.reset);
        log('', COLORS.reset);
        process.exit(1);
    }
}

// 只在直接运行时执行
if (require.main === module) {
    main();
}

module.exports = { main };