/**
 * G2.4 配置变更采集
 * 追踪 .claude/ 目录下所有配置文件的变更
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export interface ConfigSnapshot {
  settings_json: string | null;
  settings_local_json: string | null;
  claude_md: string | null;
  mcp_json: string | null;
  lsp_json: string | null;
  agents_list: string[];
  skills_list: string[];
  plugins_list: string[];
  rules_list: string[];
  commands_list: string[];
}

export interface ConfigChange {
  config_type: string;
  item_name: string | null;
  change_type: 'A' | 'M' | 'D';
  before_value: string | null;
  after_value: string | null;
  diff_summary: string | null;
}

/**
 * 安全读取文件内容
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * 获取目录中的文件列表
 */
async function listFiles(dirPath: string, pattern: string): Promise<string[]> {
  try {
    const files = await glob(pattern, { cwd: dirPath });
    return files.map((f) => path.basename(f, path.extname(f)));
  } catch {
    return [];
  }
}

/**
 * 收集 Claude 配置快照
 */
export async function collectClaudeConfig(projectPath: string): Promise<ConfigSnapshot> {
  const claudeDir = path.join(projectPath, '.claude');

  // 读取各个配置文件
  const [settingsJson, settingsLocalJson, claudeMdRoot, claudeMdClaude, mcpJson, lspJson] = await Promise.all([
    safeReadFile(path.join(claudeDir, 'settings.json')),
    safeReadFile(path.join(claudeDir, 'settings.local.json')),
    safeReadFile(path.join(projectPath, 'CLAUDE.md')),
    safeReadFile(path.join(claudeDir, 'CLAUDE.md')),
    safeReadFile(path.join(claudeDir, '.mcp.json')),
    safeReadFile(path.join(claudeDir, 'lsp.json')),
  ]);

  // 获取各个目录的列表
  const [agentsList, skillsList, pluginsList, rulesList, commandsList] = await Promise.all([
    listFiles(path.join(claudeDir, 'agents'), '*.md'),
    listSkills(claudeDir),
    listPlugins(claudeDir),
    listFiles(path.join(claudeDir, 'rules'), '*.md'),
    listFiles(path.join(claudeDir, 'commands'), '*.md'),
  ]);

  return {
    settings_json: settingsJson,
    settings_local_json: settingsLocalJson,
    claude_md: claudeMdRoot || claudeMdClaude,
    mcp_json: mcpJson,
    lsp_json: lspJson,
    agents_list: agentsList,
    skills_list: skillsList,
    plugins_list: pluginsList,
    rules_list: rulesList,
    commands_list: commandsList,
  };
}

/**
 * 列出所有 skills
 */
async function listSkills(claudeDir: string): Promise<string[]> {
  const skillsDir = path.join(claudeDir, 'skills');
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
        try {
          await fs.access(skillMd);
          skills.push(entry.name);
        } catch {
          // 没有 SKILL.md 的目录不是有效 skill
        }
      }
    }

    return skills;
  } catch {
    return [];
  }
}

/**
 * 列出所有 plugins
 */
async function listPlugins(claudeDir: string): Promise<string[]> {
  const pluginsDir = path.join(claudeDir, 'plugins');
  try {
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    const plugins: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginJson = path.join(pluginsDir, entry.name, '.claude-plugin', 'plugin.json');
        try {
          await fs.access(pluginJson);
          plugins.push(entry.name);
        } catch {
          // 没有 plugin.json 的目录不是有效 plugin
        }
      }
    }

    return plugins;
  } catch {
    return [];
  }
}

/**
 * 检测配置变更
 */
export function detectConfigChanges(oldConfig: ConfigSnapshot | null, newConfig: ConfigSnapshot): ConfigChange[] {
  const changes: ConfigChange[] = [];

  if (!oldConfig) {
    // 首次采集，所有配置都是新增
    if (newConfig.settings_json) {
      changes.push({
        config_type: 'settings',
        item_name: null,
        change_type: 'A',
        before_value: null,
        after_value: newConfig.settings_json,
        diff_summary: 'settings.json created',
      });
    }
    // ... 可以添加更多首次创建的记录
    return changes;
  }

  // 检查文件内容变更
  if (oldConfig.settings_json !== newConfig.settings_json) {
    changes.push({
      config_type: 'settings',
      item_name: null,
      change_type: oldConfig.settings_json ? (newConfig.settings_json ? 'M' : 'D') : 'A',
      before_value: oldConfig.settings_json,
      after_value: newConfig.settings_json,
      diff_summary: 'settings.json modified',
    });
  }

  if (oldConfig.claude_md !== newConfig.claude_md) {
    changes.push({
      config_type: 'claude_md',
      item_name: null,
      change_type: oldConfig.claude_md ? (newConfig.claude_md ? 'M' : 'D') : 'A',
      before_value: oldConfig.claude_md,
      after_value: newConfig.claude_md,
      diff_summary: 'CLAUDE.md modified',
    });
  }

  if (oldConfig.mcp_json !== newConfig.mcp_json) {
    changes.push({
      config_type: 'mcp',
      item_name: null,
      change_type: oldConfig.mcp_json ? (newConfig.mcp_json ? 'M' : 'D') : 'A',
      before_value: oldConfig.mcp_json,
      after_value: newConfig.mcp_json,
      diff_summary: '.mcp.json modified',
    });
  }

  // 检查列表变更 (agents, skills, plugins, rules, commands)
  const listTypes: Array<{ type: string; oldList: string[]; newList: string[] }> = [
    { type: 'agent', oldList: oldConfig.agents_list, newList: newConfig.agents_list },
    { type: 'skill', oldList: oldConfig.skills_list, newList: newConfig.skills_list },
    { type: 'plugin', oldList: oldConfig.plugins_list, newList: newConfig.plugins_list },
    { type: 'rule', oldList: oldConfig.rules_list, newList: newConfig.rules_list },
    { type: 'command', oldList: oldConfig.commands_list, newList: newConfig.commands_list },
  ];

  for (const { type, oldList, newList } of listTypes) {
    // 检查新增
    for (const item of newList) {
      if (!oldList.includes(item)) {
        changes.push({
          config_type: type,
          item_name: item,
          change_type: 'A',
          before_value: null,
          after_value: item,
          diff_summary: `${type} '${item}' added`,
        });
      }
    }

    // 检查删除
    for (const item of oldList) {
      if (!newList.includes(item)) {
        changes.push({
          config_type: type,
          item_name: item,
          change_type: 'D',
          before_value: item,
          after_value: null,
          diff_summary: `${type} '${item}' removed`,
        });
      }
    }
  }

  return changes;
}

/**
 * 将 ConfigSnapshot 转换为数据库格式
 */
export function configSnapshotToDbFormat(config: ConfigSnapshot) {
  return {
    settings_json: config.settings_json,
    settings_local_json: config.settings_local_json,
    claude_md: config.claude_md,
    mcp_json: config.mcp_json,
    lsp_json: config.lsp_json,
    agents_list: JSON.stringify(config.agents_list),
    skills_list: JSON.stringify(config.skills_list),
    plugins_list: JSON.stringify(config.plugins_list),
    rules_list: JSON.stringify(config.rules_list),
    commands_list: JSON.stringify(config.commands_list),
  };
}
