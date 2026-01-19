---
name: k2d-extract
description: 从 K2D 数据中提取可复用的工作模式。分析工具调用序列、Skill 组合、工具类型组合，识别高频重复模式。当用户想要：(1) 发现自己的工作规律，(2) 提取常用工作流，(3) 分析 Skill 使用组合，(4) 优化工作效率时使用。触发短语："提取模式"、"分析工作流"、"Skill 组合"、"使用规律"、"K2D 提取"。
---

# K2D Extract

从 K2D 数据库中提取可复用的工作模式。

## 模式类型

1. **Workflow Patterns** - 工具调用序列模式
2. **Skill Combo Patterns** - Skill 组合模式
3. **Tool Combo Patterns** - 工具类型组合模式

## 模式存储位置

```
meta/patterns/
├── workflows/           # 工作流模式
│   ├── workflow-1.md
│   └── ...
├── skill-tactics/       # Skill 组合模式
│   ├── skill-combo-1.md
│   └── ...
└── tool-combos/         # 工具组合模式
    ├── tool-combo-1.md
    └── ...
```

---

## 1. 工作流模式提取

### 定义

工具调用序列在多个 turns 中重复出现 >= 3 次。

### 提取步骤

**Step 1: 查询所有 turn 的工具序列**

```bash
sqlite3 meta/k2d.db "SELECT t.id as turn_id, GROUP_CONCAT(tc.tool_name, '->') as tool_sequence FROM turns t JOIN tool_calls tc ON tc.turn_id = t.id GROUP BY t.id ORDER BY t.id"
```

**Step 2: 统计序列频率**

对上一步的结果进行分组统计，找出出现 >= 3 次的序列。

**Step 3: 分析模式**

对于每个高频模式，分析：
- 工具序列的含义
- 适用的场景
- 效率提升建议

**Step 4: 生成模式文件**

```markdown
# 工作流模式: {pattern_id}

## 模式信息

- **ID**: workflow-{n}
- **频率**: {frequency} 次
- **工具序列**: {tool1} → {tool2} → {tool3}

## 使用场景

{description}

## 最佳实践

{best_practices}
```

保存到 `meta/patterns/workflows/workflow-{n}.md`

---

## 2. Skill 组合模式提取

### 定义

多个 Skills 在同一个 session 中一起使用，出现 >= 2 次。

### 提取步骤

**Step 1: 查询每个 session 的 Skill 组合**

```bash
sqlite3 meta/k2d.db "SELECT s.id as session_id, GROUP_CONCAT(DISTINCT su.skill_name, ',') as skills FROM sessions s JOIN turns t ON t.session_id = s.id JOIN skill_usages su ON su.turn_id = t.id GROUP BY s.id"
```

**Step 2: 统计组合频率**

对 skills 字段进行排序后分组，找出出现 >= 2 次的组合。

**Step 3: 计算成功率**

```bash
sqlite3 meta/k2d.db "SELECT skill_name, COUNT(*) as total, SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as success FROM skill_usages WHERE skill_name IN ({skill_list}) GROUP BY skill_name"
```

**Step 4: 生成模式文件**

```markdown
# Skill 组合模式: {pattern_id}

## 模式信息

- **ID**: skill-combo-{n}
- **频率**: {frequency} 次
- **Skills**: {skill1}, {skill2}, {skill3}
- **综合成功率**: {success_rate}%

## 适用场景

{context}

## 使用建议

{recommendations}
```

保存到 `meta/patterns/skill-tactics/skill-combo-{n}.md`

---

## 3. 工具类型组合模式提取

### 定义

不同类型的工具在同一个 turn 中组合使用，出现 >= 3 次。

### 工具类型分类

- `file`: 文件操作 (Read, Write, Edit, Glob)
- `code`: 代码执行 (Bash)
- `search`: 搜索工具 (Grep, WebSearch)
- `mcp`: MCP 工具调用
- `other`: 其他

### 提取步骤

**Step 1: 查询每个 turn 的工具类型组合**

```bash
sqlite3 meta/k2d.db "SELECT t.id, GROUP_CONCAT(DISTINCT tc.tool_type, ',') as tool_types FROM turns t JOIN tool_calls tc ON tc.turn_id = t.id WHERE tc.tool_type IS NOT NULL GROUP BY t.id"
```

**Step 2: 统计组合频率**

对 tool_types 字段进行排序后分组，找出出现 >= 3 次的组合。

**Step 3: 分析效率**

```bash
sqlite3 meta/k2d.db "SELECT AVG(tc.execution_time_ms) as avg_time FROM tool_calls tc JOIN turns t ON tc.turn_id = t.id WHERE t.id IN ({turn_ids})"
```

**Step 4: 生成模式文件**

```markdown
# 工具组合模式: {pattern_id}

## 模式信息

- **ID**: tool-combo-{n}
- **频率**: {frequency} 次
- **工具类型**: {type1} + {type2} + {type3}

## 效率分析

- 平均执行时间: {avg_time}ms

## 适用场景

{description}
```

保存到 `meta/patterns/tool-combos/tool-combo-{n}.md`

---

## 快速提取命令

### 提取所有模式

执行以上三个提取流程，生成完整的模式库。

### 查看已提取的模式

```bash
ls meta/patterns/workflows/
ls meta/patterns/skill-tactics/
ls meta/patterns/tool-combos/
```

---

## 阈值配置

| 模式类型 | 最小频率 |
|---------|---------|
| Workflow Patterns | >= 3 |
| Skill Combo Patterns | >= 2 |
| Tool Combo Patterns | >= 3 |

可根据数据量调整阈值。

---

## 输出

1. `meta/patterns/` 下的 Markdown 文件
2. 控制台展示提取的模式摘要
