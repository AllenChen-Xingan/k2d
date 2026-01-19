#!/usr/bin/env bun
/**
 * K2D Stop Hook
 * 在每轮对话结束时触发，采集数据
 *
 * 功能：
 * 1. 自动初始化数据库（如果不存在）
 * 2. 检测是否需要回溯导入历史对话
 * 3. 收集当前轮次的数据
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { initializeMetaDirectory, isMetaInitialized } from '../init/create-directories';
import { initializeDatabase, openDatabase } from '../db/init';
import { parseLatestTurn, parseFullTranscript, type TurnData } from '../collectors/transcript';
import { collectGitChanges, createSnapshot, diffSnapshots, snapshotDiffToChanges, loadLatestSnapshot, saveSnapshot } from '../collectors/file-changes';
import { collectClaudeConfig, detectConfigChanges, ConfigSnapshot } from '../collectors/config-changes';
import { inferSkillIntroductionReason } from '../extractors/skill-inference';
import { inferProjectPhase, detectPhaseTransition } from '../extractors/phase-inference';
import { createSession, saveCompleteTurnData, updateSkillLifecycle, recordPhaseTransition, getProjectPhases } from '../db/operations';
import { getConfig, setConfig } from '../db/init';
import { detectGitRepo } from '../utils/git-detector';
import type { FileChange } from '../collectors/file-changes';
import type { K2DDatabase } from '../db/init';

interface HookInput {
  stop_hook_active?: boolean;
  session_id: string;
  transcript_path: string;
}

interface HookOutput {
  skipped: boolean;
  reason?: string;
  turnId?: number;
  imported?: number;  // 回溯导入的历史轮次数
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * 检查数据库是否为空（新安装）
 */
function isDatabaseEmpty(db: K2DDatabase): boolean {
  const result = db.prepare('SELECT COUNT(*) as count FROM turns').get() as { count: number };
  return result.count === 0;
}

/**
 * 回溯导入历史对话
 */
async function importHistoricalTurns(
  db: K2DDatabase,
  transcriptPath: string,
  sessionId: string,
  projectPath: string
): Promise<number> {
  // 解析完整的对话历史
  const allTurns = await parseFullTranscript(transcriptPath);

  if (allTurns.length <= 1) {
    // 只有一轮或没有对话，不需要回溯
    return 0;
  }

  // 导入除最后一轮之外的所有历史对话（最后一轮会在正常流程中处理）
  const historicalTurns = allTurns.slice(0, -1);

  // 获取当前配置作为快照
  const configSnapshot = await collectClaudeConfig(projectPath);

  for (let i = 0; i < historicalTurns.length; i++) {
    const turnData = historicalTurns[i];
    const turnNumber = i + 1;

    // 保存历史轮次（不收集文件变更和配置变更，因为无法回溯）
    saveCompleteTurnData(db, {
      sessionId,
      turnNumber,
      turnData,
      fileChanges: [],
      configSnapshot,
      configChanges: [],
    });

    // 更新 skill lifecycle
    for (const skillUsage of turnData.skill_usages) {
      const inference = inferSkillIntroductionReason(turnData.user_message, skillUsage.skill_name);
      updateSkillLifecycle(db, skillUsage.skill_name, i + 1, inference.reason);
    }
  }

  // 更新 turn number
  setConfig(db, 'current_turn_number', historicalTurns.length.toString());

  return historicalTurns.length;
}

async function main(): Promise<void> {
  try {
    const inputText = await readStdin();
    const input: HookInput = JSON.parse(inputText);

    // 防止无限循环
    if (input.stop_hook_active) {
      const output: HookOutput = { skipped: true, reason: 'stop_hook_active' };
      console.log(JSON.stringify(output));
      return;
    }

    const projectPath = process.cwd();
    const metaPath = path.join(projectPath, 'meta');

    // 1. 自动初始化目录（如果需要）
    const wasInitialized = await isMetaInitialized(projectPath);
    if (!wasInitialized) {
      await initializeMetaDirectory(projectPath);
    }

    // 2. 获取或初始化数据库
    let db = openDatabase(metaPath);
    const isNewDatabase = !db;

    if (!db) {
      db = await initializeDatabase(metaPath);

      // 设置追踪模式
      const isGit = await detectGitRepo(projectPath);
      const trackingMode = isGit ? 'git' : 'snapshot';
      setConfig(db, 'tracking_mode', trackingMode);
      setConfig(db, 'initialized_at', new Date().toISOString());
    }

    // 3. 获取或创建 session
    let sessionId = getConfig(db, 'current_session_id');
    if (!sessionId) {
      sessionId = createSession(db, projectPath);
      setConfig(db, 'current_session_id', sessionId);
    }

    // 4. 检测是否需要回溯导入历史对话
    let importedCount = 0;
    if (isNewDatabase || isDatabaseEmpty(db)) {
      importedCount = await importHistoricalTurns(db, input.transcript_path, sessionId, projectPath);
    }

    // 5. 获取当前 turn number
    const turnCountStr = getConfig(db, 'current_turn_number') || '0';
    const turnNumber = parseInt(turnCountStr, 10) + 1;
    setConfig(db, 'current_turn_number', turnNumber.toString());

    // 6. 解析最新的 turn
    const turnData = await parseLatestTurn(input.transcript_path);

    // 7. 采集文件变更
    let fileChanges: FileChange[] = [];
    const trackingMode = getConfig(db, 'tracking_mode');

    if (trackingMode === 'git') {
      fileChanges = await collectGitChanges(projectPath);
    } else {
      // 快照模式
      const oldSnapshot = await loadLatestSnapshot(metaPath);
      const newSnapshot = await createSnapshot(projectPath);
      const diff = diffSnapshots(oldSnapshot, newSnapshot);
      fileChanges = snapshotDiffToChanges(diff, oldSnapshot, newSnapshot);
      await saveSnapshot(metaPath, newSnapshot);
    }

    // 8. 采集配置变更
    const newConfig = await collectClaudeConfig(projectPath);
    const lastConfigJson = getConfig(db, 'last_config_snapshot');
    let lastConfig: ConfigSnapshot | null = null;
    if (lastConfigJson) {
      try {
        lastConfig = JSON.parse(lastConfigJson);
      } catch {
        // 忽略解析错误
      }
    }
    const configChanges = detectConfigChanges(lastConfig, newConfig);
    setConfig(db, 'last_config_snapshot', JSON.stringify(newConfig));

    // 9. 保存完整的 turn 数据
    const turnId = saveCompleteTurnData(db, {
      sessionId,
      turnNumber,
      turnData,
      fileChanges,
      configSnapshot: newConfig,
      configChanges,
    });

    // 10. 更新 skill lifecycle
    for (const skillUsage of turnData.skill_usages) {
      const inference = inferSkillIntroductionReason(turnData.user_message, skillUsage.skill_name);
      updateSkillLifecycle(db, skillUsage.skill_name, turnId, inference.reason);
    }

    // 11. 检测项目阶段变化
    const skillNames = turnData.skill_usages.map((s) => s.skill_name);
    const filePaths = fileChanges.map((f) => f.file_path);
    const currentPhase = inferProjectPhase({ skillNames, filePaths, context: turnData.user_message });

    const phases = getProjectPhases(db);
    const lastPhase = phases.length > 0 ? phases[phases.length - 1].phase_name : null;

    if (lastPhase !== currentPhase) {
      const toolNames = turnData.tool_calls.map((t) => t.tool_name);
      recordPhaseTransition(db, currentPhase, turnId, skillNames, toolNames);
    }

    // 12. 更新 session turn count
    db.prepare('UPDATE sessions SET turn_count = ? WHERE id = ?').run(turnNumber, sessionId);

    db.close();

    const output: HookOutput = {
      skipped: false,
      turnId,
      ...(importedCount > 0 ? { imported: importedCount } : {})
    };
    console.log(JSON.stringify(output));
  } catch (error) {
    console.error('K2D Hook Error:', error);
    const output: HookOutput = { skipped: true, reason: String(error) };
    console.log(JSON.stringify(output));
  }
}

main();
