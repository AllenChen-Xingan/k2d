# K2D 数据库 Schema

## 核心表

### sessions

会话记录表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | TEXT PRIMARY KEY | 会话 ID |
| project_path | TEXT | 项目路径 |
| started_at | DATETIME | 开始时间 |
| ended_at | DATETIME | 结束时间 |
| turn_count | INTEGER | 对话轮数 |
| created_at | DATETIME | 记录创建时间 |

### turns

对话轮次表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 轮次 ID |
| session_id | TEXT | 关联的会话 ID |
| turn_number | INTEGER | 轮次序号 |
| user_message | TEXT | 用户消息 |
| assistant_response | TEXT | 助手响应 |
| created_at | DATETIME | 创建时间 |

### tool_calls

工具调用记录表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| turn_id | INTEGER | 关联的轮次 ID |
| tool_name | TEXT | 工具名称 |
| tool_type | TEXT | 工具类型 (file/code/search/mcp/other) |
| parameters | JSON | 调用参数 |
| result_status | TEXT | 结果状态 (success/error) |
| result_summary | TEXT | 结果摘要 |
| execution_time_ms | INTEGER | 执行时间（毫秒）|
| called_at | DATETIME | 调用时间 |

### skill_usages

Skill 使用记录表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| turn_id | INTEGER | 关联的轮次 ID |
| skill_name | TEXT | Skill 名称 |
| trigger_type | TEXT | 触发类型 (user/auto) |
| context | TEXT | 使用上下文 |
| outcome | TEXT | 结果 (success/partial/failed) |
| used_at | DATETIME | 使用时间 |

### file_changes

文件变更记录表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| turn_id | INTEGER | 关联的轮次 ID |
| file_path | TEXT | 文件路径 |
| change_type | TEXT | 变更类型 (A=Added/M=Modified/D=Deleted) |
| diff_content | TEXT | Diff 内容 |
| commit_hash | TEXT | Git commit hash |
| old_hash | TEXT | 旧文件 hash |
| new_hash | TEXT | 新文件 hash |
| changed_at | DATETIME | 变更时间 |

### mcp_calls

MCP 服务调用记录表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| turn_id | INTEGER | 关联的轮次 ID |
| server_name | TEXT | MCP 服务器名称 |
| tool_name | TEXT | 工具名称 |
| request | JSON | 请求内容 |
| response | JSON | 响应内容 |
| called_at | DATETIME | 调用时间 |

## 配置追踪表

### config_snapshots

配置快照表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| turn_id | INTEGER | 关联的轮次 ID |
| settings_json | TEXT | settings.json 内容 |
| settings_local_json | TEXT | settings.local.json 内容 |
| claude_md | TEXT | CLAUDE.md 内容 |
| mcp_json | TEXT | mcp.json 内容 |
| agents_list | JSON | agents 列表 |
| skills_list | JSON | skills 列表 |
| plugins_list | JSON | plugins 列表 |
| rules_list | JSON | rules 列表 |
| commands_list | JSON | commands 列表 |
| created_at | DATETIME | 创建时间 |

### config_changes

配置变更记录表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| turn_id | INTEGER | 关联的轮次 ID |
| config_type | TEXT | 配置类型 |
| item_name | TEXT | 项目名称 |
| change_type | TEXT | 变更类型 (A/M/D) |
| before_value | TEXT | 变更前值 |
| after_value | TEXT | 变更后值 |
| diff_summary | TEXT | 变更摘要 |
| trigger_context | TEXT | 触发上下文 |
| related_task | TEXT | 相关任务 |
| changed_at | DATETIME | 变更时间 |

## 隐性知识表

### skill_lifecycle

Skill 生命周期表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| skill_name | TEXT UNIQUE | Skill 名称 |
| introduced_at | DATETIME | 引入时间 |
| introduced_turn_id | INTEGER | 引入的轮次 ID |
| introduction_reason | TEXT | 引入原因 |
| total_usages | INTEGER | 总使用次数 |
| last_used_at | DATETIME | 最后使用时间 |
| success_rate | REAL | 成功率 |
| is_active | BOOLEAN | 是否活跃 |
| removed_at | DATETIME | 移除时间 |
| removal_reason | TEXT | 移除原因 |
| skill_type | TEXT | Skill 类型 |
| depends_on | JSON | 依赖的 Skills |
| generates | JSON | 生成的内容 |

### project_phases

项目阶段表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| phase_name | TEXT | 阶段名称 (init/requirements/design/development/testing/deployment/maintenance) |
| started_at | DATETIME | 开始时间 |
| ended_at | DATETIME | 结束时间 |
| started_turn_id | INTEGER | 开始的轮次 ID |
| ended_turn_id | INTEGER | 结束的轮次 ID |
| dominant_skills | JSON | 主要 Skills |
| dominant_tools | JSON | 主要工具 |
| key_outputs | JSON | 关键产出 |
| lessons_learned | TEXT | 经验教训 |

## 辅助表

### snapshots

文件快照表（非 Git 项目用）。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| id | INTEGER PRIMARY KEY | 记录 ID |
| turn_id | INTEGER | 关联的轮次 ID |
| file_tree | JSON | 文件树（路径 → MD5 hash）|
| created_at | DATETIME | 创建时间 |

### config

K2D 配置表。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| key | TEXT PRIMARY KEY | 配置键 |
| value | TEXT | 配置值 |

## 常用查询模板

### 按日期统计活动

```sql
SELECT date(created_at) as day, COUNT(*) as turns
FROM turns
GROUP BY day
ORDER BY day DESC
LIMIT 7
```

### 查询最活跃的工具

```sql
SELECT tool_name, COUNT(*) as count
FROM tool_calls
GROUP BY tool_name
ORDER BY count DESC
LIMIT 10
```

### 查询 Skill 成功率

```sql
SELECT
  skill_name,
  COUNT(*) as total,
  SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as success,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM skill_usages
GROUP BY skill_name
ORDER BY total DESC
```

### 查询文件修改频率

```sql
SELECT file_path, COUNT(*) as changes
FROM file_changes
GROUP BY file_path
ORDER BY changes DESC
LIMIT 10
```
