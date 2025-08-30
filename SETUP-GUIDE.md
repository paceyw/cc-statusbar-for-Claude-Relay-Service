# Claude Code StatusBar 快速安装指南

## 📦 安装

```bash
npm install -g claude-code-statusbar
```

安装完成后，插件会自动配置Claude Code设置文件。

## ⚙️ 环境变量配置（必需）

插件需要设置API地址才能正常工作：

### Windows
```cmd
set CC_SCRAPE_URL=https://your-api-domain.com:6443/admin-next/api-stats?apiId=your-api-id
```

### macOS/Linux
```bash
export CC_SCRAPE_URL="https://your-api-domain.com:6443/admin-next/api-stats?apiId=your-api-id"
```

### 永久设置（推荐）

**Windows:**
```cmd
setx CC_SCRAPE_URL "https://your-api-domain.com:6443/admin-next/api-stats?apiId=your-api-id"
```

**macOS/Linux (添加到 ~/.bashrc 或 ~/.zshrc):**
```bash
echo 'export CC_SCRAPE_URL="https://your-api-domain.com:6443/admin-next/api-stats?apiId=your-api-id"' >> ~/.bashrc
source ~/.bashrc
```

## 🚀 启动

1. 设置完环境变量后，**重启Claude Code**
2. 状态栏应该会显示API使用情况

## 🔍 测试

在命令行中测试插件是否正常工作：

```bash
cc-statusbar
```

应该输出类似：
```
🟢 | 459 Requests | 18.9M Tokens | $9.55(9.5%) | 到期：2025/09/21 01:08 | 更新：14:48
```

## 📁 配置文件位置

Claude Code配置文件会自动创建在：
- **Windows:** `%USERPROFILE%\.claude\settings.json`
- **macOS/Linux:** `~/.claude/settings.json`

配置内容：
```json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/statusline.js"
  }
}
```

## 🔧 故障排除

### 状态栏不显示
1. 确认已设置 `CC_SCRAPE_URL` 环境变量
2. 重启Claude Code
3. 检查API地址是否正确
4. 运行 `cc-statusbar` 测试插件

### 权限问题（Unix系统）
如果遇到权限错误：
```bash
chmod +x /path/to/node_modules/claude-code-statusbar/statusline.js
```

### 手动修复配置
如果自动配置失败，手动编辑 `~/.claude/settings.json`：
```json
{
  "statusLine": {
    "type": "command",
    "command": "/full/path/to/statusline.js"
  }
}
```

## 📊 显示格式

状态栏显示格式：
```
🟢 | [请求数] Requests | [Token数] Tokens | $[费用]([百分比]%) | 到期：[日期] | 更新：[时间]
```

- 🟢 绿色：正常使用
- 🟡 黄色：费用警告（>70%）  
- 🔴 红色：费用临界（>90%）

## 🛠️ 高级配置

### 自定义显示长度
```bash
export CC_STATUS_MAXLEN=150
```

### 配置优先级
1. 环境变量 `CC_SCRAPE_URL`
2. 插件配置文件

## 📞 支持

如有问题，请：
1. 检查环境变量设置
2. 测试插件直接运行
3. 查看Claude Code日志
4. 提交Issue到GitHub

---

更多信息请查看：https://github.com/paceyw/cc-statusbar-for-Claude-Relay-Service