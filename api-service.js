const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * API服务类 - 负责与中转服务器API通信
 * 参考ccusage实现逻辑，提供高效的数据获取、缓存管理和错误处理功能
 */
class ApiService {
    constructor() {
        this.baseConfig = {
            timeout: 15000, // 15秒超时
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            // 忽略SSL证书验证（用于自签名证书）
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        };
        
        // 缓存数据 - 改进为Map结构支持多个API端点
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30秒缓存
        this.offlineMode = false;
        this.persistentCachePath = path.join(process.cwd(), '.claude', 'cache.json');
        
        // 重试配置
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 2000, // 2秒
            backoffMultiplier: 1.5
        };
        
        // 加载持久化缓存
        this.loadPersistentCache();
    }

    /**
     * 加载持久化缓存
     */
    loadPersistentCache() {
        try {
            if (fs.existsSync(this.persistentCachePath)) {
                const cacheData = JSON.parse(fs.readFileSync(this.persistentCachePath, 'utf8'));
                // 恢复缓存数据
                Object.entries(cacheData).forEach(([key, value]) => {
                    this.cache.set(key, value);
                });
            }
        } catch (error) {
            // 忽略缓存加载错误
        }
    }

    /**
     * 保存持久化缓存
     */
    savePersistentCache() {
        try {
            const cacheDir = path.dirname(this.persistentCachePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            
            const cacheData = Object.fromEntries(this.cache);
            fs.writeFileSync(this.persistentCachePath, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            // 忽略缓存保存错误
        }
    }

    /**
     * 获取服务器状态数据
     * @param {string} apiUrl - API接口地址
     * @param {boolean} useCache - 是否使用缓存
     * @returns {Promise<string>} HTML响应数据
     */
    async fetchServerStatus(apiUrl, useCache = true) {
        const cacheKey = `status_${apiUrl}`;
        
        // 检查内存缓存
        if (useCache && this.isCacheValid(cacheKey)) {
            console.log('使用内存缓存数据');
            return this.cache.get(cacheKey).data;
        }
        
        // 离线模式检查
        if (this.offlineMode && this.cache.has(cacheKey)) {
            // 离线模式：使用缓存数据（已移除调试输出）
            return this.cache.get(cacheKey).data;
        }
        
        let lastError = null;
        
        // 重试机制
        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                console.log(`尝试获取数据 (第${attempt}次)...`);
                
                const response = await this.makeRequest(apiUrl);
                
                if (response.status === 200 && response.data) {
                    // 更新缓存
                    this.updateCache(cacheKey, response.data);
                    this.savePersistentCache();
                    console.log('数据获取成功');
                    return response.data;
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                
            } catch (error) {
                lastError = error;
                console.warn(`第${attempt}次尝试失败:`, error.message);
                
                // 如果不是最后一次尝试，等待后重试
                if (attempt < this.retryConfig.maxRetries) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
                    console.log(`等待${delay}ms后重试...`);
                    await this.sleep(delay);
                }
            }
        }
        
        // 所有重试都失败，检查是否有缓存数据
        if (this.cache.has(cacheKey)) {
            console.log('使用过期缓存数据');
            return this.cache.get(cacheKey).data;
        }
        
        // 抛出最后一个错误
        throw new Error(`获取数据失败 (${this.retryConfig.maxRetries}次重试): ${lastError.message}`);
    }

    /**
     * 发起HTTP请求
     * @param {string} url - 请求地址
     * @returns {Promise<Object>} axios响应对象
     */
    async makeRequest(url) {
        const config = {
            ...this.baseConfig,
            method: 'GET',
            url: url,
            validateStatus: (status) => status < 500 // 只有5xx错误才抛出异常
        };
        
        return await axios(config);
    }

    /**
     * 检查缓存是否有效
     * @param {string} cacheKey - 缓存键
     * @returns {boolean}
     */
    isCacheValid(cacheKey) {
        if (!this.cache.has(cacheKey)) {
            return false;
        }
        
        const cacheItem = this.cache.get(cacheKey);
        if (!cacheItem.data || !cacheItem.timestamp) {
            return false;
        }
        
        const now = Date.now();
        return (now - cacheItem.timestamp) < this.cacheTimeout;
    }

    /**
     * 更新缓存
     * @param {string} cacheKey - 缓存键
     * @param {string} data - 要缓存的数据
     */
    updateCache(cacheKey, data) {
        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * 清除缓存
     * @param {string} cacheKey - 缓存键（可选，不传则清除所有缓存）
     */
    clearCache(cacheKey = null) {
        if (cacheKey) {
            this.cache.delete(cacheKey);
        } else {
            this.cache.clear();
        }
        this.savePersistentCache();
    }

    /**
     * 设置缓存TTL
     * @param {number} ttl - 缓存时间（毫秒）
     */
    setCacheTTL(ttl) {
        this.cacheTimeout = ttl;
    }

    /**
     * 设置离线模式
     * @param {boolean} offline - 是否启用离线模式
     */
    setOfflineMode(offline) {
        this.offlineMode = offline;
    }

    /**
     * 测试API连接
     * @param {string} apiUrl - API接口地址
     * @returns {Promise<Object>} 测试结果
     */
    async testConnection(apiUrl) {
        const startTime = Date.now();
        
        try {
            const response = await this.makeRequest(apiUrl);
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            return {
                success: true,
                status: response.status,
                responseTime: responseTime,
                dataSize: response.data ? response.data.length : 0,
                message: `连接成功 (${responseTime}ms)`
            };
        } catch (error) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            return {
                success: false,
                status: error.response ? error.response.status : 0,
                responseTime: responseTime,
                dataSize: 0,
                message: `连接失败: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * 获取网络状态信息
     * @param {string} cacheKey - 缓存键（可选）
     * @returns {Object} 网络状态
     */
    getNetworkInfo(cacheKey = null) {
        if (cacheKey && this.cache.has(cacheKey)) {
            const cacheItem = this.cache.get(cacheKey);
            return {
                cacheValid: this.isCacheValid(cacheKey),
                cacheAge: cacheItem.timestamp ? Date.now() - cacheItem.timestamp : null,
                cacheTTL: this.cacheTimeout,
                hasData: !!cacheItem.data,
                offlineMode: this.offlineMode
            };
        }
        
        return {
            totalCacheItems: this.cache.size,
            cacheTTL: this.cacheTimeout,
            offlineMode: this.offlineMode,
            cacheKeys: Array.from(this.cache.keys())
        };
    }

    /**
     * 睡眠函数
     * @param {number} ms - 睡眠时间（毫秒）
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 设置请求超时时间
     * @param {number} timeout - 超时时间（毫秒）
     */
    setTimeout(timeout) {
        this.baseConfig.timeout = timeout;
    }

    /**
     * 设置重试配置
     * @param {Object} config - 重试配置
     */
    setRetryConfig(config) {
        this.retryConfig = { ...this.retryConfig, ...config };
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            cache: this.getNetworkInfo(),
            config: {
                timeout: this.baseConfig.timeout,
                maxRetries: this.retryConfig.maxRetries,
                retryDelay: this.retryConfig.retryDelay
            }
        };
    }
}

module.exports = ApiService;