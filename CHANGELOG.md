# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-08-28

### Added
- 🎉 首次发布Claude Code StatusBar插件
- ✨ 支持实时监控中转API服务器用量统计
- 🔍 自动解析管理页面（HTTP+DOM，无需Chromium）
- 📊 显示请求数、Token消耗、费用和使用率
- ⚡ 支持缓存和离线模式
- 🔧 支持全局npm安装和配置
- 🌐 跨平台支持 (Windows, macOS, Linux)
- 📝 自动配置Claude Code全局设置

### Features
- **数据监控**: 实时获取API使用统计
- **智能解析**: 多策略HTML数据提取
- **缓存机制**: 网络故障时使用缓存数据
- **状态栏显示**: 简洁的状态栏格式输出
- **全局安装**: 支持npm全局安装
- **自动配置**: 安装后自动配置Claude Code

### Technical Details
- Node.js >= 18.17.0
- 使用 AdminHtmlProvider（axios + cheerio）进行 HTTP 抓取与 DOM 解析
- 支持多种数据格式和单位转换
- 完整的错误处理和重试机制

## [1.0.1] - 2025-08-30

### Fixed
- 🔧 修复Claude Code状态栏集成配置问题
- 🖥️ 更新`.claude/settings.json`使用正确的Node.js命令调用
- 📋 修复状态栏输出格式，使用带空格的分隔符格式
- ⏱️ 优化数字格式化显示（Token使用M/K后缀，去除不必要小数位）

### Changed  
- 📊 状态栏显示格式改为：`🟢 | 56 Requests | 2M Tokens | $1.51(1.5%) | 到期：2025/09/21 01:08 | 更新：13:03`
- ⌚ 默认更新间隔改为60秒（60000ms）
- 📅 日期格式统一为 `YYYY/MM/DD HH:MM`

### Removed
- 🗑️ 清理无用文件和开发工具相关目录
- 🚮 删除包含用户隐私数据的临时JSON文件
- 🧹 移除未使用的UI组件和PowerShell脚本

### Security
- 🔒 更新.gitignore，防止意外提交敏感数据文件

## [1.0.2] - 2025-08-30

### Fixed
- 🔧 **重要修复**：修复bin/cc-statusbar.js中相对路径引用问题
- 🛠️ 使用绝对路径引用模块，确保全局tgz安装后正常工作
- 📦 修复`require('../admin-html-provider')`和`require('../scripts/postinstall')`路径问题

### Technical Details
- bin脚本现在使用`path.join(moduleDir, ...)`而不是相对路径`../`
- 确保npm全局安装后所有功能正常工作
- 通过完整的tgz安装测试验证

## [2.0.2] - 2025-08-30

### Changed
- 📦 **版本升级**：插件版本更新至v2.0.2
- 🔄 重新打包和发布更新

### Technical Details
- 所有文档和配置文件中的版本号统一更新至2.0.2
- 完整测试通过，确保功能稳定性

## [2.0.3] - 2025-08-30

### Security
- 🔒 **隐私增强**：清除代码中的个人信息，替换为通用信息
- 🛡️ 更新作者信息为"Claude Code Statusbar Contributors"
- 📧 将联系邮箱更新为通用邮箱地址

### Added
- 📦 **安装优化**：新增NPM全局安装方式作为首选安装方法
- ✨ 更新README文档，添加`npm i -g claude-code-statusbar`安装指令

### Changed
- 📋 重新整理安装方式，NPM安装作为推荐方式
- 📝 更新文档中的版本号引用至2.0.3

## [Unreleased]

### Planned
- 📈 历史趋势图表支持
- ⚙️ 更多自定义配置选项
- 📱 移动设备适配
- 🔔 使用量告警功能
- 🌍 多语言支持