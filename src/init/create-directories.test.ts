/**
 * G1.2 目录结构创建测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initializeMetaDirectory, isMetaInitialized, getRequiredDirs } from './create-directories';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('G1.2 目录结构创建', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `k2d-test-dirs-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('initializeMetaDirectory', () => {
    it('should create all required directories', async () => {
      const projectPath = path.join(tempDir, 'project1');
      fs.mkdirSync(projectPath, { recursive: true });

      await initializeMetaDirectory(projectPath);

      const dirs = getRequiredDirs();
      for (const dir of dirs) {
        const fullPath = path.join(projectPath, dir);
        expect(fs.existsSync(fullPath)).toBe(true);
        expect(fs.statSync(fullPath).isDirectory()).toBe(true);
      }
    });

    it('should be idempotent', async () => {
      const projectPath = path.join(tempDir, 'project2');
      fs.mkdirSync(projectPath, { recursive: true });

      // 调用两次不应抛出错误
      await initializeMetaDirectory(projectPath);
      // 第二次调用应该成功完成
      await initializeMetaDirectory(projectPath);
      // 验证目录仍然存在
      expect(fs.existsSync(path.join(projectPath, 'meta'))).toBe(true);
    });

    it('should create nested pattern directories', async () => {
      const projectPath = path.join(tempDir, 'project3');
      fs.mkdirSync(projectPath, { recursive: true });

      await initializeMetaDirectory(projectPath);

      expect(fs.existsSync(path.join(projectPath, 'meta/patterns/workflows'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'meta/patterns/skill-tactics'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'meta/patterns/tool-combos'))).toBe(true);
    });

    it('should create nested assets directories', async () => {
      const projectPath = path.join(tempDir, 'project4');
      fs.mkdirSync(projectPath, { recursive: true });

      await initializeMetaDirectory(projectPath);

      expect(fs.existsSync(path.join(projectPath, 'meta/assets/rules'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'meta/assets/templates'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'meta/assets/skill-packs'))).toBe(true);
    });
  });

  describe('isMetaInitialized', () => {
    it('should return true when meta directory exists', async () => {
      const projectPath = path.join(tempDir, 'project5');
      fs.mkdirSync(projectPath, { recursive: true });
      await initializeMetaDirectory(projectPath);

      const result = await isMetaInitialized(projectPath);
      expect(result).toBe(true);
    });

    it('should return false when meta directory does not exist', async () => {
      const projectPath = path.join(tempDir, 'project6');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await isMetaInitialized(projectPath);
      expect(result).toBe(false);
    });
  });
});
