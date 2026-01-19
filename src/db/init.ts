/**
 * G1.3 数据库初始化
 * 创建 SQLite 数据库并初始化所有表
 */

import { Database } from 'bun:sqlite';
import * as path from 'path';
import { schema } from './schema';
import { getTrackingMode } from '../utils/git-detector';

export type K2DDatabase = Database;

/**
 * 初始化数据库
 * @param metaPath meta 目录路径
 * @returns 数据库实例
 */
export async function initializeDatabase(metaPath: string): Promise<K2DDatabase> {
  const dbPath = path.join(metaPath, 'k2d.db');
  const db = new Database(dbPath);

  // 执行 schema
  db.exec(schema);

  // 获取追踪模式
  const projectPath = path.dirname(metaPath);
  const trackingMode = await getTrackingMode(projectPath);

  // 写入初始配置
  const insertConfig = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  insertConfig.run('tracking_mode', trackingMode);
  insertConfig.run('initialized_at', new Date().toISOString());
  insertConfig.run('version', '1.0.0');

  return db;
}

/**
 * 打开已有数据库
 * @param metaPath meta 目录路径
 * @returns 数据库实例或 null
 */
export function openDatabase(metaPath: string): K2DDatabase | null {
  const dbPath = path.join(metaPath, 'k2d.db');
  try {
    return new Database(dbPath);
  } catch {
    return null;
  }
}

/**
 * 获取配置值
 */
export function getConfig(db: K2DDatabase, key: string): string | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * 设置配置值
 */
export function setConfig(db: K2DDatabase, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
}

/**
 * 获取所有表名
 */
export function getAllTables(db: K2DDatabase): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  return rows.map((r) => r.name);
}
