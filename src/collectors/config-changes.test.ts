/**
 * G2.4 配置变更采集测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { collectClaudeConfig, detectConfigChanges, ConfigSnapshot } from './config-changes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('G2.4 配置变更采集', () => {
  let tempDir: string;
  let projectDir: string;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `k2d-test-config-${Date.now()}`);
    projectDir = path.join(tempDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');

    // 创建目录结构
    fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'skills', 'test-skill'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'plugins', 'test-plugin', '.claude-plugin'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'rules'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'commands'), { recursive: true });

    // 创建配置文件
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{"test": true}');
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), '# Claude Instructions');
    fs.writeFileSync(path.join(claudeDir, 'agents', 'test-agent.md'), '# Test Agent');
    fs.writeFileSync(path.join(claudeDir, 'skills', 'test-skill', 'SKILL.md'), '# Test Skill');
    fs.writeFileSync(
      path.join(claudeDir, 'plugins', 'test-plugin', '.claude-plugin', 'plugin.json'),
      '{"name": "test"}'
    );
    fs.writeFileSync(path.join(claudeDir, 'rules', 'test-rule.md'), '# Test Rule');
    fs.writeFileSync(path.join(claudeDir, 'commands', 'test-cmd.md'), '# Test Command');
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('collectClaudeConfig', () => {
    it('should collect all config types', async () => {
      const config = await collectClaudeConfig(projectDir);

      expect(config).toHaveProperty('settings_json');
      expect(config).toHaveProperty('claude_md');
      expect(config).toHaveProperty('agents_list');
      expect(config).toHaveProperty('skills_list');
      expect(config).toHaveProperty('plugins_list');
      expect(config).toHaveProperty('rules_list');
      expect(config).toHaveProperty('commands_list');
    });

    it('should read settings.json content', async () => {
      const config = await collectClaudeConfig(projectDir);
      expect(config.settings_json).toBe('{"test": true}');
    });

    it('should read CLAUDE.md content', async () => {
      const config = await collectClaudeConfig(projectDir);
      expect(config.claude_md).toBe('# Claude Instructions');
    });

    it('should list agents', async () => {
      const config = await collectClaudeConfig(projectDir);
      expect(config.agents_list).toContain('test-agent');
    });

    it('should list skills', async () => {
      const config = await collectClaudeConfig(projectDir);
      expect(config.skills_list).toContain('test-skill');
    });

    it('should list plugins', async () => {
      const config = await collectClaudeConfig(projectDir);
      expect(config.plugins_list).toContain('test-plugin');
    });

    it('should list rules', async () => {
      const config = await collectClaudeConfig(projectDir);
      expect(config.rules_list).toContain('test-rule');
    });

    it('should list commands', async () => {
      const config = await collectClaudeConfig(projectDir);
      expect(config.commands_list).toContain('test-cmd');
    });
  });

  describe('detectConfigChanges', () => {
    it('should detect skill added', () => {
      const oldConfig: ConfigSnapshot = {
        settings_json: null,
        settings_local_json: null,
        claude_md: null,
        mcp_json: null,
        lsp_json: null,
        agents_list: [],
        skills_list: ['a'],
        plugins_list: [],
        rules_list: [],
        commands_list: [],
      };
      const newConfig: ConfigSnapshot = {
        ...oldConfig,
        skills_list: ['a', 'b'],
      };

      const changes = detectConfigChanges(oldConfig, newConfig);
      expect(changes).toContainEqual(
        expect.objectContaining({
          config_type: 'skill',
          item_name: 'b',
          change_type: 'A',
        })
      );
    });

    it('should detect skill removed', () => {
      const oldConfig: ConfigSnapshot = {
        settings_json: null,
        settings_local_json: null,
        claude_md: null,
        mcp_json: null,
        lsp_json: null,
        agents_list: [],
        skills_list: ['a', 'b'],
        plugins_list: [],
        rules_list: [],
        commands_list: [],
      };
      const newConfig: ConfigSnapshot = {
        ...oldConfig,
        skills_list: ['a'],
      };

      const changes = detectConfigChanges(oldConfig, newConfig);
      expect(changes).toContainEqual(
        expect.objectContaining({
          config_type: 'skill',
          item_name: 'b',
          change_type: 'D',
        })
      );
    });

    it('should detect CLAUDE.md modified', () => {
      const oldConfig: ConfigSnapshot = {
        settings_json: null,
        settings_local_json: null,
        claude_md: 'old content',
        mcp_json: null,
        lsp_json: null,
        agents_list: [],
        skills_list: [],
        plugins_list: [],
        rules_list: [],
        commands_list: [],
      };
      const newConfig: ConfigSnapshot = {
        ...oldConfig,
        claude_md: 'new content',
      };

      const changes = detectConfigChanges(oldConfig, newConfig);
      expect(changes).toContainEqual(
        expect.objectContaining({
          config_type: 'claude_md',
          change_type: 'M',
        })
      );
    });

    it('should detect agent added', () => {
      const oldConfig: ConfigSnapshot = {
        settings_json: null,
        settings_local_json: null,
        claude_md: null,
        mcp_json: null,
        lsp_json: null,
        agents_list: [],
        skills_list: [],
        plugins_list: [],
        rules_list: [],
        commands_list: [],
      };
      const newConfig: ConfigSnapshot = {
        ...oldConfig,
        agents_list: ['new-agent'],
      };

      const changes = detectConfigChanges(oldConfig, newConfig);
      expect(changes).toContainEqual(
        expect.objectContaining({
          config_type: 'agent',
          item_name: 'new-agent',
          change_type: 'A',
        })
      );
    });
  });
});
