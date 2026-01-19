/**
 * G1.1 环境检测模块
 * 检测 Git 可用性，决定文件追踪模式
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * G1.1.1 检测 Git 命令是否可用
 */
export async function detectGitAvailable(): Promise<boolean> {
  try {
    await execAsync('git --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * G1.1.2 检测当前目录是否为 Git 仓库
 */
export async function detectGitRepo(cwd: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * G1.1.3 确定追踪模式
 */
export async function getTrackingMode(projectPath: string): Promise<'git' | 'snapshot'> {
  const gitAvailable = await detectGitAvailable();
  if (!gitAvailable) return 'snapshot';

  const isGitRepo = await detectGitRepo(projectPath);
  return isGitRepo ? 'git' : 'snapshot';
}
