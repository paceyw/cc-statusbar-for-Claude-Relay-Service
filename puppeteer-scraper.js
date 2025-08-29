const puppeteer = require('puppeteer');

/**
 * 使用Puppeteer获取动态加载的API统计数据
 * @param {string} url - 目标URL
 * @param {number} timeout - 超时时间（毫秒）
 * @param {boolean} debug - 是否启用调试输出
 * @returns {Promise<Object>} 提取的数据
 */
async function scrapeApiStats(url, timeout = 30000, debug = false) {
  let browser = null;
  
  // 调试输出函数，输出到stderr避免干扰stdout
  const debugLog = debug ? (msg) => console.error(msg) : () => {};
  
  try {
    debugLog('启动浏览器...');
    browser = await puppeteer.launch({
      headless: true, // 设置为false可以看到浏览器界面
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 });
    
    debugLog('正在加载页面:' + url);
    
    // 加载页面
    await page.goto(url, {
      waitUntil: 'networkidle2', // 等待网络空闲
      timeout: timeout
    });
    
    debugLog('页面加载完成，等待数据渲染...');
    
    // 等待关键元素出现
    try {
      await page.waitForSelector('.usage-stats, .api-stats, [class*="stat"], [class*="usage"]', {
        timeout: 10000
      });
      debugLog('找到统计数据元素');
    } catch (e) {
      debugLog('未找到预期的统计数据元素，继续尝试提取数据');
    }
    
    // 额外等待确保JavaScript执行完成
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    debugLog('开始提取数据...');
    
    // 提取页面数据
    const extractedData = await page.evaluate(() => {
      const data = {
        requestCount: 0,
        tokenCount: 0,
        todayCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        generatedTokens: 0,
        readTokens: 0,
        dailyLimit: 0,
        monthlyLimit: 0,
        extractedAt: new Date().toISOString(),
        rawText: []
      };
      
      // 方法1: 查找包含数字的文本元素
      const allElements = document.querySelectorAll('*');
      const numberPattern = /\d+(?:[.,]\d+)*[KMB]?/g;
      const pricePattern = /\$?\d+(?:[.,]\d+)*/g;
      
      allElements.forEach(element => {
        const text = element.textContent?.trim();
        if (text && text.length < 100) { // 避免获取过长的文本
          const hasNumbers = numberPattern.test(text);
          const hasPrice = pricePattern.test(text);
          
          if (hasNumbers || hasPrice) {
            data.rawText.push({
              text: text,
              className: element.className,
              tagName: element.tagName,
              id: element.id
            });
          }
        }
      });
      
      // 方法2: 查找特定的数据模式
      const textContent = document.body.textContent || '';
      
      // 查找请求数
      const requestMatches = textContent.match(/(\d+)\s*(?:次|个)?\s*(?:请求|request)/i);
      if (requestMatches) {
        data.requestCount = parseInt(requestMatches[1].replace(/,/g, ''));
      }
      
      // 查找Token数
      const tokenMatches = textContent.match(/(\d+(?:[.,]\d+)*[KMB]?)\s*(?:token|Token)/i);
      if (tokenMatches) {
        let tokenStr = tokenMatches[1].replace(/,/g, '');
        let multiplier = 1;
        if (tokenStr.includes('K')) multiplier = 1000;
        else if (tokenStr.includes('M')) multiplier = 1000000;
        else if (tokenStr.includes('B')) multiplier = 1000000000;
        
        data.tokenCount = parseFloat(tokenStr.replace(/[KMB]/g, '')) * multiplier;
      }
      
      // 查找费用
      const costMatches = textContent.match(/\$?(\d+(?:[.,]\d+)*)\s*(?:费用|cost|Cost)/i);
      if (costMatches) {
        data.todayCost = parseFloat(costMatches[1].replace(/,/g, ''));
      }
      
      // 方法3: 查找特定的CSS选择器
      const selectors = [
        '[class*="count"]',
        '[class*="stat"]',
        '[class*="usage"]',
        '[class*="token"]',
        '[class*="cost"]',
        '[class*="price"]',
        '.number',
        '.value',
        '.amount'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && /\d/.test(text)) {
              data.rawText.push({
                text: text,
                selector: selector,
                className: el.className,
                id: el.id
              });
            }
          });
        } catch (e) {
          // 忽略选择器错误
        }
      });
      
      return data;
    });
    
    debugLog('数据提取完成');
    
    // 截图用于调试
    await page.screenshot({ 
      path: 'api-stats-screenshot.png',
      fullPage: true
    });
    debugLog('已保存截图: api-stats-screenshot.png');
    
    return extractedData;
    
  } catch (error) {
    console.error('抓取过程中发生错误:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      debugLog('浏览器已关闭');
    }
  }
}

// 主函数 - 用于直接运行测试
async function main() {
  const url = 'https://your-domain.com/admin-next/api-stats?apiId=your-api-id';
  
  try {
    console.log('=== 开始使用Puppeteer抓取数据 ===');
    const data = await scrapeApiStats(url, 30000, true); // 在main中启用debug
    
    console.log('\n=== 提取的数据 ===');
    console.log('请求数:', data.requestCount);
    console.log('Token数:', data.tokenCount);
    console.log('今日费用:', data.todayCost);
    console.log('输入Token:', data.inputTokens);
    console.log('输出Token:', data.outputTokens);
    console.log('提取时间:', data.extractedAt);
    
    console.log('\n=== 原始文本数据 ===');
    data.rawText.forEach((item, index) => {
      if (index < 20) { // 只显示前20个
        console.log(`${index + 1}. ${item.text} (${item.tagName || 'unknown'}.${item.className || 'no-class'})`);
      }
    });
    
    if (data.rawText.length > 20) {
      console.log(`... 还有 ${data.rawText.length - 20} 个文本元素`);
    }
    
    // 保存数据到文件
    const fs = require('fs');
    fs.writeFileSync('extracted-data.json', JSON.stringify(data, null, 2));
    console.log('\n数据已保存到: extracted-data.json');
    
  } catch (error) {
    console.error('抓取失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = { scrapeApiStats };