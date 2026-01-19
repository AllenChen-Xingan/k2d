/**
 * G2.3 文件变更采集
 * 使用 Git 或快照模式采集文件变更
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';

const execAsync = promisify(exec);

export interface FileChange {
  file_path: string;
  change_type: 'A' | 'M' | 'D';
  diff_content: string | null;
  commit_hash: string | null;
  old_hash: string | null;
  new_hash: string | null;
}

export interface Snapshot {
  files: Record<string, { hash: string; size: number }>;
  timestamp: string;
}

export interface SnapshotDiff {
  added: string[];
  modified: string[];
  deleted: string[];
}

// =====================
// Git 模式
// =====================

/**
 * 解析 git status 输出
 */
export function parseGitStatus(output: string): { path: string; type: 'A' | 'M' | 'D' }[] {
  const changes: { path: string; type: 'A' | 'M' | 'D' }[] = [];
  // 只移除末尾空白，保留每行开头的空格（git status 格式依赖它）
  const lines = output.trimEnd().split('\n').filter((line) => line.length >= 3);

  for (const line of lines) {
    // git status --porcelain 格式: XY filename (XY 是两个字符状态码，第三个是空格，后面是文件名)
    const status = line.slice(0, 2);
    let filePath = line.slice(3).trim();

    // 处理重命名: R  old -> new
    if (filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ')[1];
    }

    if (status.includes('?') || status.includes('A')) {
      changes.push({ path: filePath, type: 'A' });
    } else if (status.includes('D')) {
      changes.push({ path: filePath, type: 'D' });
    } else if (status.includes('M') || status.includes('R') || status.includes('C')) {
      changes.push({ path: filePath, type: 'M' });
    }
  }

  return changes;
}

/**
 * 使用 Git 采集文件变更
 */
export async function collectGitChanges(cwd: string): Promise<FileChange[]> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd });
    const statusChanges = parseGitStatus(stdout);

    const changes: FileChange[] = [];
    for (const { path: filePath, type } of statusChanges) {
      let diffContent: string | null = null;

      if (type !== 'D') {
        try {
          const { stdout: diff } = await execAsync(`git diff HEAD -- "${filePath}"`, { cwd });
          diffContent = diff || null;

          // 如果是新文件，diff 可能为空，尝试获取文件内容
          if (!diffContent && type === 'A') {
            const { stdout: content } = await execAsync(`git diff --cached -- "${filePath}"`, { cwd });
            diffContent = content || null;
          }
        } catch {
          // 忽略 diff 错误
        }
      }

      // 获取当前 commit hash
      let commitHash: string | null = null;
      try {
        const { stdout: hash } = await execAsync('git rev-parse HEAD', { cwd });
        commitHash = hash.trim();
      } catch {
        // 忽略
      }

      changes.push({
        file_path: filePath,
        change_type: type,
        diff_content: diffContent,
        commit_hash: commitHash,
        old_hash: null,
        new_hash: null,
      });
    }

    return changes;
  } catch (error) {
    console.error('Git changes collection failed:', error);
    return [];
  }
}

// =====================
// 快照模式
// =====================

const IGNORE_PATTERNS = ['**/node_modules/**', '**/.git/**', '**/meta/snapshots/**', '**/dist/**', '**/.next/**'];

/**
 * 计算文件哈希
 */
async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 创建文件树快照
 */
export async function createSnapshot(projectPath: string): Promise<Snapshot> {
  const files: Record<string, { hash: string; size: number }> = {};

  const allFiles = await glob('**/*', {
    cwd: projectPath,
    nodir: true,
    ignore: IGNORE_PATTERNS,
    dot: true,
  });

  for (const file of allFiles) {
    const fullPath = path.join(projectPath, file);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        const hash = await computeFileHash(fullPath);
        files[file] = {
          hash,
          size: stat.size,
        };
      }
    } catch {
      // 跳过无法读取的文件
    }
  }

  return {
    files,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 比较两个快照的差异
 */
export function diffSnapshots(oldSnap: Snapshot | null, newSnap: Snapshot): SnapshotDiff {
  if (!oldSnap) {
    return {
      added: Object.keys(newSnap.files),
      modified: [],
      deleted: [],
    };
  }

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  // 检查新增和修改
  for (const [filePath, info] of Object.entries(newSnap.files)) {
    if (!oldSnap.files[filePath]) {
      added.push(filePath);
    } else if (oldSnap.files[filePath].hash !== info.hash) {
      modified.push(filePath);
    }
  }

  // 检查删除
  for (const filePath of Object.keys(oldSnap.files)) {
    if (!newSnap.files[filePath]) {
      deleted.push(filePath);
    }
  }

  return { added, modified, deleted };
}

/**
 * 从快照差异生成 FileChange 列表
 */
export function snapshotDiffToChanges(
  diff: SnapshotDiff,
  oldSnap: Snapshot | null,
  newSnap: Snapshot
): FileChange[] {
  const changes: FileChange[] = [];

  for (const filePath of diff.added) {
    changes.push({
      file_path: filePath,
      change_type: 'A',
      diff_content: null,
      commit_hash: null,
      old_hash: null,
      new_hash: newSnap.files[filePath]?.hash || null,
    });
  }

  for (const filePath of diff.modified) {
    changes.push({
      file_path: filePath,
      change_type: 'M',
      diff_content: null,
      commit_hash: null,
      old_hash: oldSnap?.files[filePath]?.hash || null,
      new_hash: newSnap.files[filePath]?.hash || null,
    });
  }

  for (const filePath of diff.deleted) {
    changes.push({
      file_path: filePath,
      change_type: 'D',
      diff_content: null,
      commit_hash: null,
      old_hash: oldSnap?.files[filePath]?.hash || null,
      new_hash: null,
    });
  }

  return changes;
}

/**
 * 保存快照到文件
 */
export async function saveSnapshot(metaPath: string, snapshot: Snapshot): Promise<string> {
  const snapshotsDir = path.join(metaPath, 'snapshots');
  await fs.mkdir(snapshotsDir, { recursive: true });

  const filename = `snapshot-${Date.now()}.json`;
  const filePath = path.join(snapshotsDir, filename);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2));

  return filePath;
}

/**
 * 加载最新快照
 */
export async function loadLatestSnapshot(metaPath: string): Promise<Snapshot | null> {
  const snapshotsDir = path.join(metaPath, 'snapshots');

  try {
    const files = await fs.readdir(snapshotsDir);
    const snapshotFiles = files.filter((f) => f.startsWith('snapshot-') && f.endsWith('.json')).sort().reverse();

    if (snapshotFiles.length === 0) return null;

    const latestPath = path.join(snapshotsDir, snapshotFiles[0]);
    const content = await fs.readFile(latestPath, 'utf-8');
    return JSON.parse(content) as Snapshot;
  } catch {
    return null;
  }
}
