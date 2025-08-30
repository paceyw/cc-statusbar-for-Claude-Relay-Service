#!/usr/bin/env node

/**
 * AdminHtmlProvider
 * - 仅 HTTP 抓取 + DOM 解析（axios + cheerio）
 * - 指数退避重试，默认超时 30s
 * - 内存缓存（按 URL 维度），TTL=构造参数 cacheTTLms
 * - 零泄露日志（不打印完整 URL/query，绝不打印响应体）
 */

const axios = require('axios');
const cheerio = require('cheerio');

class AdminHtmlProvider {
  constructor(options = {}) {
    const { cacheTTLms = 60_000, maxCacheEntries = 5 } = options;
    this.cacheTTLms = cacheTTLms;
    this.maxCacheEntries = maxCacheEntries;
    this.cache = new Map(); // key: url -> { dto, expiresAt }
  }

  // 深拷贝，避免上层修改缓存体
  static deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // 对 URL 做安全脱敏，仅保留主机与路径
  static safeLogUrl(url) {
    try {
      const u = new URL(url);
      u.search = ''; // 去掉 query
      return u.toString();
    } catch {
      return '[invalid-url]';
    }
  }

  // 解析紧凑数字 1.2K/3.4M/5B 等，返回 number
  static parseCompactNumber(str) {
    if (str == null) return 0;
    const s = String(str).trim();
    const m = s.match(/(\d+(?:\.\d+)?)([KMB])?/i);
    if (!m) {
      // 尝试去掉千分位逗号
      const n = parseFloat(s.replace(/[^\d.]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    let num = parseFloat(m[1]);
    const suf = (m[2] || '').toUpperCase();
    if (suf === 'K') num *= 1_000;
    if (suf === 'M') num *= 1_000_000;
    if (suf === 'B') num *= 1_000_000_000;
    return num;
  }

  static parseCurrencyNumber(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  static parsePercentage(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  // 聚合模型统计中常见字段名，得到请求总数与 Token 总数
  static aggregateModelStats(items) {
    if (!Array.isArray(items)) return { requests: 0, tokens: 0 };
    let totalReq = 0;
    let totalTok = 0;
    const reqKeys = ['requests', 'requestCount', 'totalRequests', 'count', 'reqCount'];
    const tokKeys = ['tokens', 'tokenCount', 'totalTokens'];
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      // 请求
      for (const k of reqKeys) {
        if (typeof it[k] === 'number') { totalReq += it[k]; break; }
      }
      // Token（优先单字段，否则尝试输入+输出/提示+补全）
      let addedTok = false;
      for (const k of tokKeys) {
        if (typeof it[k] === 'number') { totalTok += it[k]; addedTok = true; break; }
      }
      if (!addedTok) {
        const pairs = [
          ['inputTokens', 'outputTokens'],
          ['promptTokens', 'completionTokens']
        ];
        for (const [a, b] of pairs) {
          const va = typeof it[a] === 'number' ? it[a] : 0;
          const vb = typeof it[b] === 'number' ? it[b] : 0;
          if (va || vb) { totalTok += va + vb; addedTok = true; break; }
        }
      }
    }
    return { requests: totalReq, tokens: totalTok };
  }

  // 核心：抓取 + 解析 + 缓存（优先 JSON 直连 POST，失败回退 DOM 解析）
  async fetchAndParse(url, options = {}) {
    const {
      timeout = 30_000,
      retryAttempts = 3,
      retryDelay = 800,
      headers = {}
    } = options;

    // 命中有效缓存直接返回
    const now = Date.now();
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > now) {
      return AdminHtmlProvider.deepCopy(cached.dto);
    }

    // 失败重试（指数退避+抖动）
    let lastErr;
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        // 优先尝试 JSON 直连分支（需要从 CC_SCRAPE_URL 中解析 apiId 与 origin）
        let usedJsonBranch = false;
        try {
          const u = new URL(url);
          const apiId = u.searchParams.get('apiId');
          const origin = u.origin; // e.g., https://your-api-domain.com:6443
          if (apiId) {
            usedJsonBranch = true;
            const jsonHeaders = {
              'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (StatusBar/1.0; +https://github.com/PaceyWang/claude-code-statusbar)',
              'Accept-Language': headers['Accept-Language'] || 'zh-CN,zh;q=0.9,en;q=0.8',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Origin': origin,
              'Referer': url,
              ...headers
            };

            const statsUrl = `${origin}/apiStats/api/user-stats`;
            const modelsUrl = `${origin}/apiStats/api/user-model-stats`;

            // 并行请求两个 JSON 接口
            const [statsRes, modelsRes] = await Promise.all([
              axios.post(statsUrl, { apiId }, { timeout, headers: jsonHeaders }),
              axios.post(modelsUrl, { apiId, period: 'daily' }, { timeout, headers: jsonHeaders })
            ]);

            const stats = (statsRes && statsRes.data) || {};
            const models = (modelsRes && modelsRes.data) || {};

            // 兼容不同包裹形式：有的接口 data 在 data 字段下
            const s = typeof stats === 'object' && stats && stats.data ? stats.data : stats;
            const m = typeof models === 'object' && models && models.data ? models.data : models;
            const modelItems = Array.isArray(m) ? m : (Array.isArray(m.items) ? m.items : (Array.isArray(m.list) ? m.list : []));

            // 从 user-model-stats 聚合今日数据
            let totalRequests = 0;
            let totalTokens = 0;
            let totalCost = 0;
            
            for (const item of modelItems) {
              if (!item || typeof item !== 'object') continue;
              
              // 请求数聚合
              const requests = Number(item.requests) || 0;
              totalRequests += requests;
              
              // Token 聚合：优先使用 allTokens；回退到 inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens
              let tokensAdded = false;
              const allTokens = Number(item.allTokens);
              if (isFinite(allTokens) && allTokens >= 0) {
                totalTokens += allTokens;
                tokensAdded = true;
              }
              if (!tokensAdded) {
                const inputTokens = Number(item.inputTokens) || 0;
                const outputTokens = Number(item.outputTokens) || 0;
                const cacheCreateTokens = Number(item.cacheCreateTokens) || 0;
                const cacheReadTokens = Number(item.cacheReadTokens) || 0;
                totalTokens += inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens;
              }
              
              // 成本聚合：从 costs.total 取数
              if (item.costs && typeof item.costs.total === 'number') {
                totalCost += item.costs.total;
              }
            }

            // 从 user-stats 获取限额和到期时间
            const num = (v) => {
              if (typeof v === 'number' && isFinite(v)) return v;
              const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, ''));
              return isNaN(n) ? 0 : n;
            };

            // 每日限额：从 user-stats.data.limits.dailyCostLimit 取数
            let costLimit = 0;
            if (s && s.limits && typeof s.limits.dailyCostLimit === 'number') {
              costLimit = s.limits.dailyCostLimit;
            }

            // 到期时间：从 user-stats.data.expiresAt 取数
            let expiryDate = '';
            if (s && s.expiresAt) {
              expiryDate = s.expiresAt;
            }

            const dto = {
              requestCount: totalRequests,
              tokenCount: totalTokens,
              todayCost: totalCost,
              costLimit: costLimit,
              costPercentage: 0,
              apiKeyName: s.apiKeyName || s.keyName || '',
              apiKeyStatus: s.apiKeyStatus || s.keyStatus || s.status || '',
              expiryDate: expiryDate
            };

            // 回填 lastUpdate（ISO 格式）
            dto.lastUpdate = new Date().toISOString();

            // 计算 costPercentage（若可推导）
            if (dto.costLimit && dto.costLimit > 0) {
              const pct = (dto.todayCost / dto.costLimit) * 100;
              dto.costPercentage = isFinite(pct) ? parseFloat(pct.toFixed(1)) : 0;
            } else {
              dto.costPercentage = null; // 无限额时为 null
            }

            // Removed duplicate legacy extraction block; using model-stats aggregated dto above

            // 写入缓存（LRU：超出上限时清理最旧一项）
            if (this.cache.size >= this.maxCacheEntries) {
              const firstKey = this.cache.keys().next().value;
              this.cache.delete(firstKey);
            }
            this.cache.set(url, { dto, expiresAt: now + this.cacheTTLms });

            return AdminHtmlProvider.deepCopy(dto);
          }
        } catch (inner) {
          // JSON 分支解析/请求失败，记录但不终止（回退到 DOM 分支）
          lastErr = inner;
        }

        // 回退：GET HTML + DOM 解析
        const res = await axios.get(url, {
          timeout,
          headers: {
            'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (StatusBar/1.0; +https://github.com/PaceyWang/claude-code-statusbar)',
            'Accept-Language': headers['Accept-Language'] || 'zh-CN,zh;q=0.9,en;q=0.8',
            ...headers
          },
        });

        const html = res.data;
        const dto = this.parseHtmlToDto(html);

        // 回填 lastUpdate（ISO）
        dto.lastUpdate = new Date().toISOString();

        // 计算 costPercentage（若页面未给出且可推导）
        if ((dto.costPercentage == null || dto.costPercentage === 0) && dto.todayCost != null && dto.costLimit) {
          const pct = dto.costLimit > 0 ? Math.round((dto.todayCost / dto.costLimit) * 100) : 0;
          dto.costPercentage = isFinite(pct) ? pct : 0;
        }

        // 写入缓存（LRU：超出上限时清理最旧一项）
        if (this.cache.size >= this.maxCacheEntries) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        this.cache.set(url, { dto, expiresAt: now + this.cacheTTLms });

        return AdminHtmlProvider.deepCopy(dto);
      } catch (err) {
        lastErr = err;
        // 仅在非最后一次尝试时退避等待
        if (attempt < retryAttempts - 1) {
          const base = retryDelay * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * 150);
          await new Promise(r => setTimeout(r, base + jitter));
        }
      }
    }

    // 所有尝试失败，返回安全的默认 DTO（不抛错以保证状态栏不崩）
    const safeUrl = AdminHtmlProvider.safeLogUrl(url);
    if (process.env.DEBUG || process.env.CC_DEBUG) {
      console.error(`[AdminHtmlProvider] 获取失败: ${safeUrl} -> ${lastErr?.message || lastErr}`);
    }
    return {
      requestCount: 0,
      tokenCount: 0,
      todayCost: 0,
      costLimit: 0,
      costPercentage: 0,
      apiKeyName: '',
      apiKeyStatus: '',
      expiryDate: '',
      lastUpdate: new Date().toISOString()
    };
  }

  // 将 HTML 解析为 DTO（尽量鲁棒的关键词+正则策略）
  parseHtmlToDto(html) {
    const $ = cheerio.load(html);
    const pageText = $.root().text().replace(/\s+/g, ' ').trim();

    const dto = {
      requestCount: 0,
      tokenCount: 0,
      todayCost: 0,
      costLimit: 0,
      costPercentage: 0,
      apiKeyName: '',
      apiKeyStatus: '',
      expiryDate: ''
    };

    // 1) 今日请求数
    // 示例: "今日请求 123" / "今日请求数 123" / "123 Requests"
    let m;
    m = pageText.match(/今日\s*请求(?:数)?\D*(\d[\d,]*)/);
    if (!m) m = pageText.match(/(\d[\d,]*)\s*(?:次)?\s*请求/);
    if (!m) m = pageText.match(/(\d[\d,]*)\s*Requests?/i);
    if (m) dto.requestCount = parseInt(m[1].replace(/,/g, ''), 10);

    // 2) Token 数
    // 示例: "Token 217.7K" / "今日 Token 29.4K" / "Total Tokens 1.2M"
    m = pageText.match(/Token(?:s)?\D*(\d+(?:\.\d+)?[KMB]?)/i);
    if (m) dto.tokenCount = AdminHtmlProvider.parseCompactNumber(m[1]);

    // 3) 今日费用 todayCost
    // 示例: "今日费用 $1.23" / "$1.23 Today" / "Today Cost: $1.23"
    m = pageText.match(/今日\s*费用\D*\$?(\d+(?:\.\d+)?)/);
    if (!m) m = pageText.match(/Today\s*Cost\D*\$?(\d+(?:\.\d+)?)/i);
    if (!m) m = pageText.match(/\$\s*(\d+(?:\.\d+)?)(?:\s*Today)?/i);
    if (m) dto.todayCost = AdminHtmlProvider.parseCurrencyNumber(m[1]);

    // 4) 每日费用限制 costLimit
    // 示例: "$1.23 / $100" / "每日费用限制 $100"
    m = pageText.match(/\$\s*\d+(?:\.\d+)?\s*\/\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (!m) m = pageText.match(/每日\s*费用\s*限制\D*\$?\s*(\d+(?:\.\d+)?)/);
    if (m) dto.costLimit = AdminHtmlProvider.parseCurrencyNumber(m[1]);

    // 5) 百分比 costPercentage
    // 示例: "60%"（通常跟在费用旁边）
    m = pageText.match(/(\d+(?:\.\d+)?)%/);
    if (m) dto.costPercentage = AdminHtmlProvider.parsePercentage(m[1]);

    // 6) API Key 名称与状态
    // 示例: "名称 XXX 状态 活跃" / "Name: XXX Status: Active"
    m = pageText.match(/名称\s*([^状态\n]+?)\s*状态/);
    if (m) dto.apiKeyName = m[1].trim();
    if (/状态\s*(活跃|禁用|已禁用)/.test(pageText)) dto.apiKeyStatus = RegExp.$1;
    else if (/Status\s*:\s*(Active|Disabled)/i.test(pageText)) dto.apiKeyStatus = RegExp.$1;

    // 7) 过期时间
    // 示例: "过期时间 2025/01/31 23:59" / "Expiry: 2025-01-31"
    m = pageText.match(/过期时间\s*([\d/:\-\s]+\d)/);
    if (!m) m = pageText.match(/Expiry\s*:?\s*([\d/:\-\s]+\d)/i);
    if (m) dto.expiryDate = m[1].trim();

    return dto;
  }
}

module.exports = AdminHtmlProvider;