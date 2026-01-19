/**
 * G1.3 数据库初始化测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initializeDatabase, openDatabase, getConfig, getAllTables } from './init';
import { requiredTables } from './schema';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('G1.3 数据库初始化', () => {
  let tempDir: string;
  let metaPath: string;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `k2d-test-db-${Date.now()}`);
    metaPath = path.join(tempDir, 'meta');
    fs.mkdirSync(metaPath, { recursive: true });
  });

  afterAll(async () => {
    // 等待数据库文件释放 (Windows 特有问题)
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // 忽略清理错误
    }
  });

  describe('initializeDatabase', () => {
    it('should create k2d.db file', async () => {
      const db = await initializeDatabase(metaPath);
      db.close();

      expect(fs.existsSync(path.join(metaPath, 'k2d.db'))).toBe(true);
    });

    it('should create all required tables', async () => {
      const db = await initializeDatabase(metaPath);
      const tables = getAllTables(db);
      db.close();

      for (const table of requiredTables) {
        expect(tables).toContain(table);
      }
    });

    it('should write tracking_mode to config table', async () => {
      const db = await initializeDatabase(metaPath);
      const trackingMode = getConfig(db, 'tracking_mode');
      db.close();

      expect(trackingMode).not.toBeNull();
      expect(['git', 'snapshot']).toContain(trackingMode as string);
    });

    it('should write initialized_at to config table', async () => {
      const db = await initializeDatabase(metaPath);
      const initializedAt = getConfig(db, 'initialized_at');
      db.close();

      expect(initializedAt).not.toBeNull();
      // 验证是有效的 ISO 日期
      expect(() => new Date(initializedAt!)).not.toThrow();
    });

    it('should write version to config table', async () => {
      const db = await initializeDatabase(metaPath);
      const version = getConfig(db, 'version');
      db.close();

      expect(version).toBe('1.0.0');
    });
  });

  describe('openDatabase', () => {
    it('should open existing database', async () => {
      const initDb = await initializeDatabase(metaPath);
      initDb.close();

      const db = openDatabase(metaPath);
      expect(db).not.toBeNull();
      db?.close();
    });

    it('should return null for non-existent database', () => {
      const db = openDatabase(path.join(tempDir, 'nonexistent'));
      expect(db).toBeNull();
    });
  });

  describe('database schema', () => {
    it('should have proper indexes', async () => {
      const db = await initializeDatabase(metaPath);
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
        .all() as { name: string }[];
      db.close();

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain('idx_turns_session');
      expect(indexNames).toContain('idx_tool_calls_turn');
      expect(indexNames).toContain('idx_file_changes_turn');
    });
  });
});
