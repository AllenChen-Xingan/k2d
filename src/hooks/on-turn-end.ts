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
import { inferProjectPhase } from '../extractors/phase-inference';
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
  imported?: number;           // 回溯导入的历史轮次数
  importedSessions?: number;   // 导入的 session 数
  importedTools?: number;      // 导入的工具调用数
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
 * 获取项目的所有 session 文件
 */
async function getAllSessionFiles(transcriptPath: string): Promise<string[]> {
  const projectDir = path.dirname(transcriptPath);
  const files = await fs.readdir(projectDir);
  return files
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(projectDir, f))
    .sort(); // 按文件名排序（通常是 UUID，可以保持一定顺序）
}

/**
 * 从 transcript 路径提取 session ID
 */
function extractSessionId(transcriptPath: string): string {
  const filename = path.basename(transcriptPath, '.jsonl');
  return filename;
}

/**
 * 导入单个 session 的所有历史对话
 */
async function importSessionTurns(
  db: K2DDatabase,
  transcriptPath: string,
  projectPath: string,
  globalTurnOffset: number,
  excludeLastTurn: boolean = false
): Promise<{ turnCount: number; toolCount: number }> {
  const sessionId = extractSessionId(transcriptPath);

  // 检查 session 是否已导入
  const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
  if (existingSession) {
    return { turnCount: 0, toolCount: 0 };
  }

  // 解析完整的对话历史
  const allTurns = await parseFullTranscript(transcriptPath);

  if (allTurns.length === 0) {
    return { turnCount: 0, toolCount: 0 };
  }

  // 创建 session
  const stmt = db.prepare('INSERT INTO sessions (id, project_path, started_at, turn_count) VALUES (?, ?, ?, ?)');
  stmt.run(sessionId, projectPath, new Date().toISOString(), allTurns.length);

  // 获取当前配置作为快照
  const configSnapshot = await collectClaudeConfig(projectPath);

  // 决定导入哪些 turns
  const turnsToImport = excludeLastTurn ? allTurns.slice(0, -1) : allTurns;
  let toolCount = 0;

  for (let i = 0; i < turnsToImport.length; i++) {
    const turnData = turnsToImport[i];
    const turnNumber = globalTurnOffset + i + 1;

    // 保存轮次
    const turnId = saveCompleteTurnData(db, {
      sessionId,
      turnNumber,
      turnData,
      fileChanges: [],
      configSnapshot,
      configChanges: [],
    });

    toolCount += turnData.tool_calls.length;

    // 更新 skill lifecycle
    for (const skillUsage of turnData.skill_usages) {
      const inference = inferSkillIntroductionReason(turnData.user_message, skillUsage.skill_name);
      updateSkillLifecycle(db, skillUsage.skill_name, turnId, inference.reason);
    }
  }

  // 更新 session turn count
  db.prepare('UPDATE sessions SET turn_count = ? WHERE id = ?').run(turnsToImport.length, sessionId);

  return { turnCount: turnsToImport.length, toolCount };
}

/**
 * 回溯导入所有历史 session
 */
async function importAllHistoricalSessions(
  db: K2DDatabase,
  currentTranscriptPath: string,
  projectPath: string
): Promise<{ sessions: number; turns: number; tools: number }> {
  const allSessionFiles = await getAllSessionFiles(currentTranscriptPath);
  const currentSessionFile = currentTranscriptPath;

  let totalTurns = 0;
  let totalTools = 0;
  let importedSessions = 0;

  for (const sessionFile of allSessionFiles) {
    const isCurrentSession = path.resolve(sessionFile) === path.resolve(currentSessionFile);

    // 对于当前 session，排除最后一轮（会在正常流程中处理）
    const result = await importSessionTurns(
      db,
      sessionFile,
      projectPath,
      totalTurns,
      isCurrentSession
    );

    if (result.turnCount > 0) {
      importedSessions++;
      totalTurns += result.turnCount;
      totalTools += result.toolCount;
    }
  }

  // 更新全局 turn number
  setConfig(db, 'current_turn_number', totalTurns.toString());

  return { sessions: importedSessions, turns: totalTurns, tools: totalTools };
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

    // 3. 检测是否需要回溯导入所有历史 session
    let importedStats = { sessions: 0, turns: 0, tools: 0 };
    if (isNewDatabase || isDatabaseEmpty(db)) {
      importedStats = await importAllHistoricalSessions(db, input.transcript_path, projectPath);
    }

    // 4. 获取或创建当前 session
    const currentSessionId = extractSessionId(input.transcript_path);
    let sessionId = getConfig(db, 'current_session_id');

    // 如果 session 切换了，更新当前 session
    if (sessionId !== currentSessionId) {
      // 检查 session 是否已存在
      const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(currentSessionId);
      if (!existingSession) {
        const stmt = db.prepare('INSERT INTO sessions (id, project_path, started_at, turn_count) VALUES (?, ?, ?, ?)');
        stmt.run(currentSessionId, projectPath, new Date().toISOString(), 0);
      }
      sessionId = currentSessionId;
      setConfig(db, 'current_session_id', sessionId);
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

    // 12. 更新 session turn count（统计该 session 的实际轮次数）
    const sessionTurnCount = db.prepare('SELECT COUNT(*) as count FROM turns WHERE session_id = ?').get(sessionId) as { count: number };
    db.prepare('UPDATE sessions SET turn_count = ? WHERE id = ?').run(sessionTurnCount.count, sessionId);

    db.close();

    const output: HookOutput = {
      skipped: false,
      turnId,
      ...(importedStats.turns > 0 ? {
        imported: importedStats.turns,
        importedSessions: importedStats.sessions,
        importedTools: importedStats.tools
      } : {})
    };
    console.log(JSON.stringify(output));
  } catch (error) {
    console.error('K2D Hook Error:', error);
    const output: HookOutput = { skipped: true, reason: String(error) };
    console.log(JSON.stringify(output));
  }
}

main();
