# 🚀 Claude Code StatusBar 部署指南

## 📋 开发完成后的部署流程

### 1️⃣ **清理开发环境**
```bash
# 删除测试文件（如果还存在）
rm -f test-*.js *.log api-stats-screenshot.png

# 清理配置文件中的隐私信息
# 检查并确保以下文件不包含真实的API信息：
# - statusline.js (默认配置应使用占位符)  
# - data-parser.js (示例URL应使用占位符)
# - puppeteer-scraper.js (示例URL应使用占位符)
```

### 2️⃣ **打包项目**
```bash
# 方法一：使用npm打包（推荐）
npm run build

# 方法二：手动打包
npm pack

# 打包完成后会生成类似文件：claude-code-statusbar-1.0.x.tgz
```

### 3️⃣ **安装到目标环境**
```bash
# 方法一：本地安装（开发/测试环境）
node install.js

# 方法二：全局安装已打包文件
npm install -g ./claude-code-statusbar-1.0.x.tgz

# 方法三：发布到npm后安装
npm install -g claude-code-statusbar
```

### 4️⃣ **配置Claude Code状态栏**

#### 自动配置（推荐）
运行安装脚本时会自动提示配置：
```bash
node install.js
```

安装脚本将引导您：
1. 输入Claude API统计页面URL
2. 选择显示模式（紧凑/详细）
3. 自动生成配置文件
4. 测试配置有效性

#### 手动配置
编辑配置文件：`.claude/cc-statusbar-config.json`
```json
{
  "api": {
    "url": "您的API统计页面完整URL"
  },
  "display": {
    "compactMode": false,
    "showRequests": true,
    "showTokens": true,
    "showCost": true,
    "showPercentage": true
  }
}
```

### 5️⃣ **验证安装**
```bash
# 测试状态栏输出
node statusline.js

# 期望输出格式：
# 紧凑模式: 🟢Claude|640R|37.4MT|$23.48(23%)|🧠23%
# 详细模式: 🟢Claude | 640 Requests | 37.4M Tokens | $23.48(23%) 🧠23%[==------]
```

## 🎯 显示模式对比

### 📊 紧凑模式 (compactMode: true)
```
🟢Claude|640R|37.4MT|$23.48(23%)|🧠23%
```
- **优点**: 节省空间，适合小屏幕
- **长度**: 约40字符
- **分隔符**: `|`

### 📋 详细模式 (compactMode: false) 
```
📁project 🟢Claude | 640 Requests | 37.4M Tokens | $23.48(23%) 🧠23%[==------]
```
- **优点**: 信息完整，易读性强
- **长度**: 约90字符
- **分隔符**: ` | `
- **额外信息**: 项目目录、进度条

## ⚙️ 配置文件详解

### 📍 配置文件查找顺序
1. `.claude/cc-statusbar-config.json` (项目级)
2. `config.json` (项目根目录) 
3. `~/.claude/statusbar-config.json` (用户级)

### 🔧 核心配置选项
```json
{
  "api": {
    "url": "Claude管理页面URL",
    "timeout": 15000,
    "retryAttempts": 3
  },
  "display": {
    "compactMode": false,
    "showRequests": true,
    "showTokens": true, 
    "showCost": true,
    "showPercentage": true,
    "maxLength": 120
  },
  "statusbar": {
    "updateInterval": 30,
    "icons": {
      "normal": "🟢",
      "warning": "🟡", 
      "critical": "🔴"
    }
  }
}
```

## 🔄 自动更新功能

### ⏱️ 更新机制
- **更新间隔**: 30秒（可配置）
- **缓存策略**: 智能缓存避免频繁请求
- **失败处理**: 自动降级到缓存数据

### 🧪 测试自动更新
```bash
# 运行更新测试（需要90秒）
node test-updates.js

# 输出示例：
# [14:30:00] 第 1 次获取状态...
# [14:30:00] 状态: 🟢Claude | 640 Requests | 37.4M Tokens | $23.48(23%) 🧠23%
# [14:30:30] 第 2 次获取状态...
# [14:30:30] 状态: 🟢Claude | 641 Requests | 37.5M Tokens | $23.52(24%) 🧠23%
```

## 🛠️ 故障排除

### ❌ 常见问题

#### 1. 显示"❌ Claude API Error"
- **原因**: API URL配置错误或网络连接问题
- **解决**: 检查`.claude/cc-statusbar-config.json`中的URL设置

#### 2. 状态栏格式不正确
- **原因**: compactMode配置未生效
- **解决**: 重新运行`node install.js`或手动编辑配置文件

#### 3. 数据不更新
- **原因**: 网络问题或API变更  
- **解决**: 检查API URL有效性，查看错误日志

### 🔍 调试模式
启用调试输出：
```json
{
  "debug": {
    "enableLogging": true,
    "logLevel": "debug"
  }
}
```

## 📦 文件清单

### 核心文件
- `statusline.js` - 主程序入口
- `api-service.js` - API服务层
- `data-parser.js` - 数据解析引擎
- `puppeteer-scraper.js` - 网页抓取器
- `ui-components.js` - UI组件库
- `install.js` - 安装配置脚本

### 配置文件  
- `.claude/cc-statusbar-config.json` - 主配置文件
- `config-templates/` - 配置模板
- `CONFIG-GUIDE.md` - 配置详细指南

### 文档文件
- `README.md` - 项目说明
- `CHANGELOG.md` - 版本历史  
- `CLAUDE.md` - 开发指南
- `DEPLOYMENT-GUIDE.md` - 本部署指南

## 🎉 部署完成确认

✅ **确认清单**：
- [ ] 状态栏能正常显示API使用情况
- [ ] 显示模式与配置一致（紧凑/详细）
- [ ] 数据每30秒自动更新
- [ ] 配置文件不包含隐私信息
- [ ] 在Claude Code中正常工作

🎊 **恭喜！Claude Code StatusBar部署成功！**