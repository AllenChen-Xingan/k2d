/**
 * 数据库操作模块
 * 提供数据的增删改查操作
 */

import type { K2DDatabase } from './init';
import type { TurnData, ToolCall, SkillUsage, McpCall } from '../collectors/transcript';
import type { FileChange } from '../collectors/file-changes';
import type { ConfigChange, ConfigSnapshot } from '../collectors/config-changes';

// =====================
// Session 操作
// =====================

export interface Session {
  id: string;
  project_path: string;
  started_at: string;
  ended_at: string | null;
  turn_count: number;
}

export function createSession(db: K2DDatabase, projectPath: string): string {
  const id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (id, project_path, started_at, turn_count)
    VALUES (?, ?, ?, 0)
  `).run(id, projectPath, now);

  return id;
}

export function endSession(db: K2DDatabase, sessionId: string): void {
  db.prepare(`
    UPDATE sessions SET ended_at = ? WHERE id = ?
  `).run(new Date().toISOString(), sessionId);
}

export function getSession(db: K2DDatabase, sessionId: string): Session | null {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Session | null;
}

export function listSessions(db: K2DDatabase, limit = 100): Session[] {
  return db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?').all(limit) as Session[];
}

// =====================
// Turn 操作
// =====================

export interface Turn {
  id: number;
  session_id: string;
  turn_number: number;
  user_message: string | null;
  assistant_response: string | null;
  created_at: string;
}

export function createTurn(
  db: K2DDatabase,
  sessionId: string,
  turnNumber: number,
  userMessage: string,
  assistantResponse: string
): number {
  const result = db.prepare(`
    INSERT INTO turns (session_id, turn_number, user_message, assistant_response)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, turnNumber, userMessage, assistantResponse);

  // 更新 session 的 turn_count
  db.prepare('UPDATE sessions SET turn_count = turn_count + 1 WHERE id = ?').run(sessionId);

  return result.lastInsertRowid as number;
}

export function getTurns(db: K2DDatabase, sessionId: string): Turn[] {
  return db.prepare('SELECT * FROM turns WHERE session_id = ? ORDER BY turn_number').all(sessionId) as Turn[];
}

// =====================
// Tool Call 操作
// =====================

export function saveToolCalls(db: K2DDatabase, turnId: number, toolCalls: ToolCall[]): void {
  const stmt = db.prepare(`
    INSERT INTO tool_calls (turn_id, tool_name, tool_type, parameters, result_status, result_summary, execution_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tc of toolCalls) {
    stmt.run(
      turnId,
      tc.tool_name,
      tc.tool_type,
      JSON.stringify(tc.parameters),
      tc.result_status,
      tc.result_summary,
      tc.execution_time_ms
    );
  }
}

export function getToolCallStats(db: K2DDatabase): Array<{ tool_name: string; count: number }> {
  return db.prepare(`
    SELECT tool_name, COUNT(*) as count
    FROM tool_calls
    GROUP BY tool_name
    ORDER BY count DESC
  `).all() as Array<{ tool_name: string; count: number }>;
}

// =====================
// File Change 操作
// =====================

export function saveFileChanges(db: K2DDatabase, turnId: number, changes: FileChange[]): void {
  const stmt = db.prepare(`
    INSERT INTO file_changes (turn_id, file_path, change_type, diff_content, commit_hash, old_hash, new_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const change of changes) {
    stmt.run(
      turnId,
      change.file_path,
      change.change_type,
      change.diff_content,
      change.commit_hash,
      change.old_hash,
      change.new_hash
    );
  }
}

export function getFileChanges(db: K2DDatabase, turnId: number): FileChange[] {
  return db.prepare('SELECT * FROM file_changes WHERE turn_id = ?').all(turnId) as FileChange[];
}

// =====================
// Skill Usage 操作
// =====================

export function saveSkillUsages(db: K2DDatabase, turnId: number, usages: SkillUsage[]): void {
  const stmt = db.prepare(`
    INSERT INTO skill_usages (turn_id, skill_name, trigger_type, context, outcome)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const usage of usages) {
    stmt.run(turnId, usage.skill_name, usage.trigger_type, usage.context, usage.outcome);
  }
}

export function getSkillUsages(db: K2DDatabase, limit = 100): Array<{
  skill_name: string;
  trigger_type: string;
  outcome: string;
  used_at: string;
}> {
  return db.prepare(`
    SELECT skill_name, trigger_type, outcome, used_at
    FROM skill_usages
    ORDER BY used_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    skill_name: string;
    trigger_type: string;
    outcome: string;
    used_at: string;
  }>;
}

// =====================
// MCP Call 操作
// =====================

export function saveMcpCalls(db: K2DDatabase, turnId: number, calls: McpCall[]): void {
  const stmt = db.prepare(`
    INSERT INTO mcp_calls (turn_id, server_name, tool_name, request, response)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const call of calls) {
    stmt.run(turnId, call.server_name, call.tool_name, JSON.stringify(call.request), JSON.stringify(call.response));
  }
}

// =====================
// Config 操作
// =====================

export function saveConfigSnapshot(db: K2DDatabase, turnId: number, config: ConfigSnapshot): void {
  db.prepare(`
    INSERT INTO config_snapshots (
      turn_id, settings_json, settings_local_json, claude_md, mcp_json, lsp_json,
      agents_list, skills_list, plugins_list, rules_list, commands_list
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    turnId,
    config.settings_json,
    config.settings_local_json,
    config.claude_md,
    config.mcp_json,
    config.lsp_json,
    JSON.stringify(config.agents_list),
    JSON.stringify(config.skills_list),
    JSON.stringify(config.plugins_list),
    JSON.stringify(config.rules_list),
    JSON.stringify(config.commands_list)
  );
}

export function saveConfigChanges(db: K2DDatabase, turnId: number, changes: ConfigChange[]): void {
  const stmt = db.prepare(`
    INSERT INTO config_changes (
      turn_id, config_type, item_name, change_type, before_value, after_value, diff_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const change of changes) {
    stmt.run(
      turnId,
      change.config_type,
      change.item_name,
      change.change_type,
      change.before_value,
      change.after_value,
      change.diff_summary
    );
  }
}

// =====================
// Skill Lifecycle 操作
// =====================

export function updateSkillLifecycle(
  db: K2DDatabase,
  skillName: string,
  turnId: number,
  reason: string
): void {
  const existing = db.prepare('SELECT * FROM skill_lifecycle WHERE skill_name = ?').get(skillName);

  if (existing) {
    db.prepare(`
      UPDATE skill_lifecycle
      SET total_usages = total_usages + 1, last_used_at = ?
      WHERE skill_name = ?
    `).run(new Date().toISOString(), skillName);
  } else {
    db.prepare(`
      INSERT INTO skill_lifecycle (
        skill_name, introduced_at, introduced_turn_id, introduction_reason, total_usages, last_used_at
      ) VALUES (?, ?, ?, ?, 1, ?)
    `).run(skillName, new Date().toISOString(), turnId, reason, new Date().toISOString());
  }
}

// =====================
// Project Phase 操作
// =====================

export function recordPhaseTransition(
  db: K2DDatabase,
  phaseName: string,
  turnId: number,
  dominantSkills: string[],
  dominantTools: string[]
): void {
  // 结束当前活跃阶段
  db.prepare(`
    UPDATE project_phases
    SET ended_at = ?, ended_turn_id = ?
    WHERE ended_at IS NULL
  `).run(new Date().toISOString(), turnId);

  // 开始新阶段
  db.prepare(`
    INSERT INTO project_phases (
      phase_name, started_at, started_turn_id, dominant_skills, dominant_tools
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    phaseName,
    new Date().toISOString(),
    turnId,
    JSON.stringify(dominantSkills),
    JSON.stringify(dominantTools)
  );
}

export function getProjectPhases(db: K2DDatabase): Array<{
  phase_name: string;
  started_at: string;
  ended_at: string | null;
}> {
  return db.prepare('SELECT * FROM project_phases ORDER BY started_at').all() as Array<{
    phase_name: string;
    started_at: string;
    ended_at: string | null;
  }>;
}

// =====================
// 完整 Turn 数据保存
// =====================

export interface CompleteTurnData {
  sessionId: string;
  turnNumber: number;
  turnData: TurnData;
  fileChanges: FileChange[];
  configSnapshot?: ConfigSnapshot;
  configChanges?: ConfigChange[];
}

export function saveCompleteTurnData(db: K2DDatabase, data: CompleteTurnData): number {
  const turnId = createTurn(
    db,
    data.sessionId,
    data.turnNumber,
    data.turnData.user_message,
    data.turnData.assistant_response
  );

  if (data.turnData.tool_calls.length > 0) {
    saveToolCalls(db, turnId, data.turnData.tool_calls);
  }

  if (data.turnData.skill_usages.length > 0) {
    saveSkillUsages(db, turnId, data.turnData.skill_usages);
  }

  if (data.turnData.mcp_calls.length > 0) {
    saveMcpCalls(db, turnId, data.turnData.mcp_calls);
  }

  if (data.fileChanges.length > 0) {
    saveFileChanges(db, turnId, data.fileChanges);
  }

  if (data.configSnapshot) {
    saveConfigSnapshot(db, turnId, data.configSnapshot);
  }

  if (data.configChanges && data.configChanges.length > 0) {
    saveConfigChanges(db, turnId, data.configChanges);
  }

  return turnId;
}
