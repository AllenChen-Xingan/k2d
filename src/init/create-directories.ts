/**
 * G1.2 目录结构创建
 * 创建 meta/ 目录及所有子目录
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const REQUIRED_DIRS = [
  'meta',
  'meta/snapshots',
  'meta/patterns',
  'meta/patterns/workflows',
  'meta/patterns/skill-tactics',
  'meta/patterns/tool-combos',
  'meta/assets',
  'meta/assets/rules',
  'meta/assets/templates',
  'meta/assets/skill-packs',
  'meta/reports',
  'meta/references',
];

/**
 * 创建 meta/ 目录及所有子目录
 * 幂等操作 - 多次调用不会报错
 */
export async function initializeMetaDirectory(projectPath: string): Promise<void> {
  for (const dir of REQUIRED_DIRS) {
    const fullPath = path.join(projectPath, dir);
    await fs.mkdir(fullPath, { recursive: true });
  }
}

/**
 * 检查 meta 目录是否已初始化
 */
export async function isMetaInitialized(projectPath: string): Promise<boolean> {
  const metaPath = path.join(projectPath, 'meta');
  try {
    const stat = await fs.stat(metaPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 获取所需目录列表
 */
export function getRequiredDirs(): string[] {
  return [...REQUIRED_DIRS];
}
