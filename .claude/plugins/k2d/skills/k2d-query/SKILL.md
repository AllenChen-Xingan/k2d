---
name: k2d-query
description: 查询 K2D 数据库中的 Claude Code 使用历史。支持查询 sessions、turns、工具调用、Skill 使用、文件变更、项目阶段等数据。当用户想要：(1) 查看使用统计，(2) 查询历史记录，(3) 了解工具/Skill 使用情况，(4) 执行自定义 SQL 查询时使用。触发短语："查询 K2D"、"使用统计"、"有多少 session"、"工具使用情况"、"查看历史"。
---

# K2D Query

查询 K2D 数据库中的 Claude Code 使用历史数据。

## 数据库位置

```
meta/k2d.db
```

使用 sqlite3 命令行工具查询。

## 快速查询命令

### Sessions（会话列表）

```bash
sqlite3 meta/k2d.db "SELECT id, substr(project_path, -30) as project, started_at, turn_count FROM sessions ORDER BY started_at DESC LIMIT 10"
```

### Turns（对话轮次）

```bash
# 最近 10 条
sqlite3 meta/k2d.db "SELECT id, session_id, turn_number, substr(user_message, 1, 50) as msg FROM turns ORDER BY created_at DESC LIMIT 10"

# 指定 session
sqlite3 meta/k2d.db "SELECT turn_number, substr(user_message, 1, 80) as user_msg FROM turns WHERE session_id = 'SESSION_ID' ORDER BY turn_number"
```

### 工具使用统计

```bash
sqlite3 meta/k2d.db "SELECT tool_name, tool_type, COUNT(*) as count, SUM(CASE WHEN result_status = 'success' THEN 1 ELSE 0 END) as success FROM tool_calls GROUP BY tool_name ORDER BY count DESC LIMIT 15"
```

### Skill 使用统计

```bash
sqlite3 meta/k2d.db "SELECT skill_name, trigger_type, COUNT(*) as count, SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as success FROM skill_usages GROUP BY skill_name ORDER BY count DESC"
```

### 文件变更历史

```bash
sqlite3 meta/k2d.db "SELECT file_path, change_type, changed_at FROM file_changes ORDER BY changed_at DESC LIMIT 20"
```

### 项目阶段

```bash
sqlite3 meta/k2d.db "SELECT phase_name, started_at, ended_at FROM project_phases ORDER BY started_at"
```

### 数据库统计摘要

```bash
sqlite3 meta/k2d.db "SELECT 'sessions' as table_name, COUNT(*) as count FROM sessions UNION ALL SELECT 'turns', COUNT(*) FROM turns UNION ALL SELECT 'tool_calls', COUNT(*) FROM tool_calls UNION ALL SELECT 'skill_usages', COUNT(*) FROM skill_usages UNION ALL SELECT 'file_changes', COUNT(*) FROM file_changes"
```

## 自定义 SQL 查询

支持只读 SQL 查询。**禁止** INSERT、UPDATE、DELETE、DROP、CREATE、ALTER 等写操作。

示例：
```bash
sqlite3 meta/k2d.db "SELECT date(created_at) as day, COUNT(*) as turns FROM turns GROUP BY day ORDER BY day DESC LIMIT 7"
```

## 输出格式化

使用 `-header -column` 参数获得格式化输出：

```bash
sqlite3 -header -column meta/k2d.db "SELECT ..."
```

使用 `-json` 参数获得 JSON 输出：

```bash
sqlite3 -json meta/k2d.db "SELECT ..."
```

## 数据库 Schema

详见 [references/schema.md](references/schema.md)

核心表：
- `sessions`: 会话记录
- `turns`: 对话轮次
- `tool_calls`: 工具调用
- `skill_usages`: Skill 使用
- `file_changes`: 文件变更
- `config_changes`: 配置变更
- `project_phases`: 项目阶段
- `skill_lifecycle`: Skill 生命周期
