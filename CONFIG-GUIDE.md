# Claude Code 状态栏配置指南

## 配置文件位置

系统会按以下顺序查找配置文件：

1. `.claude/cc-statusbar-config.json` （项目级配置）
2. `config.json` （项目根目录）
3. `~/.claude/statusbar-config.json` （用户级配置）

如果不存在配置文件，将使用内置默认配置。

## 快速开始

1. **复制默认配置**
   ```bash
   cp .claude/cc-statusbar-config.json .claude/my-config.json
   ```

2. **修改API URL**
   打开配置文件，找到 `api.url` 字段，替换为你的Claude管理页面URL：
   ```json
   {
     "api": {
       "url": "https://your-claude-admin.com/api-stats?apiId=your-id"
     }
   }
   ```

3. **重新加载状态栏**
   配置修改后会自动生效，无需重启。

## 配置项详解

### API配置 (`api`)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | string | - | **必填** Claude管理页面的完整URL |
| `timeout` | number | 15000 | 请求超时时间（毫秒） |
| `retryAttempts` | number | 3 | 失败重试次数 |
| `retryDelay` | number | 1000 | 重试延迟（毫秒） |
| `cacheTimeout` | number | 30000 | 缓存有效期（毫秒） |

**获取API URL的方法：**
1. 登录Claude管理后台
2. 找到API统计或用量页面
3. 复制完整的URL（包括apiId参数）

### 显示配置 (`display`)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `compactMode` | boolean | true | 紧凑模式，减少空格 |
| `showRequests` | boolean | true | 显示今日请求数 |
| `showTokens` | boolean | true | 显示今日Token数 |
| `showCost` | boolean | true | 显示今日费用 |
| `showPercentage` | boolean | true | 显示费用百分比 |
| `showTrends` | boolean | true | 显示趋势箭头 |
| `showApiStats` | boolean | false | 显示API成功率 |
| `maxLength` | number | 80 | 状态栏最大长度 |

**输出格式示例：**
- 紧凑模式：`🟢Claude 42R|1.2MT|$2.45(12%)`
- 详细模式：`🟢 Claude | 42 Requests | 1.2M Tokens | $2.45 (12%)`

### 状态栏配置 (`statusbar`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `updateInterval` | number | 更新间隔（秒） |
| `separator` | string | 信息分隔符 |
| `icons` | object | 状态图标配置 |

**图标配置：**
```json
{
  "icons": {
    "normal": "🟢",     // 正常状态
    "warning": "🟡",    // 警告状态（费用>60%）
    "critical": "🔴",   // 严重状态（费用>80%）
    "error": "❌",      // 错误状态（连接失败）
    "trending_up": "📈", // 费用上升趋势
    "trending_down": "📉" // 费用下降趋势
  }
}
```

### 告警配置 (`alerts`)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `costWarningThreshold` | number | 60 | 费用警告阈值（%） |
| `costCriticalThreshold` | number | 80 | 严重警告阈值（%） |

## 预设配置模板

### 1. 最小化配置
适合屏幕空间有限的情况：
```bash
cp config-templates/minimal-config.json .claude/cc-statusbar-config.json
```

### 2. 详细配置
显示所有可用信息：
```bash
cp config-templates/detailed-config.json .claude/cc-statusbar-config.json
```

## 常见问题

### 1. 状态栏显示"连接失败"
- 检查API URL是否正确
- 确认网络连接正常
- 检查API接口是否需要认证

### 2. 数据更新不及时
- 调整 `statusbar.updateInterval` 减少更新间隔
- 检查 `api.cacheTimeout` 设置
- 启用debug模式查看详细日志

### 3. 状态栏内容被截断
- 增加 `display.maxLength` 值
- 启用 `display.compactMode`
- 关闭不必要的显示项

### 4. 启用调试模式
```json
{
  "debug": {
    "enableLogging": true,
    "logLevel": "debug"
  }
}
```
然后检查日志文件：`.claude/statusbar.log`

## 配置生效

配置文件修改后会自动生效，无需重启Claude Code。如果配置有语法错误，系统将使用默认配置并在日志中记录错误信息。

## 配置验证

测试配置是否正确：
```bash
node statusline.js
```

如果配置正确，应该输出类似：`🟢Claude 42R|1.2MT|$2.45(12%)`