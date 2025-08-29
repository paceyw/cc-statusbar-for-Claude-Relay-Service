#!/usr/bin/env node

/**
 * 全局Claude Code配置工具
 * 用于手动配置或重新配置全局设置
 */

const { setupGlobalConfig } = require('./postinstall');

console.log('🔧 配置全局Claude Code设置...');
const success = setupGlobalConfig();

if (success) {
    console.log('✅ 全局配置完成！');
    console.log('💡 请重启Claude Code使配置生效');
} else {
    console.log('❌ 配置失败，请检查权限或手动配置');
    process.exit(1);
}