---
name: k2d-report
description: 基于 K2D 数据生成分析报告。支持三种报告：项目全景报告、会话报告、模式报告。当用户想要：(1) 了解项目整体使用情况，(2) 分析某次会话的详情，(3) 查看使用模式统计时使用。触发短语："生成报告"、"项目全景"、"会话总结"、"使用分析"、"K2D 报告"。
---

# K2D Report

基于 K2D 数据库生成分析报告。

## 报告类型

1. **Project Report** - 项目全景报告
2. **Session Report** - 单个会话报告
3. **Pattern Report** - 使用模式报告

## 报告存储位置

```
meta/reports/
├── project-report-{timestamp}.md
├── session-report-{session_id}-{timestamp}.md
└── pattern-report-{timestamp}.md
```

---

## 1. 项目全景报告

### 生成步骤

**Step 1: 收集基础统计**

```bash
sqlite3 meta/k2d.db "SELECT 'sessions' as metric, COUNT(*) as value FROM sessions UNION ALL SELECT 'turns', COUNT(*) FROM turns UNION ALL SELECT 'tool_calls', COUNT(*) FROM tool_calls UNION ALL SELECT 'skill_usages', COUNT(*) FROM skill_usages UNION ALL SELECT 'file_changes', COUNT(*) FROM file_changes"
```

**Step 2: 查询 Top Skills**

```bash
sqlite3 meta/k2d.db "SELECT skill_name, COUNT(*) as count FROM skill_usages GROUP BY skill_name ORDER BY count DESC LIMIT 10"
```

**Step 3: 查询 Top Tools**

```bash
sqlite3 meta/k2d.db "SELECT tool_name, COUNT(*) as count FROM tool_calls GROUP BY tool_name ORDER BY count DESC LIMIT 10"
```

**Step 4: 推断技术栈**

```bash
sqlite3 meta/k2d.db "SELECT CASE WHEN file_path LIKE '%.ts' OR file_path LIKE '%.tsx' THEN 'TypeScript' WHEN file_path LIKE '%.js' OR file_path LIKE '%.jsx' THEN 'JavaScript' WHEN file_path LIKE '%.py' THEN 'Python' WHEN file_path LIKE '%.go' THEN 'Go' WHEN file_path LIKE '%.rs' THEN 'Rust' ELSE NULL END as tech, COUNT(*) as count FROM file_changes WHERE file_path IS NOT NULL GROUP BY tech HAVING tech IS NOT NULL ORDER BY count DESC"
```

**Step 5: 查询项目阶段**

```bash
sqlite3 meta/k2d.db "SELECT phase_name, started_at, ended_at FROM project_phases ORDER BY started_at"
```

**Step 6: 生成报告**

使用以下模板生成 Markdown 报告：

```markdown
# 项目全景报告

生成时间: {timestamp}

## 总览

| 指标 | 数值 |
|------|-----|
| Sessions | {session_count} |
| Turns | {turn_count} |
| 工具调用 | {tool_call_count} |
| Skill 使用 | {skill_usage_count} |
| 文件变更 | {file_change_count} |

## 技术栈

{tech_stack_list}

## Top 10 Skills

| Skill | 使用次数 |
|-------|---------|
{top_skills_rows}

## Top 10 Tools

| Tool | 调用次数 |
|------|---------|
{top_tools_rows}

## 项目阶段

{phase_timeline}

## 里程碑

{milestones}
```

**Step 7: 保存报告**

保存到 `meta/reports/project-report-{timestamp}.md`

---

## 2. 会话报告

### 生成步骤

**Step 1: 查询会话信息**

```bash
sqlite3 meta/k2d.db "SELECT id, project_path, started_at, ended_at, turn_count FROM sessions WHERE id = 'SESSION_ID'"
```

**Step 2: 查询使用的工具**

```bash
sqlite3 meta/k2d.db "SELECT tc.tool_name, COUNT(*) as count FROM tool_calls tc JOIN turns t ON tc.turn_id = t.id WHERE t.session_id = 'SESSION_ID' GROUP BY tc.tool_name ORDER BY count DESC"
```

**Step 3: 查询使用的 Skills**

```bash
sqlite3 meta/k2d.db "SELECT DISTINCT su.skill_name FROM skill_usages su JOIN turns t ON su.turn_id = t.id WHERE t.session_id = 'SESSION_ID'"
```

**Step 4: 查询文件变更**

```bash
sqlite3 meta/k2d.db "SELECT fc.file_path, fc.change_type FROM file_changes fc JOIN turns t ON fc.turn_id = t.id WHERE t.session_id = 'SESSION_ID'"
```

**Step 5: 生成报告**

```markdown
# Session 报告: {session_id}

生成时间: {timestamp}

## 基本信息

- **项目**: {project_path}
- **开始时间**: {started_at}
- **结束时间**: {ended_at}
- **Turn 数量**: {turn_count}
- **持续时间**: {duration}

## 使用的工具

| 工具 | 调用次数 |
|-----|---------|
{tools_rows}

## 使用的 Skills

{skills_list}

## 文件变更

| 文件 | 变更类型 |
|-----|---------|
{file_changes_rows}
```

---

## 3. 模式报告

### 生成步骤

**Step 1: 查询工作流模式**

```bash
sqlite3 meta/k2d.db "SELECT GROUP_CONCAT(tc.tool_name, ' -> ') as workflow, COUNT(*) as frequency FROM turns t JOIN tool_calls tc ON tc.turn_id = t.id GROUP BY t.id HAVING COUNT(*) > 1 ORDER BY frequency DESC LIMIT 10"
```

**Step 2: 查询 Skill 组合模式**

```bash
sqlite3 meta/k2d.db "SELECT GROUP_CONCAT(DISTINCT su.skill_name, ', ') as skills, COUNT(*) as frequency FROM sessions s JOIN turns t ON t.session_id = s.id JOIN skill_usages su ON su.turn_id = t.id GROUP BY s.id HAVING COUNT(DISTINCT su.skill_name) > 1 ORDER BY frequency DESC LIMIT 10"
```

**Step 3: 查询工具类型组合**

```bash
sqlite3 meta/k2d.db "SELECT GROUP_CONCAT(DISTINCT tc.tool_type, ', ') as tool_types, COUNT(*) as frequency FROM turns t JOIN tool_calls tc ON tc.turn_id = t.id WHERE tc.tool_type IS NOT NULL GROUP BY t.id HAVING COUNT(DISTINCT tc.tool_type) > 1 ORDER BY frequency DESC LIMIT 10"
```

**Step 4: 生成报告**

```markdown
# 模式报告

生成时间: {timestamp}

## 工作流模式

常见的工具调用序列：

| 工作流 | 出现次数 |
|-------|---------|
{workflow_rows}

## Skill 组合模式

经常一起使用的 Skills：

| Skills | 出现次数 |
|--------|---------|
{skill_combo_rows}

## 工具类型组合

高效的工具类型组合：

| 工具类型 | 出现次数 |
|---------|---------|
{tool_combo_rows}

## 洞察

{insights}
```

---

## 输出格式

- 所有报告使用 Markdown 格式
- 时间戳格式: `YYYY-MM-DD-HHmmss`
- 报告保存到 `meta/reports/` 目录
