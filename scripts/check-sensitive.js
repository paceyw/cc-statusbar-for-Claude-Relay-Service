#!/usr/bin/env node

/**
 * 发布前敏感信息扫描脚本
 * 作为 prepublishOnly 钩子，确保源码无泄露风险
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
}

// 敏感模式列表
const SENSITIVE_PATTERNS = [
    // 具体的 URL
    /https?:\/\/(?!localhost|127\.0\.0\.1|example\.com|your-domain\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[/\w.-]*(?:\?[&=\w.-]*)?/g,
    // API Key 模式
    /sk-[a-zA-Z0-9]{20,}/g,
    /Bearer\s+[a-zA-Z0-9+/]{20,}/g,
    // 具体的敏感环境变量值（非变量名本身）
    /CC_SCRAPE_URL\s*=\s*["']https?:\/\/[^"']+["']/g,
    // IP 地址（排除保留地址）
    /(?!127\.0\.0\.1|192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    // 具体域名在代码中的引用
    /[a-zA-Z0-9.-]+\.(?:com|net|org|cn|io)(?!\.(example|test|localhost))/g
];

// 排除文件模式
const EXCLUDE_PATTERNS = [
    /README\.md$/i,
    /CHANGELOG\.md$/i,
    /DEPLOYMENT-GUIDE\.md$/i,
    /CONFIG-GUIDE\.md$/i,
    /\.git/,
    /node_modules/,
    /test\.js$/i,
    /check-sensitive\.js$/i
];

/**
 * 递归扫描目录
 */
function scanDirectory(dir, results = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // 跳过特定目录
            if (item === 'node_modules' || item === '.git' || item === '.claude-backup') {
                continue;
            }
            scanDirectory(fullPath, results);
        } else if (stat.isFile()) {
            // 检查是否为需要扫描的文件
            const relativePath = path.relative(process.cwd(), fullPath);
            const shouldExclude = EXCLUDE_PATTERNS.some(pattern => pattern.test(relativePath));
            
            if (!shouldExclude && (item.endsWith('.js') || item.endsWith('.json'))) {
                results.push(fullPath);
            }
        }
    }
    
    return results;
}

/**
 * 扫描单个文件
 */
function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);
    const findings = [];
    
    for (const pattern of SENSITIVE_PATTERNS) {
        let match;
        const globalPattern = new RegExp(pattern.source, pattern.flags);
        
        while ((match = globalPattern.exec(content)) !== null) {
            // 排除一些已知的安全占位符
            const matchText = match[0];
            if (matchText.includes('your-domain.com') || 
                matchText.includes('your-api-id') || 
                matchText.includes('example.com')) {
                continue;
            }
            
            findings.push({
                file: relativePath,
                line: content.substring(0, match.index).split('\n').length,
                match: matchText,
                context: getContext(content, match.index)
            });
        }
    }
    
    return findings;
}

/**
 * 获取匹配内容的上下文
 */
function getContext(content, index, contextSize = 50) {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(content.length, index + contextSize);
    return content.substring(start, end).replace(/\n/g, '\\n');
}

/**
 * 主扫描函数
 */
function main() {
    log(`${COLORS.bold}🔍 开始扫描敏感信息...${COLORS.reset}`, COLORS.yellow);
    
    const projectRoot = process.cwd();
    const filesToScan = scanDirectory(projectRoot);
    
    log(`📂 扫描 ${filesToScan.length} 个文件...`, COLORS.reset);
    
    let totalFindings = 0;
    const allFindings = [];
    
    for (const filePath of filesToScan) {
        const findings = scanFile(filePath);
        if (findings.length > 0) {
            allFindings.push(...findings);
            totalFindings += findings.length;
        }
    }
    
    if (totalFindings > 0) {
        log(`\n${COLORS.bold}❌ 发现 ${totalFindings} 个潜在的敏感信息:${COLORS.reset}`, COLORS.red);
        log('========================================', COLORS.red);
        
        for (const finding of allFindings) {
            log(`📁 文件: ${finding.file}`, COLORS.yellow);
            log(`📍 第 ${finding.line} 行`, COLORS.yellow);
            log(`🔍 内容: ${finding.match}`, COLORS.red);
            log(`📄 上下文: ${finding.context}`, COLORS.reset);
            log('----------------------------------------', COLORS.reset);
        }
        
        log(`\n💡 修复建议:`, COLORS.bold);
        log(`  1. 将具体的 URL 改为环境变量引用`, COLORS.reset);
        log(`  2. 移除任何硬编码的 API Key 或凭据`, COLORS.reset);
        log(`  3. 使用占位符（如 'your-domain.com'）替代真实域名`, COLORS.reset);
        log(`  4. 确保敏感配置通过环境变量传入\n`, COLORS.reset);
        
        process.exit(1);
    } else {
        log(`\n${COLORS.bold}✅ 扫描完成，未发现敏感信息${COLORS.reset}`, COLORS.green);
        log(`📊 已扫描 ${filesToScan.length} 个文件`, COLORS.reset);
        log(`🛡️  代码可以安全发布\n`, COLORS.green);
        process.exit(0);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = { main, scanFile, scanDirectory };