#!/usr/bin/env node

/**
 * Claude Code增强状态栏脚本
 * 结合 shell PS1 风格信息和 Claude API 监控数据
 * 符合Claude Code状态栏标准，接收JSON输入并输出格式化状态信息
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const AdminHtmlProvider = require('./admin-html-provider');

class EnhancedStatusLine {
  constructor(config = {}) {
    // 调试信息：显示运行环境
    if (process.env.CC_DEBUG) {
      console.error(`[DEBUG] ==> Claude StatusBar 初始化 <==`);
      console.error(`[DEBUG] 包路径: ${__dirname}`);
      console.error(`[DEBUG] 工作目录: ${process.cwd()}`);
      console.error(`[DEBUG] Node版本: ${process.version}`);
      console.error(`[DEBUG] 平台: ${process.platform}`);
      console.error(`[DEBUG] 环境变量:`);
      console.error(`[DEBUG] - CC_SCRAPE_URL: ${process.env.CC_SCRAPE_URL ? '已设置' : '未设置'}`);
      console.error(`[DEBUG] - CC_STATUS_MAXLEN: ${process.env.CC_STATUS_MAXLEN || '未设置'}`);
      console.error(`[DEBUG] - CC_PROJECT_LABEL: ${process.env.CC_PROJECT_LABEL || '未设置'}`);
      console.error(`[DEBUG] - CC_DEBUG: ${process.env.CC_DEBUG || '未设置'}`);
      console.error(`[DEBUG] - CC_CACHE_DIR: ${process.env.CC_CACHE_DIR || '未设置'}`);
    }
    
    // 加载配置文件
    const loadedConfig = this.loadConfig();
    
    // 调试信息：显示最终配置
    if (process.env.CC_DEBUG) {
      console.error(`[DEBUG] 加载的配置文件内容:`, JSON.stringify(loadedConfig, null, 2));
    }
    
    this.config = Object.assign({
      fetchUrl: process.env.CC_SCRAPE_URL || 'https://your-api-domain.com:6443/admin-next/api-stats?apiId=your-api-id',
      maxLength: 120, // 增加默认长度以容纳更多信息
      display: {
        // Shell PS1 风格显示选项 - 全部关闭以匹配用户期望格式
        showUser: false,
        showHost: false,
        showWorkspace: false,
        showGitBranch: false,
        showTime: false,
        // API 监控显示选项
        showRequests: true,
        showTokens: true,
        showCost: true,
        showPercentage: true, // 启用百分比显示
        showProgressBar: false,
        showLastUpdate: true, // 启用更新时间显示
        showExpiry: true,
      },
      alerts: {
        costWarningThreshold: 60,
        costCriticalThreshold: 85,
      }
    }, loadedConfig, config);

    // 调试信息：显示合并后的最终配置
    if (process.env.CC_DEBUG) {
      console.error(`[DEBUG] 最终合并配置:`, JSON.stringify(this.config, null, 2));
      console.error(`[DEBUG] 抓取URL: ${this.config.fetchUrl}`);
    }

    this.provider = new AdminHtmlProvider();
    this.history = [];
    this.lastUpdate = 0;
    this.contextInput = null;
    
    if (process.env.CC_DEBUG) {
      console.error(`[DEBUG] StatusBar初始化完成`);
    }
  }

  // 加载配置文件
  loadConfig() {
    // 增强的配置查找策略，支持全局安装场景
    const configPaths = [
      // 1. 当前工作目录（Claude Code运行目录）- 最高优先级
      path.join(process.cwd(), '.claude', 'statusbar-config.json'),
      path.join(process.cwd(), '.claude', 'config.json'),
      path.join(process.cwd(), 'statusbar-config.json'),
      
      // 2. 全局用户配置目录
      path.join(os.homedir(), '.claude', 'statusbar-config.json'),
      path.join(os.homedir(), '.claude', 'config.json'),
      
      // 3. 包自身目录（开发环境或作为fallback）
      path.join(__dirname, '.claude', 'statusbar-config.json'),
      path.join(__dirname, 'statusbar-config.json'),
      path.join(__dirname, 'config.json'),
    ];

    let config = {};

    // 逐个尝试配置文件路径
    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf8');
          const parsedConfig = JSON.parse(configData);
          
          // 合并配置，支持部分配置覆盖
          if (parsedConfig.statusbar) {
            // 如果是Claude配置文件格式，提取statusbar部分
            config = { ...config, ...parsedConfig.statusbar };
          } else {
            // 直接的statusbar配置文件
            config = { ...config, ...parsedConfig };
          }
          
          // 记录成功加载的配置文件（用于调试）
          if (process.env.CC_DEBUG) {
            console.error(`[DEBUG] 已加载配置: ${configPath}`);
          }
        }
      } catch (e) {
        // 忽略配置文件读取错误，继续尝试下一个路径
        if (process.env.CC_DEBUG) {
          console.error(`[DEBUG] 配置文件读取失败 ${configPath}: ${e.message}`);
        }
      }
    }
    
    // 环境变量覆盖（最高优先级）
    const envOverrides = {};
    
    if (process.env.CC_SCRAPE_URL) {
      envOverrides.fetchUrl = process.env.CC_SCRAPE_URL;
    }
    
    if (process.env.CC_STATUS_MAXLEN) {
      const maxLen = parseInt(process.env.CC_STATUS_MAXLEN, 10);
      if (maxLen > 0) {
        envOverrides.maxLength = maxLen;
      }
    }
    
    if (process.env.CC_PROJECT_LABEL) {
      envOverrides.projectLabel = process.env.CC_PROJECT_LABEL;
    }

    // 应用环境变量覆盖
    config = { ...config, ...envOverrides };
    
    if (process.env.CC_DEBUG) {
      console.error(`[DEBUG] 最终配置:`, JSON.stringify(config, null, 2));
    }
    
    return config;
  }

  // 从 Claude Code 输入中解析上下文信息
  parseContext(input) {
    try {
      this.contextInput = JSON.parse(input);
    } catch (e) {
      this.contextInput = null;
    }
  }

  // 获取用户名
  getUsername() {
    try {
      return os.userInfo().username || 'user';
    } catch {
      return 'user';
    }
  }

  // 获取主机名
  getHostname() {
    try {
      return os.hostname().split('.')[0] || 'localhost';
    } catch {
      return 'localhost';
    }
  }

  // 获取当前工作目录的简写形式
  getCurrentDirectory() {
    if (this.contextInput && this.contextInput.workspace) {
      const currentDir = this.contextInput.workspace.current_dir || this.contextInput.cwd;
      if (currentDir) {
        return path.basename(currentDir);
      }
    }
    try {
      return path.basename(process.cwd());
    } catch {
      return '~';
    }
  }

  // 获取工作区显示标签（优先环境变量覆盖）
  getWorkspaceLabel() {
    if (process.env.CC_PROJECT_LABEL && String(process.env.CC_PROJECT_LABEL).trim()) {
      return String(process.env.CC_PROJECT_LABEL).trim();
    }
    // 若 Claude 上下文含有名称则优先
    if (this.contextInput && this.contextInput.workspace && this.contextInput.workspace.name) {
      return String(this.contextInput.workspace.name);
    }
    return this.getCurrentDirectory();
  }

  // 获取 Git 分支信息
  getGitBranch() {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 1000
      }).trim();
      
      // 获取 Git 状态
      try {
        const status = execSync('git status --porcelain', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
          timeout: 1000
        }).trim();
        
        if (status) {
          return `${branch}*`; // 有未提交的更改
        }
        return branch;
      } catch {
        return branch;
      }
    } catch {
      return null;
    }
  }

  // 获取当前时间 (HH:MM:SS)
  getCurrentTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  // 构建 shell 风格的提示符部分
  buildShellPrompt() {
    const parts = [];

    if (this.config.display.showTime) {
      parts.push(`${this.getCurrentTime()}`);
    }

    if (this.config.display.showUser) {
      parts.push(`${this.getUsername()}`);
    }

    if (this.config.display.showHost) {
      parts.push(`@${this.getHostname()}`);
    }

    if (this.config.display.showWorkspace) {
      // 使用工作区标签（支持 CC_PROJECT_LABEL 覆盖）
      parts.push(`${this.getWorkspaceLabel()}`);
    }

    if (this.config.display.showGitBranch) {
      const branch = this.getGitBranch();
      if (branch) {
        parts.push(`(${branch})`);
      }
    }

    return parts.length > 0 ? parts.join(' ') : '';
  }

  // 计算实际最大长度：优先使用终端宽度
  effectiveMaxLength() {
    const termCols = process.stdout && process.stdout.columns ? Math.max(20, process.stdout.columns - 2) : null;
    const envLen = process.env.CC_STATUS_MAXLEN ? parseInt(process.env.CC_STATUS_MAXLEN, 10) : null;
    const base = this.config.maxLength || 80;
    // env > term > base
    return (envLen && envLen > 0) ? envLen : (termCols || base);
  }

  // 简单的千分位与K/M缩写
  formatTokens(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '0';
    // 智能格式化 - 去掉不必要的小数位
    const formatNumber = (num) => {
      const rounded = Number(num.toFixed(1));
      return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(1);
    };
    
    if (n >= 1_000_000) return `${formatNumber(n / 1_000_000)}M`;
    if (n >= 1_000) return `${formatNumber(n / 1_000)}K`;
    return `${Math.trunc(n)}`;
  }

  // 将 provider DTO 归一化为显示数据
  normalizeDto(dto) {
    if (!dto || typeof dto !== 'object') {
      return {
        requestCount: 0,
        tokenCount: 0,
        todayCost: '0.00',
        costLimit: '∞',
        costPercentage: null,
        todayCostNumeric: 0,
        costLimitNumeric: 0,
        expiryDate: '',
        lastUpdate: new Date().toISOString(),
      };
    }

    const todayCostNum = Number(dto.todayCost) || 0;
    const costLimitNum = Number(dto.costLimit) || 0; // 0 代表无限制

    // 计算百分比（只在有限额时）保留 1 位小数
    let pct = null;
    if (costLimitNum > 0) {
      const raw = (todayCostNum / costLimitNum) * 100;
      pct = isFinite(raw) ? parseFloat(raw.toFixed(1)) : 0;
    }

    // 金额智能格式化（整数去掉 .00）
    const fmtMoney = (n) => {
      if (!isFinite(n)) return '0';
      const rounded = Number(n.toFixed(2));
      return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(2);
    };

    return {
      requestCount: Number(dto.requestCount) || 0,
      tokenCount: Number(dto.tokenCount) || 0,
      todayCost: fmtMoney(todayCostNum),
      costLimit: costLimitNum > 0 ? `$${fmtMoney(costLimitNum)}` : '∞',
      costPercentage: pct,
      todayCostNumeric: todayCostNum,
      costLimitNumeric: costLimitNum,
      expiryDate: dto.expiryDate || '',
      lastUpdate: dto.lastUpdate || new Date().toISOString(),
    };
  }

  // 本地时区：YYYY/MM/DD HH:MM 格式
  formatLocalDateTime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return '';
    const y = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${mm}/${dd} ${hh}:${mi}`;
  }

  // 2) 自适应：逐步压缩内容以适配宽度
  compactToFit(parts, times, maxLen) {
    let p = [...parts];
    let t = [...times];
    let line = this.buildLine(p, t).replace(/\|/g, ' | ');
    if (line.length <= maxLen) return line;

    // 先移除 tokens 段（索引2）
    if (p.length > 2) p.splice(2, 1);
    line = this.buildLine(p, t).replace(/\|/g, ' | ');
    if (line.length <= maxLen) return line;

    // 再移除 requests 段（索引1）
    if (p.length > 1) p.splice(1, 1);
    line = this.buildLine(p, t).replace(/\|/g, ' | ');
    if (line.length <= maxLen) return line;

    // 再移除时间：先“到期：”，后“更新：”
    const removeTime = (prefix) => {
      const idx = t.findIndex(x => x.startsWith(prefix));
      if (idx !== -1) t.splice(idx, 1);
    };

    removeTime('到期：');
    line = this.buildLine(p, t).replace(/\|/g, ' | ');
    if (line.length <= maxLen) return line;

    removeTime('更新：');
    line = this.buildLine(p, t).replace(/\|/g, ' | ');
    if (line.length <= maxLen) return line;

    return line.slice(0, Math.max(0, maxLen - 1)) + '…';
  }

  // 格式化状态栏输出
  formatStatus(serverData) {
    // 指示灯
    let statusIcon = '🟢';
    if (serverData.costLimitNumeric > 0 && typeof serverData.costPercentage === 'number') {
      const p = serverData.costPercentage;
      if (p >= 90) statusIcon = '🔴';
      else if (p >= 70) statusIcon = '🟡';
      else statusIcon = '🟢';
    }

    // 构建状态栏组件 - 使用 | 分隔符，格式：🟢|1840 Requests|48.2M Tokens|$29.22(29%)|到期：2025/09/21 01:08|更新：23:23:54
    const components = [];
    
    // 状态图标
    components.push(statusIcon);
    
    // 请求数
    if (this.config.display.showRequests) {
      components.push(`${serverData.requestCount} Requests`);
    }
    
    // Token数
    if (this.config.display.showTokens) {
      components.push(`${this.formatTokens(serverData.tokenCount)} Tokens`);
    }
    
    // 成本和百分比
    if (this.config.display.showCost) {
      let costPart = `$${serverData.todayCost}`;
      
      // 添加百分比（如果有限额且启用了百分比显示）
      if (this.config.display.showPercentage && 
          serverData.costLimitNumeric > 0 && 
          typeof serverData.costPercentage === 'number') {
        costPart += `(${serverData.costPercentage}%)`;
      }
      
      components.push(costPart);
    }

    // 到期时间
    if (this.config.display.showExpiry && serverData.expiryDate) {
      const exp = this.formatLocalDateTime(serverData.expiryDate);
      if (exp) {
        components.push(`到期：${exp}`);
      }
    }

    // 更新时间
    if (this.config.display.showLastUpdate && serverData.lastUpdate) {
      const updateTime = this.formatLocalDateTime(serverData.lastUpdate);
      if (updateTime) {
        // 只显示时间部分 (HH:MM:SS)
        const timePart = updateTime.split(' ')[1] || updateTime;
        components.push(`更新：${timePart}`);
      }
    }

    return components.join(' | ');
  }

  // 增强的自适应压缩方法
  compactToFitEnhanced(parts, times, maxLen) {
    let p = [...parts];
    let t = [...times];
    let line = [...p, ...t].filter(Boolean).join(' | ');
    if (line.length <= maxLen) return line;

    // 逐步移除时间信息
    if (t.length > 0) {
      t = [];
      line = [...p, ...t].filter(Boolean).join(' | ');
      if (line.length <= maxLen) return line;
    }

    // 压缩 API 信息
    if (p.length > 1) {
      // 简化最后一个元素（API 信息）
      const apiPart = p[p.length - 1];
      if (apiPart.includes('req') && apiPart.includes('tok')) {
        // 移除 tokens 信息
        p[p.length - 1] = apiPart.replace(/\s+\d+[\.\d]*[KM]?tok/, '');
        line = [...p, ...t].filter(Boolean).join(' | ');
        if (line.length <= maxLen) return line;
      }
    }

    // 如果还是太长，截断
    return line.slice(0, Math.max(0, maxLen - 1)) + '…';
  }

  analyzeTrend(key, windowSize = 3) {
    const series = this.history.slice(-windowSize).map(x => Number(x[key]) || 0);
    if (series.length < 2) return 'flat';
    const diff = series[series.length - 1] - series[0];
    if (diff > 0.01) return 'up';
    if (diff < -0.01) return 'down';
    return 'flat';
  }

  // 构建行文本（统一用“|”无空格分隔）
  buildLine(parts, times) {
    const all = [...parts, ...times].filter(Boolean);
    return all.join('|');
  }

  async runOnce() {
    // 读取 Claude Code 的 JSON 输入
    if (process.stdin.isTTY === false) {
      try {
        const input = await this.readStdin();
        this.parseContext(input);
      } catch (e) {
        // 忽略 stdin 读取错误，继续执行
      }
    }

    try {
      const dto = await this.provider.fetchAndParse(this.config.fetchUrl);
      const normalized = this.normalizeDto(dto);
      this.history.push(normalized);
      const output = this.formatStatus(normalized);
      console.log(output);
    } catch (e) {
      // 即使 API 失败，也显示 shell 信息
      const fallbackData = this.normalizeDto(null);
      const shellPrompt = this.buildShellPrompt();
      if (shellPrompt) {
        console.log(`${shellPrompt} | ⚠️ API离线`);
      } else {
        console.log('⚠️ CC状态栏错误');
      }
    }
  }

  // 读取 stdin 输入
  async readStdin() {
    return new Promise((resolve, reject) => {
      let data = '';
      const timeout = setTimeout(() => {
        reject(new Error('stdin timeout'));
      }, 1000);

      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });

      process.stdin.on('end', () => {
        clearTimeout(timeout);
        resolve(data);
      });

      process.stdin.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}

// 兼容桥接类，供旧测试/调用方识别
class StatusLine extends EnhancedStatusLine {}

if (require.main === module) {
  const status = new EnhancedStatusLine();
  status.runOnce();
}

// 默认导出增强版，同时提供兼容别名
module.exports = EnhancedStatusLine;
module.exports.StatusLine = EnhancedStatusLine;