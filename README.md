# Claude Code 状态栏插件

一个为 Claude Code (Claude Relay Service) 设计的实时API使用统计状态栏插件，支持监控Claude API的请求数、Token使用量、费用等关键指标。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

## ✨ 主要功能

- 🔄 **实时监控**: 自动获取Claude Relay Service使用统计数据
- 📊 **状态栏显示**: 在Claude Code状态栏显示关键指标
- 🌐 **智能抓取**: 使用Puppeteer处理动态加载的管理页面
- 💾 **数据缓存**: 离线模式和智能缓存策略
- ⚡ **性能优化**: 最小化资源占用和网络请求
- 🛡️ **错误处理**: 完善的错误恢复和重试机制

## 📊 监控指标

状态栏显示内容示例：
```
🟢|1840 Requests|48.2M Tokens|$29.22(29%)|到期：2025/09/21 01:08|更新：23:23:54
```

包含信息：
- ✅ **运行状态**：🟢正常 🟡警告 🔴异常
- 📈 **请求统计**：今日总请求数
- 🎯 **Token使用**：输入输出Token总量
- 💰 **费用统计**：今日费用和使用率百分比
- ⏰ **到期时间**：API Key过期日期
- 🔄 **更新时间**：最后数据更新时间

## 🚀 快速安装

### 方式一：从打包文件安装

下载 `claude-code-statusbar-1.0.0.tgz` 打包文件：

```bash
# 从tgz文件安装
npm install -g claude-code-statusbar-1.0.0.tgz

# 验证安装
cc-statusbar --version

# 运行状态栏
cc-statusbar
```

### 方式二：源码安装

```bash
# 克隆仓库
git clone https://github.com/PaceyWang/claude-code-statusbar.git
cd claude-code-statusbar

# 安装依赖
npm install

# 运行测试
npm test

# 运行状态栏
npm run statusline
```

## ⚙️ 配置设置

### 1. 基本配置

创建配置文件 `config.json`：

```json
{
  "api": {
    "url": "https://your-api-domain.com/admin-next/api-stats?apiId=your-api-id",
    "timeout": 15000,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "display": {
    "showRequests": true,
    "showTokens": true,
    "showCost": true,
    "showPercentage": true,
    "showExpiry": true,
    "showLastUpdate": true
  }
}
```

### 2. Claude Code 集成配置

在 Claude Code 中配置状态栏：

1. 打开 Claude Code
2. 创建或编辑 `.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "cc-statusbar",
    "interval": 30000
  }
}
```

或者使用Node.js直接调用：

```json
{
  "statusLine": {
    "type": "command", 
    "command": "node",
    "args": ["/path/to/statusline.js"],
    "interval": 30000
  }
}
```

### 3. 高级配置选项

更多配置项可参考 [`CONFIG-GUIDE.md`](./CONFIG-GUIDE.md)

## 🛠️ 使用方法

### 命令行使用

```bash
# 显示一次状态信息
cc-statusbar

# 使用指定配置文件
cc-statusbar --config /path/to/config.json

# 启用调试模式
cc-statusbar --debug

# 查看帮助
cc-statusbar --help
```

### Claude Code 中使用

配置完成后，状态栏将自动显示API使用统计。状态栏会每30秒自动更新一次。

### 编程方式调用

```javascript
const ClaudeCodeStatusLine = require('claude-code-statusbar');

const statusLine = new ClaudeCodeStatusLine({
  configPath: './config.json'
});

// 获取状态信息
statusLine.run().then(output => {
  console.log(output);
});
```

## 📁 项目结构

```
claude-code-statusbar/
├── bin/
│   └── cc-statusbar.js          # 命令行入口
├── scripts/
│   ├── postinstall.js           # 安装后配置
│   ├── global-config.js         # 全局配置管理
│   └── build-local.js           # 本地构建脚本
├── config-templates/
│   └── detailed-config.json     # 详细配置模板
├── statusline.js                # 主状态栏逻辑
├── api-service.js               # API服务层
├── data-parser.js               # 数据解析器
├── puppeteer-scraper.js         # 网页抓取器
├── ui-components.js             # UI组件
├── test.js                      # 功能测试
├── config.json                  # 默认配置
├── package.json                 # 包配置文件
├── README.md                    # 本文档
├── CHANGELOG.md                 # 版本更新日志
├── CONFIG-GUIDE.md              # 详细配置指南
└── DEPLOYMENT-GUIDE.md          # 部署指南
```

## 🧪 测试功能

```bash
# 运行基础功能测试
npm test

# 手动测试状态栏输出
node statusline.js

# 测试API连接
node scripts/test-connection.js
```

## 🐛 故障排除

### 常见问题

1. **状态栏不显示或显示错误**
   ```bash
   # 检查配置
   cc-statusbar --debug
   
   # 验证网络连接
   curl https://your-api-domain.com/admin-next/api-stats?apiId=your-api-id
   ```

2. **模块找不到错误**
   ```bash
   # 重新安装依赖
   npm install
   
   # 或全局重新安装
   npm install -g claude-code-statusbar
   ```

3. **权限问题**
   ```bash
   # Windows
   npm install -g claude-code-statusbar --force
   
   # macOS/Linux
   sudo npm install -g claude-code-statusbar
   ```

4. **Claude Code 集成问题**
   - 检查 `.claude/settings.json` 文件格式
   - 确认路径配置正确
   - 重启 Claude Code

### 调试模式

启用详细日志：

```bash
# 命令行调试
cc-statusbar --debug

# 或设置环境变量
export DEBUG=claude-statusbar:*
cc-statusbar
```

### 获取支持

如果遇到问题，请：

1. 查看 [Issue 页面](https://github.com/PaceyWang/claude-code-statusbar/issues)
2. 提供错误日志和环境信息
3. 描述复现步骤

## 📝 更新日志

查看 [`CHANGELOG.md`](./CHANGELOG.md) 了解版本更新历史。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支：`git checkout -b my-new-feature`
3. 提交更改：`git commit -am 'Add some feature'`
4. 推送分支：`git push origin my-new-feature`
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Claude Code](https://claude.ai/code) - 提供了优秀的AI编程环境
- [Puppeteer](https://pptr.dev/) - 网页自动化框架
- 所有贡献者和用户的支持

---

**💡 提示**: 首次使用建议运行 `npm test` 验证功能正常，然后根据您的API配置修改 `config.json`。