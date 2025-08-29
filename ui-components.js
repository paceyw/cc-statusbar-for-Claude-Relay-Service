// 在测试环境中模拟vscode模块
let vscode;
try {
    vscode = require('vscode');
} catch (error) {
    // 测试环境模拟
    vscode = {
        StatusBarAlignment: { Left: 1, Right: 2 },
        window: {
            createStatusBarItem: () => ({
                text: '',
                tooltip: '',
                command: '',
                show: () => {},
                hide: () => {},
                dispose: () => {}
            }),
            createOutputChannel: () => ({
                appendLine: () => {},
                show: () => {},
                dispose: () => {}
            })
        },
        ThemeColor: function(color) { this.color = color; }
    };
}

/**
 * UI组件管理器
 * 负责创建和管理状态栏显示组件
 */
class UIComponents {
    constructor() {
        this.statusBarItem = null;
        this.webviewPanel = null;
        this.outputChannel = null;
        this.isVisible = true;
        
        // UI配置
        this.config = {
            statusBarAlignment: vscode.StatusBarAlignment.Left,
            statusBarPriority: 100,
            showDetailedTooltip: true,
            showNotifications: true,
            theme: 'auto' // auto, light, dark
        };
        
        // 状态图标映射
        this.statusIcons = {
            loading: '$(sync~spin)',
            success: '$(check)',
            warning: '$(warning)',
            error: '$(error)',
            offline: '$(circle-slash)'
        };
        
        // 颜色主题
        this.colors = {
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            info: '#17a2b8',
            muted: '#6c757d'
        };
    }

    /**
     * 初始化UI组件
     */
    initialize() {
        this.createStatusBarItem();
        this.createOutputChannel();
        console.log('UI组件初始化完成');
    }

    /**
     * 创建状态栏项目
     */
    createStatusBarItem() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            this.config.statusBarAlignment,
            this.config.statusBarPriority
        );
        
        this.statusBarItem.command = 'claude-statusbar.showDetails';
        this.updateStatusBar({ status: 'loading', message: '正在加载...' });
        this.statusBarItem.show();
    }

    /**
     * 创建输出通道
     */
    createOutputChannel() {
        this.outputChannel = vscode.window.createOutputChannel('Claude Status Monitor');
    }

    /**
     * 更新状态栏显示
     * @param {Object} data - 状态数据
     */
    updateStatusBar(data) {
        if (!this.statusBarItem) return;
        
        const { status = 'success', message, statusData } = data;
        
        // 设置图标和文本
        const icon = this.statusIcons[status] || this.statusIcons.success;
        
        if (statusData) {
            // 显示详细状态信息
            const text = this.formatStatusText(statusData);
            this.statusBarItem.text = `${icon} ${text}`;
            this.statusBarItem.tooltip = this.generateTooltip(statusData);
        } else {
            // 显示简单消息
            this.statusBarItem.text = `${icon} ${message || '状态未知'}`;
            this.statusBarItem.tooltip = message || '点击查看详情';
        }
        
        // 设置颜色（如果支持）
        this.setStatusBarColor(status);
    }

    /**
     * 格式化状态栏文本
     * @param {Object} statusData - 状态数据
     * @returns {string} 格式化后的文本
     */
    formatStatusText(statusData) {
        const { requestCount, tokenCount, todayCost, costPercentage } = statusData;
        
        // 现代化简洁显示：使用图标和紧凑格式
        const parts = [];
        
        // 添加Claude标识
        parts.push('Claude');
        
        // 请求数（使用简洁格式）
        if (requestCount && requestCount !== 'N/A') {
            const compactCount = this.formatCompactNumber(requestCount);
            parts.push(`${compactCount}R`);
        }
        
        // Token数（保持原格式或转换为紧凑格式）
        if (tokenCount && tokenCount !== 'N/A') {
            const compactTokens = tokenCount.includes('M') || tokenCount.includes('K') ? 
                tokenCount : this.formatCompactNumber(tokenCount) + 'T';
            parts.push(compactTokens);
        }
        
        // 费用显示（移除$符号，更紧凑）
        if (todayCost && todayCost !== 'N/A') {
            const cost = todayCost.replace('$', '');
            const costDisplay = costPercentage && costPercentage > 0 ? 
                `$${cost}(${costPercentage}%)` : `$${cost}`;
            parts.push(costDisplay);
        }
        
        return parts.length > 1 ? parts.join('|') : '无数据';
    }

    /**
     * 生成详细提示信息
     * @param {Object} statusData - 状态数据
     * @returns {string} 提示信息
     */
    generateTooltip(statusData) {
        const {
            requestCount,
            tokenCount,
            todayCost,
            costLimit,
            costPercentage,
            inputTokens,
            outputTokens,
            lastUpdate,
            error
        } = statusData;
        
        if (error) {
            return `❌ 连接失败\n错误: ${error}\n\n点击重试连接`;
        }
        
        const updateTime = lastUpdate ? 
            new Date(lastUpdate).toLocaleString('zh-CN') : 
            '未知';
        
        let tooltip = `📊 Claude服务器状态监控\n\n`;
        tooltip += `✅ 今日请求数: ${requestCount}/2000\n`;
        tooltip += `🔢 今日Token数: ${tokenCount}/160M\n`;
        tooltip += `💰 今日费用: ${todayCost}/${costLimit || '$100.00'}`;
        
        if (costPercentage !== undefined) {
            tooltip += ` (${costPercentage}%)`;
        }
        
        if (inputTokens || outputTokens) {
            tooltip += `\n\n📈 Token详情:`;
            if (inputTokens) tooltip += `\n  输入: ${inputTokens}`;
            if (outputTokens) tooltip += `\n  输出: ${outputTokens}`;
        }
        
        tooltip += `\n\n🕒 最后更新: ${updateTime}`;
        tooltip += `\n\n💡 点击查看详细信息`;
        
        return tooltip;
    }

    /**
     * 设置状态栏颜色
     * @param {string} status - 状态类型
     */
    setStatusBarColor(status) {
        // VSCode状态栏颜色设置（如果API支持）
        const colorMap = {
            success: undefined, // 默认颜色
            warning: 'statusBarItem.warningBackground',
            error: 'statusBarItem.errorBackground',
            loading: 'statusBarItem.prominentBackground'
        };
        
        const color = colorMap[status];
        if (color && this.statusBarItem.backgroundColor !== undefined) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor(color);
        }
    }

    /**
     * 显示详细信息面板
     * @param {Object} statusData - 状态数据
     */
    showDetailsPanel(statusData) {
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
        
        this.webviewPanel = vscode.window.createWebviewPanel(
            'claudeStatusDetails',
            'Claude服务器状态详情',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        this.webviewPanel.webview.html = this.generateDetailsHTML(statusData);
        
        // 处理webview消息
        this.webviewPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        vscode.commands.executeCommand('claude-statusbar.refresh');
                        break;
                    case 'openSettings':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'claude-statusbar');
                        break;
                }
            },
            undefined
        );
    }

    /**
     * 生成详细信息HTML
     * @param {Object} statusData - 状态数据
     * @returns {string} HTML内容
     */
    generateDetailsHTML(statusData) {
        const {
            requestCount,
            tokenCount,
            todayCost,
            costLimit,
            costPercentage,
            inputTokens,
            outputTokens,
            cacheTokens,
            lastUpdate,
            error
        } = statusData;
        
        const updateTime = lastUpdate ? 
            new Date(lastUpdate).toLocaleString('zh-CN') : 
            '未知';
        
        return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Claude服务器状态</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .status-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .status-card {
                    background: var(--vscode-editor-widget-background);
                    border: 1px solid var(--vscode-editor-widget-border);
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                }
                .status-value {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .status-label {
                    font-size: 14px;
                    opacity: 0.8;
                }
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: var(--vscode-progressBar-background);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 10px 0;
                }
                .progress-fill {
                    height: 100%;
                    background: var(--vscode-progressBar-foreground);
                    transition: width 0.3s ease;
                }
                .actions {
                    text-align: center;
                    margin-top: 30px;
                }
                .btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 0 10px;
                }
                .btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .error {
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    color: var(--vscode-inputValidation-errorForeground);
                    padding: 15px;
                    border-radius: 4px;
                    margin: 20px 0;
                }
                .success { color: #28a745; }
                .warning { color: #ffc107; }
                .danger { color: #dc3545; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 Claude服务器状态监控</h1>
                    <p>实时监控中转服务器状态和使用情况</p>
                </div>
                
                ${error ? `
                <div class="error">
                    <h3>❌ 连接错误</h3>
                    <p>${error}</p>
                </div>
                ` : `
                <div class="status-grid">
                    <div class="status-card">
                        <div class="status-value success">${requestCount}</div>
                        <div class="status-label">今日请求数</div>
                        <div class="status-label">限制: 2000</div>
                    </div>
                    
                    <div class="status-card">
                        <div class="status-value success">${tokenCount}</div>
                        <div class="status-label">今日Token数</div>
                        <div class="status-label">限制: 160M</div>
                    </div>
                    
                    <div class="status-card">
                        <div class="status-value ${costPercentage > 80 ? 'danger' : costPercentage > 60 ? 'warning' : 'success'}">${todayCost}</div>
                        <div class="status-label">今日费用</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${costPercentage || 0}%"></div>
                        </div>
                        <div class="status-label">${costPercentage || 0}% / ${costLimit || '$100.00'}</div>
                    </div>
                </div>
                
                ${(inputTokens || outputTokens) ? `
                <div class="status-grid">
                    <div class="status-card">
                        <div class="status-value">${inputTokens || '0'}</div>
                        <div class="status-label">输入Token</div>
                    </div>
                    
                    <div class="status-card">
                        <div class="status-value">${outputTokens || '0'}</div>
                        <div class="status-label">输出Token</div>
                    </div>
                    
                    ${cacheTokens ? `
                    <div class="status-card">
                        <div class="status-value">${cacheTokens}</div>
                        <div class="status-label">缓存Token</div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
                `}
                
                <div class="actions">
                    <button class="btn" onclick="refresh()">🔄 刷新数据</button>
                    <button class="btn" onclick="openSettings()">⚙️ 设置</button>
                </div>
                
                <div style="text-align: center; margin-top: 30px; opacity: 0.6;">
                    <small>最后更新: ${updateTime}</small>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }
                
                function openSettings() {
                    vscode.postMessage({ command: 'openSettings' });
                }
            </script>
        </body>
        </html>
        `;
    }

    /**
     * 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (info, warning, error)
     */
    showNotification(message, type = 'info') {
        if (!this.config.showNotifications) return;
        
        switch (type) {
            case 'error':
                vscode.window.showErrorMessage(message);
                break;
            case 'warning':
                vscode.window.showWarningMessage(message);
                break;
            default:
                vscode.window.showInformationMessage(message);
        }
    }

    /**
     * 输出日志到输出通道
     * @param {string} message - 日志消息
     * @param {string} level - 日志级别
     */
    log(message, level = 'info') {
        if (!this.outputChannel) return;
        
        const timestamp = new Date().toLocaleString('zh-CN');
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        
        if (level === 'error') {
            this.outputChannel.show(true);
        }
    }

    /**
     * 格式化紧凑数字显示
     * @param {string} value - 数字值
     * @returns {string} 紧凑格式
     */
    formatCompactNumber(value) {
        const num = parseInt(value.replace(/[^\d]/g, ''));
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return value;
    }

    /**
     * 切换显示状态
     */
    toggle() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            this.statusBarItem?.show();
        } else {
            this.statusBarItem?.hide();
        }
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * 销毁UI组件
     */
    dispose() {
        this.statusBarItem?.dispose();
        this.webviewPanel?.dispose();
        this.outputChannel?.dispose();
        
        this.statusBarItem = null;
        this.webviewPanel = null;
        this.outputChannel = null;
    }
}

module.exports = UIComponents;