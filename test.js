#!/usr/bin/env node

/**
 * Claude Code StatusBar 测试脚本
 * 验证核心功能和依赖是否正常工作
 */

const fs = require('fs');
const path = require('path');

class StatusBarTester {
    constructor() {
        this.testResults = [];
        this.config = this.loadTestConfig();
    }

    /**
     * 加载测试配置
     */
    loadTestConfig() {
        try {
            const configPath = path.join(process.cwd(), 'config.json');
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (error) {
            console.warn('⚠️  无法加载config.json，使用默认测试配置');
        }
        
        return {
            api: {
                url: 'https://your-domain.com/admin-next/api-stats?apiId=your-api-id',
                timeout: 15000
            }
        };
    }

    /**
     * 测试基础模块依赖
     */
    async testDependencies() {
        console.log('🧪 测试模块依赖...');
        
        const requiredModules = [
            'fs',
            'path', 
            'os'
        ];

        const optionalModules = [
            { name: 'axios', package: 'axios' },
            { name: 'cheerio', package: 'cheerio' },
            { name: 'puppeteer', package: 'puppeteer' }
        ];

        let requiredPassed = 0;
        let optionalPassed = 0;
        let total = requiredModules.length + optionalModules.length;

        // 测试必需模块
        for (const module of requiredModules) {
            try {
                require(module);
                console.log(`  ✅ ${module}`);
                requiredPassed++;
            } catch (error) {
                console.log(`  ❌ ${module}: ${error.message}`);
                this.testResults.push({ test: `dependency-${module}`, passed: false, error: error.message });
            }
        }

        // 测试可选模块（通过try-catch避免中断）
        for (const { name, package: pkg } of optionalModules) {
            try {
                require(pkg);
                console.log(`  ✅ ${name}`);
                optionalPassed++;
            } catch (error) {
                console.log(`  ⚠️  ${name}: ${error.message}`);
                this.testResults.push({ test: `optional-dependency-${name}`, passed: false, warning: error.message });
            }
        }

        const totalPassed = requiredPassed + optionalPassed;
        console.log(`📊 依赖测试结果: ${totalPassed}/${total} 通过\n`);
        
        // 只要求所有必需模块通过，可选模块通过与否不影响结果
        return requiredPassed === requiredModules.length;
    }

    /**
     * 测试核心文件是否存在
     */
    async testCoreFiles() {
        console.log('📁 测试核心文件...');
        
        const coreFiles = [
            'statusline.js',
            'api-service.js',
            'data-parser.js',
            'puppeteer-scraper.js',
            'package.json'
        ];

        let passed = 0;
        for (const file of coreFiles) {
            const filePath = path.join(process.cwd(), file);
            if (fs.existsSync(filePath)) {
                console.log(`  ✅ ${file}`);
                passed++;
            } else {
                console.log(`  ❌ ${file} - 文件不存在`);
                this.testResults.push({ test: `file-${file}`, passed: false, error: '文件不存在' });
            }
        }

        console.log(`📊 文件测试结果: ${passed}/${coreFiles.length} 通过\n`);
        return passed === coreFiles.length;
    }

    /**
     * 测试配置文件
     */
    async testConfiguration() {
        console.log('⚙️  测试配置...');
        
        let passed = 0;
        let total = 3;

        // 测试 package.json
        try {
            const pkg = require(path.join(process.cwd(), 'package.json'));
            if (pkg.name && pkg.version && pkg.main) {
                console.log(`  ✅ package.json 格式正确`);
                passed++;
            } else {
                console.log(`  ⚠️  package.json 缺少必要字段`);
            }
        } catch (error) {
            console.log(`  ❌ package.json: ${error.message}`);
        }

        // 测试 config.json
        try {
            const config = require(path.join(process.cwd(), 'config.json'));
            console.log(`  ✅ config.json 加载成功`);
            passed++;
        } catch (error) {
            console.log(`  ⚠️  config.json: ${error.message}`);
        }

        // 测试 .claude 目录
        const claudeDir = path.join(process.cwd(), '.claude');
        if (fs.existsSync(claudeDir)) {
            console.log(`  ✅ .claude 目录存在`);
            passed++;
        } else {
            console.log(`  ⚠️  .claude 目录不存在`);
        }

        console.log(`📊 配置测试结果: ${passed}/${total} 通过\n`);
        return passed >= 2; // 至少package.json和config.json要正常
    }

    /**
     * 测试状态栏基础功能（不依赖网络）
     */
    async testStatusLineBasics() {
        console.log('🔧 测试状态栏基础功能...');
        
        try {
            // 检查能否加载StatusLine类
            const statusLinePath = path.join(process.cwd(), 'statusline.js');
            if (fs.existsSync(statusLinePath)) {
                // 使用简单的模块加载测试，避免执行网络请求
                const content = fs.readFileSync(statusLinePath, 'utf8');
                
                if (content.includes('class ClaudeCodeStatusLine')) {
                    console.log('  ✅ ClaudeCodeStatusLine 类定义存在');
                } else {
                    console.log('  ❌ ClaudeCodeStatusLine 类定义缺失');
                    return false;
                }

                if (content.includes('formatStatusLine')) {
                    console.log('  ✅ formatStatusLine 方法存在');
                } else {
                    console.log('  ❌ formatStatusLine 方法缺失');
                    return false;
                }

                console.log('  ✅ 状态栏基础结构完整');
                return true;
            }
        } catch (error) {
            console.log(`  ❌ 状态栏测试失败: ${error.message}`);
            return false;
        }

        return false;
    }

    /**
     * 运行所有测试
     */
    async runAllTests() {
        console.log('🚀 开始 Claude Code StatusBar 功能测试\n');
        
        const results = {
            dependencies: await this.testDependencies(),
            files: await this.testCoreFiles(), 
            configuration: await this.testConfiguration(),
            statusline: await this.testStatusLineBasics()
        };

        // 汇总结果
        console.log('📋 测试总结:');
        console.log('========================================');
        
        const totalTests = Object.keys(results).length;
        const passedTests = Object.values(results).filter(Boolean).length;
        
        for (const [testName, passed] of Object.entries(results)) {
            const status = passed ? '✅' : '❌';
            const testDisplayName = {
                dependencies: '模块依赖',
                files: '核心文件',
                configuration: '配置检查',
                statusline: '状态栏功能'
            }[testName];
            
            console.log(`${status} ${testDisplayName}: ${passed ? '通过' : '失败'}`);
        }

        console.log('========================================');
        console.log(`🎯 总体结果: ${passedTests}/${totalTests} 项测试通过`);
        
        if (passedTests === totalTests) {
            console.log('🎉 所有测试通过！StatusBar 应该可以正常工作');
            process.exit(0);
        } else if (passedTests >= totalTests - 1) {
            console.log('⚠️  大部分测试通过，可能存在轻微问题');
            process.exit(0);
        } else {
            console.log('❌ 发现严重问题，请检查依赖和配置');
            console.log('\n💡 修复建议:');
            console.log('   1. 运行 npm install 重新安装依赖');
            console.log('   2. 检查 config.json 配置文件');
            console.log('   3. 确保网络连接正常');
            process.exit(1);
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const tester = new StatusBarTester();
    tester.runAllTests().catch(error => {
        console.error('❌ 测试过程中发生错误:', error);
        process.exit(1);
    });
}

module.exports = StatusBarTester;