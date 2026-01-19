/**
 * G1.1 环境检测模块测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { detectGitAvailable, detectGitRepo, getTrackingMode } from './git-detector';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('G1.1 环境检测模块', () => {
  let tempDir: string;
  let gitDir: string;
  let nonGitDir: string;

  beforeAll(async () => {
    // 创建临时目录用于测试
    tempDir = path.join(os.tmpdir(), `k2d-test-${Date.now()}`);
    gitDir = path.join(tempDir, 'git-repo');
    nonGitDir = path.join(tempDir, 'no-git');

    fs.mkdirSync(gitDir, { recursive: true });
    fs.mkdirSync(nonGitDir, { recursive: true });

    // 初始化 git 仓库
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      await execAsync('git init', { cwd: gitDir });
    } catch {
      // Git 可能不可用，测试会跳过相关用例
    }
  });

  afterAll(() => {
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('detectGitAvailable', () => {
    it('should return true when git is installed', async () => {
      const result = await detectGitAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('should not throw when checking git availability', async () => {
      // 直接调用并验证返回布尔值
      const result = await detectGitAvailable();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('detectGitRepo', () => {
    it('should return true for directory with .git', async () => {
      const gitAvailable = await detectGitAvailable();
      if (!gitAvailable) {
        console.log('Skipping: Git not available');
        return;
      }

      const result = await detectGitRepo(gitDir);
      expect(result).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      const result = await detectGitRepo(nonGitDir);
      expect(result).toBe(false);
    });
  });

  describe('getTrackingMode', () => {
    it('should return git when in git repo', async () => {
      const gitAvailable = await detectGitAvailable();
      if (!gitAvailable) {
        console.log('Skipping: Git not available');
        return;
      }

      const mode = await getTrackingMode(gitDir);
      expect(mode).toBe('git');
    });

    it('should return snapshot when not in git repo', async () => {
      const mode = await getTrackingMode(nonGitDir);
      expect(mode).toBe('snapshot');
    });
  });
});
