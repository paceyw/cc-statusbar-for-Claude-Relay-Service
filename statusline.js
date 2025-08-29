#!/usr/bin/env node

/**
 * Claude Code状态栏脚本
 * 符合Claude Code状态栏标准，接收JSON输入并输出格式化状态信息
 * 参考: @chongdashu/cc-statusline 设计模式
 */

const fs = require('fs');
const path = require('path');
const ApiService = require('./api-service');
const { parseApiStats, formatStats, getApiStats } = require('./data-parser');
const UIComponents = require('./ui-components');

class ClaudeCodeStatusLine {
    constructor() {
        this.apiService = new ApiService();
        this.parser = { parseApiStats, formatStats, getApiStats };
        this.uiComponents = new UIComponents();
        this.config = this.loadConfig();
        this.cache = new Map();
        this.lastUpdate = 0;
        this.updateInterval = 15000; // 15秒更新间隔，提高响应速度
    }

    /**
     * 加载配置文件
     * @returns {Object} 配置对象
     */
    loadConfig() {
        const os = require('os');
        const defaultConfig = {
            api: {
                url: 'https://your-domain.com/admin-next/api-stats?apiId=your-api-id',
                timeout: 15000,
                retryAttempts: 3,
                retryDelay: 1000,
                cacheTimeout: 30000
            },
            display: {
                showRequests: true,
                showTokens: true,
                showCost: true,
                showPercentage: true,
                showTrends: true,
                showApiStats: false,
                showExpiry: true,
                showLastUpdate: true,
                maxLineLength: 100,
                enableMultiLine: true
            },
            alerts: {
                costWarningThreshold: 60,
                costCriticalThreshold: 80,
                enableNotifications: false
            },
            cache: {
                enablePersistent: true,
                maxHistorySize: 10,
                offlineMode: false
            },
            statusbar: {
                updateInterval: 30,
                position: 'right',
                priority: 100,
                separator: ' | ',
                icons: {
                    normal: '🟢',
                    warning: '🟡',
                    critical: '🔴',
                    error: '❌',
                    trending_up: '📈',
                    trending_down: '📉'
                }
            },
            debug: {
                enableLogging: false,
                logLevel: 'info',
                logFile: '.claude/statusbar.log'
            }
        };

        try {
            // 尝试多个配置文件位置
            const configPaths = [
                path.join(process.cwd(), '.claude', 'cc-statusbar-config.json'),
                path.join(process.cwd(), 'config.json'),
                path.join(os.homedir(), '.claude', 'statusbar-config.json')
            ];

            for (const configPath of configPaths) {
                if (fs.existsSync(configPath)) {
                    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    return this.mergeConfig(defaultConfig, userConfig);
                }
            }
        } catch (error) {
            // 配置文件读取失败，使用默认配置
        }

        return defaultConfig;
    }

    /**
     * 深度合并配置对象
     * @param {Object} defaultConfig - 默认配置
     * @param {Object} userConfig - 用户配置
     * @returns {Object} 合并后的配置
     */
    mergeConfig(defaultConfig, userConfig) {
        const merged = { ...defaultConfig };
        
        for (const key in userConfig) {
            if (userConfig.hasOwnProperty(key)) {
                if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
                    merged[key] = { ...merged[key], ...userConfig[key] };
                } else {
                    merged[key] = userConfig[key];
                }
            }
        }
        
        return merged;
    }

    /**
     * 从stdin读取Claude Code传递的JSON数据
     * @returns {Promise<Object>} Claude Code上下文数据
     */
    async readClaudeCodeInput() {
        return new Promise((resolve) => {
            let input = '';
            
            // 设置超时，如果没有输入则使用默认数据
            const timeout = setTimeout(() => {
                resolve(this.getDefaultClaudeData());
            }, 100);

            process.stdin.on('data', (chunk) => {
                input += chunk.toString();
            });

            process.stdin.on('end', () => {
                clearTimeout(timeout);
                try {
                    const data = JSON.parse(input);
                    resolve(data);
                } catch (error) {
                    resolve(this.getDefaultClaudeData());
                }
            });

            // 如果没有管道输入，立即结束
            if (process.stdin.isTTY) {
                clearTimeout(timeout);
                resolve(this.getDefaultClaudeData());
            }
        });
    }

    /**
     * 获取默认的Claude数据（用于测试和fallback）
     * @returns {Object} 默认数据
     */
    getDefaultClaudeData() {
        return {
            model: 'Claude 3.5 Sonnet',
            version: '1.0.85',
            session: {
                id: 'test-session',
                startTime: new Date().toISOString()
            },
            context: {
                used: 45000,
                total: 200000
            },
            directory: process.cwd()
        };
    }

    /**
     * 获取服务器状态数据（带持久化缓存）
     * @returns {Promise<Object>} 状态数据
     */
    async getServerStatus() {
        const now = Date.now();
        const cacheFile = path.join('.claude', 'statusbar-cache.json');
        
        // 尝试从文件加载缓存
        let cachedData = this.loadCache(cacheFile);
        
        // 检查缓存是否有效（使用Claude Code的调用间隔作为缓存时间）
        const cacheValidTime = 25000; // 25秒，略小于Claude Code的30秒调用间隔
        if (cachedData && cachedData.timestamp && (now - cachedData.timestamp) < cacheValidTime) {
            return cachedData.data;
        }

        try {
            // 确保服务实例配置正确
            if (!this.apiService) {
                this.apiService = new ApiService();
            }
            
            // 应用配置
            this.apiService.setCacheTTL(this.config.api.cacheTimeout);
            this.apiService.setOfflineMode(this.config.cache.offlineMode);
            
            if (!this.parser) {
                this.parser = { parseApiStats, formatStats, getApiStats };
                this.parser.maxHistorySize = this.config.cache.maxHistorySize;
                this.parser.dataHistory = [];
            }
            
            // 获取新数据（关闭调试输出以避免干扰状态栏）
            const { scrapeApiStats } = require('./puppeteer-scraper');
            const rawData = await scrapeApiStats(this.config.api.url, this.config.api.timeout, this.config.debug.enableLogging);
            if (rawData) {
                const parsedData = this.parser.parseApiStats(rawData, this.config.debug.enableLogging);
                // 转换字段名以匹配formatStatusLine的期望
                const formattedData = {
                    requestCount: parsedData.todayRequests,
                    tokenCount: parsedData.todayTokens,
                    todayCost: parsedData.todayCost,
                    costLimit: `$${parsedData.dailyLimit}`,
                    costPercentage: parsedData.usagePercentage,
                    lastUpdate: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
                    updateTimestamp: now, // 添加时间戳用于变化检测
                    expiryDate: parsedData.expiryDate,
                    apiKeyName: parsedData.apiKeyName,
                    apiStats: {
                        successRate: 100 // 默认成功率
                    }
                };
                
                // 保存到文件缓存
                this.saveCache(cacheFile, formattedData, now);
                
                return formattedData;
            }
        } catch (error) {
            // 如果获取失败，返回缓存数据或错误状态
            if (this.config.debug.enableLogging) {
                console.error('获取服务器状态失败:', error);
            }
        }

        // 返回过期的缓存数据（如果存在）
        if (cachedData && cachedData.data) {
            return cachedData.data;
        }

        return {
            requestCount: 'N/A',
            tokenCount: 'N/A',
            todayCost: 'N/A',
            costLimit: '$100.00',
            costPercentage: 0,
            error: '连接失败',
            lastUpdate: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        };
    }

    /**
     * 格式化状态栏输出
     * @param {Object} claudeData - Claude Code数据
     * @param {Object} serverData - 服务器状态数据
     * @returns {string} 格式化的状态栏文本
     */
    formatStatusLine(claudeData, serverData) {
        if (!serverData || serverData.error) {
            return '❌ Claude API Error';
        }

        // 根据费用百分比选择颜色指示器
        let costIndicator = this.config.statusbar.icons.normal;
        if (serverData.costPercentage > this.config.alerts.costCriticalThreshold) {
            costIndicator = this.config.statusbar.icons.critical;
        } else if (serverData.costPercentage > this.config.alerts.costWarningThreshold) {
            costIndicator = this.config.statusbar.icons.warning;
        }

        // 添加趋势指示器
        let trendIndicator = '';
        if (this.config.display.showTrends && this.parser && this.parser.dataHistory && this.parser.dataHistory.length > 1) {
            const costTrend = this.analyzeTrend('todayCost', 3);
            if (costTrend && costTrend.direction === 'increasing' && Math.abs(costTrend.changePercent) > 10) {
                trendIndicator = this.config.statusbar.icons.trending_up;
            } else if (costTrend && costTrend.direction === 'decreasing' && Math.abs(costTrend.changePercent) > 10) {
                trendIndicator = this.config.statusbar.icons.trending_down;
            }
        }

        // 构建主要状态信息（第一行）
        const mainElements = [
            (costIndicator || trendIndicator) ? `${costIndicator}${trendIndicator}` : null,
            this.config.display.showRequests && serverData.requestCount !== 'N/A' ? `${serverData.requestCount} Requests` : null,
            this.config.display.showTokens && serverData.tokenCount !== 'N/A' ? `${this.formatCompactTokens(serverData.tokenCount)} Tokens` : null,
            this.config.display.showCost && serverData.todayCost !== 'N/A' ? 
                `$${serverData.todayCost}${this.config.display.showPercentage ? `(${serverData.costPercentage}%)` : ''}` : null
        ].filter(Boolean);

        let mainLine = mainElements.join(this.config.statusbar.separator);

        // 构建时间信息（可能的第二行）
        const timeElements = [];
        
        if (this.config.display.showExpiry && serverData.expiryDate) {
            timeElements.push(`到期: ${serverData.expiryDate}`);
        }
        
        if (this.config.display.showLastUpdate && serverData.lastUpdate) {
            // 添加秒数指示器，让用户看到实时更新
            const seconds = new Date().getSeconds();
            timeElements.push(`更新: ${serverData.lastUpdate}:${seconds.toString().padStart(2, '0')}`);
        }

        let timeLine = timeElements.length > 0 ? timeElements.join(this.config.statusbar.separator) : '';

        // 决定显示格式（一行或两行）
        if (this.config.display.enableMultiLine) {
            const totalLength = mainLine.length + (timeLine ? timeLine.length : 0);
            
            if (totalLength > this.config.display.maxLineLength && timeLine) {
                // 两行显示
                return mainLine + '\n' + timeLine;
            } else if (timeLine) {
                // 一行显示，添加时间信息
                return mainLine + this.config.statusbar.separator + timeLine;
            } else {
                // 只有主要信息
                return mainLine;
            }
        } else {
            // 强制一行显示，如果太长则截断
            const fullLine = timeLine ? mainLine + this.config.statusbar.separator + timeLine : mainLine;
            if (fullLine.length > this.config.display.maxLineLength) {
                return fullLine.substring(0, this.config.display.maxLineLength - 3) + '...';
            }
            return fullLine;
        }
    }

    /**
     * 格式化紧凑数字显示
     * @param {number|string} value - 数值
     * @returns {string} 格式化后的数字
     */
    formatCompactNumber(value) {
        const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.]/g, '')) : value;
        if (isNaN(num)) return value.toString();
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * 格式化紧凑Token显示
     * @param {number|string} value - Token数值
     * @returns {string} 格式化后的Token
     */
    formatCompactTokens(value) {
        const tokenStr = value.toString();
        if (tokenStr.includes('M') || tokenStr.includes('K')) {
            return tokenStr;
        }
        
        const num = parseFloat(tokenStr.replace(/[^\d.]/g, ''));
        if (isNaN(num)) return tokenStr;
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * 分析数据趋势
     * @param {string} field - 要分析的字段
     * @param {number} periods - 分析周期数
     * @returns {Object} 趋势分析结果
     */
    analyzeTrend(field, periods = 3) {
        if (!this.parser || !this.parser.dataHistory || this.parser.dataHistory.length < 2) {
            return null;
        }

        const history = this.parser.dataHistory.slice(-periods);
        if (history.length < 2) return null;

        const values = history.map(item => {
            const value = item[field];
            return typeof value === 'string' ? parseFloat(value.replace(/[^\d.]/g, '')) : value;
        }).filter(v => !isNaN(v));

        if (values.length < 2) return null;

        const first = values[0];
        const last = values[values.length - 1];
        const changePercent = ((last - first) / first) * 100;

        return {
            direction: changePercent > 0 ? 'increasing' : 'decreasing',
            changePercent: Math.abs(changePercent),
            values: values
        };
    }

    /**
     * 创建进度条
     * @param {number} percentage - 百分比
     * @param {number} width - 进度条宽度
     * @returns {string} 进度条字符串
     */
    createProgressBar(percentage, width = 10) {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return '[' + '='.repeat(filled) + '-'.repeat(empty) + ']';
    }

    /**
     * 应用颜色（如果启用）
     * @param {string} text - 文本
     * @param {string} color - 颜色代码
     * @returns {string} 带颜色的文本
     */
    applyColor(text, color) {
        if (!this.config.colorEnabled || process.env.NO_COLOR) {
            return text;
        }
        
        const colors = {
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            reset: '\x1b[0m'
        };
        
        return colors[color] + text + colors.reset;
    }

    /**
     * 从文件加载缓存数据
     * @param {string} cacheFile - 缓存文件路径
     * @returns {Object|null} 缓存数据
     */
    loadCache(cacheFile) {
        try {
            if (fs.existsSync(cacheFile)) {
                const cacheContent = fs.readFileSync(cacheFile, 'utf8');
                return JSON.parse(cacheContent);
            }
        } catch (error) {
            if (this.config.debug.enableLogging) {
                console.error('加载缓存失败:', error);
            }
        }
        return null;
    }

    /**
     * 保存数据到缓存文件
     * @param {string} cacheFile - 缓存文件路径
     * @param {Object} data - 要缓存的数据
     * @param {number} timestamp - 时间戳
     */
    saveCache(cacheFile, data, timestamp) {
        try {
            const cacheDir = path.dirname(cacheFile);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            
            const cacheData = {
                data: data,
                timestamp: timestamp
            };
            
            fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
        } catch (error) {
            if (this.config.debug.enableLogging) {
                console.error('保存缓存失败:', error);
            }
        }
    }

    /**
     * 主执行函数
     */
    async run() {
        try {
            // 读取Claude Code输入数据
            const claudeData = await this.readClaudeCodeInput();
            
            // 获取服务器状态
            const serverData = await this.getServerStatus();
            
            // 格式化并输出状态栏
            const statusLine = this.formatStatusLine(claudeData, serverData);
            
            // 输出到stdout（Claude Code会读取这个输出）
            console.log(statusLine);
            
        } catch (error) {
            // 错误情况下输出简化状态
            console.log('⚠️ CC状态栏错误');
        } finally {
            // 确保进程退出
            if (require.main === module) {
                process.exit(0);
            }
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const statusLine = new ClaudeCodeStatusLine();
    statusLine.run();
}

module.exports = ClaudeCodeStatusLine;