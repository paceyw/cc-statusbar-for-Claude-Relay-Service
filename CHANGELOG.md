# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-08-28

### Added
- 🎉 首次发布Claude Code StatusBar插件
- ✨ 支持实时监控中转API服务器用量统计
- 🔍 自动解析动态加载的Vue.js管理页面
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
- Node.js >= 14.0.0
- 使用Puppeteer进行网页抓取
- Cheerio用于HTML解析
- 支持多种数据格式和单位转换
- 完整的错误处理和重试机制

## [Unreleased]

### Planned
- 📈 历史趋势图表支持
- ⚙️ 更多自定义配置选项
- 📱 移动设备适配
- 🔔 使用量告警功能
- 🌍 多语言支持