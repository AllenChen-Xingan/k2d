/**
 * G1.3 数据库 Schema
 * SQLite 数据库表结构定义
 */

export const schema = `
-- ============================================
-- 核心表
-- ============================================

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME,
    turn_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 对话轮次表
CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    turn_number INTEGER NOT NULL,
    user_message TEXT,
    assistant_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 工具调用表
CREATE TABLE IF NOT EXISTS tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    tool_name TEXT NOT NULL,
    tool_type TEXT,
    parameters JSON,
    result_status TEXT,
    result_summary TEXT,
    execution_time_ms INTEGER,
    called_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文件变更表
CREATE TABLE IF NOT EXISTS file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    file_path TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK(change_type IN ('A', 'M', 'D')),
    diff_content TEXT,
    commit_hash TEXT,
    old_hash TEXT,
    new_hash TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MCP 调用表
CREATE TABLE IF NOT EXISTS mcp_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    server_name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    request JSON,
    response JSON,
    called_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Skill 使用表
CREATE TABLE IF NOT EXISTS skill_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    skill_name TEXT NOT NULL,
    trigger_type TEXT CHECK(trigger_type IN ('user', 'auto')),
    context TEXT,
    outcome TEXT CHECK(outcome IN ('success', 'partial', 'failed')),
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 配置追踪表
-- ============================================

-- 配置快照表
CREATE TABLE IF NOT EXISTS config_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    settings_json TEXT,
    settings_local_json TEXT,
    claude_md TEXT,
    mcp_json TEXT,
    lsp_json TEXT,
    agents_list JSON,
    skills_list JSON,
    plugins_list JSON,
    rules_list JSON,
    commands_list JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 配置变更表
CREATE TABLE IF NOT EXISTS config_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    config_type TEXT NOT NULL,
    item_name TEXT,
    change_type TEXT NOT NULL CHECK(change_type IN ('A', 'M', 'D')),
    before_value TEXT,
    after_value TEXT,
    diff_summary TEXT,
    trigger_context TEXT,
    related_task TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 隐性知识表
-- ============================================

-- Skill 生命周期表
CREATE TABLE IF NOT EXISTS skill_lifecycle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT NOT NULL UNIQUE,
    introduced_at DATETIME,
    introduced_turn_id INTEGER,
    introduction_reason TEXT,
    total_usages INTEGER DEFAULT 0,
    last_used_at DATETIME,
    success_rate REAL,
    is_active BOOLEAN DEFAULT TRUE,
    removed_at DATETIME,
    removal_reason TEXT,
    skill_type TEXT,
    depends_on JSON,
    generates JSON
);

-- 项目阶段表
CREATE TABLE IF NOT EXISTS project_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_name TEXT NOT NULL,
    started_at DATETIME,
    ended_at DATETIME,
    started_turn_id INTEGER,
    ended_turn_id INTEGER,
    dominant_skills JSON,
    dominant_tools JSON,
    key_outputs JSON,
    lessons_learned TEXT
);

-- ============================================
-- 辅助表
-- ============================================

-- 快照表（快照模式专用）
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id),
    file_tree JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 配置表
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_turn ON tool_calls(turn_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_turn ON file_changes(turn_id);
CREATE INDEX IF NOT EXISTS idx_config_changes_turn ON config_changes(turn_id);
CREATE INDEX IF NOT EXISTS idx_skill_usages_turn ON skill_usages(turn_id);
CREATE INDEX IF NOT EXISTS idx_mcp_calls_turn ON mcp_calls(turn_id);
`;

/**
 * 获取所有必需的表名
 */
export const requiredTables = [
  'sessions',
  'turns',
  'tool_calls',
  'file_changes',
  'mcp_calls',
  'skill_usages',
  'config_snapshots',
  'config_changes',
  'skill_lifecycle',
  'project_phases',
  'snapshots',
  'config',
];
