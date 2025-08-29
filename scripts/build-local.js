#!/usr/bin/env node

/**
 * 本地打包脚本
 * 用于创建可安装的npm包，无需发布到公共仓库
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
}

function exec(command, options = {}) {
    try {
        const result = execSync(command, { 
            stdio: 'inherit',
            encoding: 'utf8',
            ...options 
        });
        return result;
    } catch (error) {
        log(`❌ 命令执行失败: ${command}`, COLORS.red);
        throw error;
    }
}

function checkPrerequisites() {
    log('🔍 检查环境...', COLORS.blue);
    
    // 检查Node.js版本
    const nodeVersion = process.version;
    log(`📦 Node.js版本: ${nodeVersion}`, COLORS.reset);
    
    // 检查npm
    try {
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        log(`📦 npm版本: ${npmVersion}`, COLORS.reset);
    } catch (error) {
        log(`❌ npm不可用`, COLORS.red);
        throw error;
    }
    
    // 检查关键文件
    const requiredFiles = ['package.json', 'statusline.js', 'bin/cc-statusbar.js'];
    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            log(`❌ 缺少必要文件: ${file}`, COLORS.red);
            throw new Error(`Missing required file: ${file}`);
        }
    }
    
    log('✅ 环境检查通过', COLORS.green);
}

function cleanBuild() {
    log('🧹 清理构建...', COLORS.blue);
    
    // 清理旧的包文件
    const files = fs.readdirSync('.');
    const tgzFiles = files.filter(f => f.endsWith('.tgz'));
    
    for (const file of tgzFiles) {
        fs.unlinkSync(file);
        log(`🗑️  已删除旧包: ${file}`, COLORS.yellow);
    }
    
    log('✅ 清理完成', COLORS.green);
}

function installDependencies() {
    log('📥 安装依赖...', COLORS.blue);
    exec('npm install');
    log('✅ 依赖安装完成', COLORS.green);
}

function runTests() {
    log('🧪 运行测试...', COLORS.blue);
    try {
        exec('npm test');
        log('✅ 测试通过', COLORS.green);
    } catch (error) {
        log('⚠️  测试失败，但继续打包', COLORS.yellow);
    }
}

function validatePackage() {
    log('🔍 验证包配置...', COLORS.blue);
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // 检查必要字段
    const requiredFields = ['name', 'version', 'main', 'bin'];
    for (const field of requiredFields) {
        if (!packageJson[field]) {
            throw new Error(`package.json缺少必要字段: ${field}`);
        }
    }
    
    // 检查bin文件是否存在
    if (packageJson.bin) {
        for (const [cmd, script] of Object.entries(packageJson.bin)) {
            if (!fs.existsSync(script)) {
                throw new Error(`bin脚本不存在: ${script} (命令: ${cmd})`);
            }
        }
    }
    
    log('✅ 包配置验证通过', COLORS.green);
    return packageJson;
}

function createPackage() {
    log('📦 创建安装包...', COLORS.blue);
    
    // 使用npm pack创建.tgz文件
    const output = execSync('npm pack', { encoding: 'utf8' });
    const tgzFile = output.trim();
    
    if (fs.existsSync(tgzFile)) {
        log(`✅ 安装包创建成功: ${tgzFile}`, COLORS.green);
        return tgzFile;
    } else {
        throw new Error('安装包创建失败');
    }
}

function showInstallInstructions(tgzFile, packageJson) {
    const packageName = packageJson.name;
    const version = packageJson.version;
    
    log('', COLORS.reset);
    log(`${COLORS.bold}🎉 ${packageName} v${version} 本地打包完成！${COLORS.reset}`, COLORS.green);
    log('', COLORS.reset);
    log('📋 安装方法:', COLORS.bold);
    log(`  npm install -g ${tgzFile}`, COLORS.green);
    log('', COLORS.reset);
    log('🔧 使用方法:', COLORS.bold);
    log('  cc-statusbar                    # 运行状态栏', COLORS.reset);
    log('  claude-statusbar                # 运行状态栏（别名）', COLORS.reset);
    log('', COLORS.reset);
    log('🚀 Claude Code配置:', COLORS.bold);
    log('  安装后会自动配置全局设置', COLORS.green);
    log('  重启Claude Code即可生效', COLORS.yellow);
    log('', COLORS.reset);
    log('📁 包文件信息:', COLORS.bold);
    log(`  文件名: ${tgzFile}`, COLORS.reset);
    log(`  大小: ${(fs.statSync(tgzFile).size / 1024).toFixed(2)} KB`, COLORS.reset);
    log('', COLORS.reset);
    log('💡 提示: 可以将此.tgz文件分享给他人安装', COLORS.blue);
}

// 主函数
function main() {
    try {
        log(`${COLORS.bold}🔨 开始本地打包 Claude Code StatusBar...${COLORS.reset}`, COLORS.blue);
        log('', COLORS.reset);
        
        checkPrerequisites();
        cleanBuild();
        installDependencies();
        runTests();
        const packageJson = validatePackage();
        const tgzFile = createPackage();
        showInstallInstructions(tgzFile, packageJson);
        
    } catch (error) {
        log('', COLORS.reset);
        log(`❌ 打包失败: ${error.message}`, COLORS.red);
        process.exit(1);
    }
}

// 只在直接运行时执行
if (require.main === module) {
    main();
}

module.exports = { main };