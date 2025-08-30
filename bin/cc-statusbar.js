#!/usr/bin/env node

/**
 * Claude Code StatusBar - 全局可执行文件（增强版 CLI）
 * 支持子命令：
 *   - configure: 写入/合并全局配置
 *   - repair:    强制重写配置（自修复）
 *   - doctor:    环境体检（Node/配置/可达性）
 *   - uninstall: 备份并移除 statusLine 配置
 * 无子命令：透传运行 statusline.js（保持向后兼容）
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const moduleDir = path.resolve(__dirname, '..');
const AdminHtmlProvider = require(path.join(moduleDir, 'admin-html-provider'));
const { setupGlobalConfig } = require(path.join(moduleDir, 'scripts', 'postinstall'));
const statuslineScript = path.join(moduleDir, 'statusline.js');

function printHelp() {
  console.log(`
用法: cc-statusbar [子命令] [选项]

子命令:
  configure        写入/更新 ~/.claude/settings.json 的 statusLine 强韧配置
    选项:
      --maxlen <n>     指定 CC_STATUS_MAXLEN（默认 120）
      --scrape <url>   指定 CC_SCRAPE_URL（如 https://host:port/admin-next/api-stats?apiId=xxx）
      --force          强制覆盖 statusLine 字段

  repair           快速自修复（等同 configure --force）

  doctor           环境体检（Node 版本、配置完整性、抓取 URL 可达性）

  uninstall        备份并移除 ~/.claude/settings.json 中的 statusLine

无子命令:
  直接运行状态栏脚本（向后兼容旧行为）
`);
}

function runStatuslinePassthrough(args) {
  const child = spawn(process.execPath, [statuslineScript, ...args], {
    stdio: 'inherit',
    cwd: moduleDir
  });
  child.on('exit', (code) => process.exit(code));
  child.on('error', (err) => {
    console.error('启动 statusline 失败:', err.message);
    process.exit(1);
  });
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--maxlen' && i + 1 < argv.length) { out.maxlen = argv[++i]; continue; }
    if (a === '--scrape' && i + 1 < argv.length) { out.scrape = argv[++i]; continue; }
    if (a === '--force') { out.force = true; continue; }
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    out._.push(a);
  }
  return out;
}

function getClaudeSettingsPath() {
  const claudeDir = path.join(os.homedir(), '.claude');
  return path.join(claudeDir, 'settings.json');
}

function ensureBackup(filePath) {
  const dir = path.dirname(filePath);
  const backupDir = path.join(dir, '.backup');
  try { fs.mkdirSync(backupDir, { recursive: true }); } catch {}
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `settings.${stamp}.json`);
  try { fs.copyFileSync(filePath, backupPath); } catch {}
  return backupPath;
}

async function runDoctor() {
  const issues = [];
  const info = [];

  // 1) Node 版本
  const nodeVersion = process.versions.node;
  info.push(`Node 版本: ${nodeVersion}`);
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (!isFinite(major) || major < 18) {
    issues.push('Node 版本建议 >= 18');
  }

  // 2) 配置完整性
  const settingsPath = getClaudeSettingsPath();
  info.push(`设置文件: ${settingsPath}`);
  let settings = {};
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
      info.push('settings.json: 加载成功');
    } else {
      issues.push('settings.json: 文件不存在（尚未配置？可运行 cc-statusbar configure）');
    }
  } catch (e) {
    issues.push(`settings.json: 解析失败 ${e.message}`);
  }

  const sl = settings.statusLine || {};
  if (!sl.command || !sl.args || !Array.isArray(sl.args) || sl.args.length === 0) {
    issues.push('statusLine: 缺少 command 或 args 配置');
  } else {
    info.push(`statusLine.command: ${sl.command}`);
    info.push(`statusLine.args[0]: ${sl.args[0]}`);
    if (!fs.existsSync(sl.command)) issues.push('statusLine.command 不存在（可能 Node 绝对路径失效）');
    if (!fs.existsSync(sl.args[0])) issues.push('statusLine.args[0] 不存在（statusline.js 路径失效）');
  }
  if (sl.workingDirectory) {
    info.push(`workingDirectory: ${sl.workingDirectory}`);
    if (!fs.existsSync(sl.workingDirectory)) issues.push('workingDirectory 不存在');
  }

  // 3) CC_SCRAPE_URL 可达性
  const env = (sl.env || {});
  const scrapeUrl = process.env.CC_SCRAPE_URL || env.CC_SCRAPE_URL;
  if (!scrapeUrl) {
    issues.push('未发现 CC_SCRAPE_URL（可配置到 ~/.claude/settings.json -> statusLine.env 或环境变量）');
  } else {
    info.push(`CC_SCRAPE_URL: ${scrapeUrl}`);
    try {
      const provider = new AdminHtmlProvider({ cacheTTLms: 5_000 });
      const dto = await provider.fetchAndParse(scrapeUrl, { timeout: 6_000, retryAttempts: 2 });
      if (dto && typeof dto === 'object') {
        const req = dto.requestCount ?? 0;
        const tok = dto.tokenCount ?? 0;
        const cost = dto.todayCost ?? 0;
        info.push(`抓取成功: requests=${req}, tokens=${tok}, cost=${cost}`);
      } else {
        issues.push('抓取成功但返回体异常');
      }
    } catch (e) {
      issues.push(`抓取失败: ${e.message}`);
    }
  }

  // 输出报告
  console.log('📋 Doctor 报告');
  console.log('========================================');
  for (const line of info) console.log('✅', line);
  for (const line of issues) console.log('❌', line);
  console.log('========================================');
  if (issues.length === 0) {
    console.log('🎉 体检通过');
    process.exit(0);
  } else {
    console.log(`⚠️  发现 ${issues.length} 个问题，可尝试 cc-statusbar repair`);
    process.exit(1);
  }
}

function runConfigure({ maxlen, scrape, force }) {
  const opts = {};
  if (maxlen) opts.maxlen = maxlen;
  if (scrape) opts.scrapeUrl = scrape;
  if (force) opts.force = true;
  const ok = setupGlobalConfig(opts);
  if (!ok) process.exit(1);
}

function runUninstall() {
  const settingsPath = getClaudeSettingsPath();
  try {
    if (!fs.existsSync(settingsPath)) {
      console.log('ℹ️ 未找到 settings.json，无需卸载');
      return;
    }
    const backupPath = ensureBackup(settingsPath);
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
    if (settings.statusLine) {
      delete settings.statusLine;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('✅ 已移除 statusLine 配置');
      console.log('📦 备份文件:', backupPath);
    } else {
      console.log('ℹ️ settings.json 中无 statusLine 字段');
    }
  } catch (e) {
    console.error('❌ 卸载失败:', e.message);
    process.exit(1);
  }
}

(async function main() {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  const [sub] = parsed._;

  if (parsed.help || sub === 'help' || sub === '--help' || sub === '-h') {
    printHelp();
    return;
  }

  switch (sub) {
    case 'configure':
      runConfigure({ maxlen: parsed.maxlen, scrape: parsed.scrape, force: parsed.force });
      break;
    case 'repair':
      runConfigure({ maxlen: parsed.maxlen, scrape: parsed.scrape, force: true });
      break;
    case 'doctor':
      await runDoctor();
      break;
    case 'uninstall':
      runUninstall();
      break;
    case undefined:
      // 向后兼容：无子命令时透传运行状态栏
      runStatuslinePassthrough(argv);
      break;
    default:
      console.log(`未知命令: ${sub}`);
      printHelp();
      process.exit(1);
  }
})();