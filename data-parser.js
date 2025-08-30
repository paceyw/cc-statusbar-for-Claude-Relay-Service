const AdminHtmlProvider = require('./admin-html-provider');

/**
 * 解析提取的原始数据，转换为结构化的统计信息（兼容旧版输出格式）
 * 注意：该函数保留以兼容旧版单元测试与调用方；新逻辑建议直接使用 AdminHtmlProvider
 * @param {Object} rawData - 旧版抓取格式的原始数据结构 { rawText: Array<{text,className}> }
 * @param {boolean} debug - 是否启用调试输出
 * @returns {Object} 解析后的结构化数据
 */
function parseApiStats(rawData, debug = false) {
  const debugLog = debug ? (msg) => console.error(msg) : () => {};
  const stats = {
    todayRequests: 0,
    todayTokens: 0,
    todayCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreateTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    dailyLimit: 0,
    currentUsage: 0,
    usagePercentage: 0,
    lastUpdated: new Date().toISOString(),
    apiKeyName: '',
    apiKeyStatus: '',
    expiryDate: ''
  };

  if (!rawData || !rawData.rawText) {
    debugLog('警告: 没有原始数据可解析');
    return stats;
  }

  function parseNumber(str) {
    if (!str) return 0;
    const cleanStr = str.replace(/[^\d.,KMB]/g, '');
    const match = cleanStr.match(/(\d+(?:[.,]\d+)*)([KMB]?)/i);
    if (!match) return 0;
    let num = parseFloat(match[1].replace(/,/g, ''));
    const suffix = match[2].toUpperCase();
    switch (suffix) {
      case 'K': num *= 1000; break;
      case 'M': num *= 1000000; break;
      case 'B': num *= 1000000000; break;
    }
    return Math.round(num);
  }

  function parsePrice(str) {
    if (!str) return 0;
    const match = str.match(/\$?(\d+(?:[.,]\d+)*)/i);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  }

  debugLog('开始解析数据...');

  rawData.rawText.forEach((item) => {
    const text = item.text;
    const className = item.className || '';

    if (text.includes('今日请求') || (/^\d+$/.test(text.trim()) && className.includes('text-green'))) {
      const m = text.match(/(\d+)/);
      if (m) stats.todayRequests = parseInt(m[1]);
    }

    if (text.includes('今日Token') || text.match(/^\d+(?:[.,]\d+)*[KMB]?$/)) {
      const m = text.match(/(\d+(?:[.,]\d+)*[KMB]?)/);
      if (m && !text.includes('输入') && !text.includes('输出') && !text.includes('缓存')) {
        const val = parseNumber(m[1]);
        if (val > stats.todayTokens) stats.todayTokens = val;
      }
    }

    if (text.includes('今日费用') || /^\$\d/.test(text)) {
      const m = text.match(/\$?(\d+(?:[.,]\d+)*)/);
      if (m) stats.todayCost = parsePrice(m[1]);
    }

    if (text.includes('每日费用限制') || text.includes('/ $')) {
      const m = text.match(/\$(\d+(?:[.,]\d+)*)\s*\/\s*\$?(\d+(?:[.,]\d+)*)/i);
      if (m) stats.dailyLimit = parsePrice(m[2]);
    }

    if (text.includes('过期时间')) {
      const m = text.match(/过期时间([\d\/:\s-]+)/);
      if (m) stats.expiryDate = m[1].trim();
    }

    if (text.includes('名称') && text.includes('状态')) {
      const nameMatch = text.match(/名称([^状态]+)状态/);
      if (nameMatch) stats.apiKeyName = nameMatch[1].trim();
      if (text.includes('活跃')) stats.apiKeyStatus = '活跃';
    }
  });

  if (stats.dailyLimit > 0) {
    stats.currentUsage = stats.todayCost;
    stats.usagePercentage = Math.round((stats.currentUsage / stats.dailyLimit) * 100);
  }

  const calculatedTotal = stats.inputTokens + stats.outputTokens + stats.cacheCreateTokens + stats.cacheReadTokens;
  if (stats.totalTokens === 0) stats.totalTokens = calculatedTotal;

  debugLog('数据解析完成');
  return stats;
}

function formatStats(stats) {
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
  return [
    `📊 Claude API 使用统计`,
    `🔑 ${stats.apiKeyName} (${stats.apiKeyStatus || '未知'})`,
    `📈 今日请求: ${stats.todayRequests}`,
    `🎯 Token总计: ${formatNumber(stats.totalTokens)}`,
    `💰 今日费用: $${stats.todayCost} / $${stats.dailyLimit} (${stats.usagePercentage}%)`,
    `⏰ 更新时间: ${new Date(stats.lastUpdated).toLocaleString('zh-CN')}`,
    `📅 过期时间: ${stats.expiryDate || '未知'}`
  ].join('\n');
}

// 新实现：通过 AdminHtmlProvider 获取数据并映射为旧版 stats 结构
async function getApiStats(url = 'https://your-domain.com/admin-next/api-stats?apiId=your-api-id', options = {}) {
  const provider = new AdminHtmlProvider({
    cacheTTLms: (options.cacheTTLms || 60000)
  });
  const dto = await provider.fetchAndParse(url, {
    timeout: options.timeout || 30000,
    retryAttempts: options.retryAttempts || 3,
    retryDelay: options.retryDelay || 1000
  });
  // 映射到旧版 stats
  const stats = {
    todayRequests: Number(dto.requestCount) || 0,
    todayTokens: Number((dto.tokenCount || '').toString().replace(/[^\d.]/g, '')) || 0,
    todayCost: Number(dto.todayCost) || 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreateTokens: 0,
    cacheReadTokens: 0,
    totalTokens: Number((dto.tokenCount || '').toString().replace(/[^\d.]/g, '')) || 0,
    dailyLimit: Number((dto.costLimit || '').toString().replace(/[^\d.]/g, '')) || 0,
    currentUsage: Number(dto.todayCost) || 0,
    usagePercentage: Number(dto.costPercentage) || 0,
    lastUpdated: new Date().toISOString(),
    apiKeyName: dto.apiKeyName || '',
    apiKeyStatus: dto.apiKeyStatus || '',
    expiryDate: dto.expiryDate || ''
  };
  return stats;
}

if (require.main === module) {
  getApiStats().then((stats) => {
    console.log('\n=== 解析结果 ===');
    console.log(formatStats(stats));
  }).catch((err) => {
    console.error('获取API统计数据失败:', err?.message || err);
    process.exit(1);
  });
}

module.exports = {
  parseApiStats,
  formatStats,
  getApiStats
};