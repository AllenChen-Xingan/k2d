---
name: k2d-generate
description: 基于提取的模式生成可复用的知识资产。包括：规则（Rules）、CLAUDE.md 模板（Templates）、Skill 包（Skill Packs）。当用户想要：(1) 将模式转化为规则，(2) 生成项目模板，(3) 打包 Skill 组合，(4) 创建可分享的知识资产时使用。触发短语："生成资产"、"创建规则"、"生成模板"、"Skill Pack"、"K2D 生成"。
---
  
# K2D Generate

基于提取的模式生成可复用的知识资产。

## 资产类型

1. **Rules** - 工作流建议规则
2. **Templates** - CLAUDE.md 项目模板
3. **Skill Packs** - 经验证的 Skill 组合包

## 资产存储位置

```
meta/assets/
├── rules/              # 规则文件
│   ├── rule-workflow-1.md
│   └── index.md
├── templates/          # CLAUDE.md 模板
│   ├── template-1.md
│   └── templates.json
└── skill-packs/        # Skill 包
    ├── pack-1.json
    └── index.json
```

---

## 1. 规则生成 (Rules)

### 来源

从工作流模式（workflow patterns）生成，条件：频率 >= 5

### 生成步骤

**Step 1: 读取工作流模式**

检查 `meta/patterns/workflows/` 目录下的模式文件。

**Step 2: 筛选高频模式**

选择频率 >= 5 的工作流模式。

**Step 3: 生成规则文件**

```markdown
---
id: rule-workflow-{n}
name: 工作流规则: {first_tool} 启动
source: workflow-{n}
---

# {rule_name}

## 描述

{workflow_description}

## 触发条件

当使用 {first_tool} 工具时

## 建议操作

考虑按顺序使用以下工具：
1. {tool_1}
2. {tool_2}
3. {tool_3}

## 原因

此工作流在历史数据中出现 {frequency} 次，已被验证为有效的操作序列。
```

保存到 `meta/assets/rules/rule-workflow-{n}.md`

**Step 4: 生成规则索引**

```markdown
# 规则索引

生成时间: {timestamp}

## 规则列表

- [规则1: {name}](./rule-workflow-1.md)
- [规则2: {name}](./rule-workflow-2.md)
...
```

保存到 `meta/assets/rules/index.md`

---

## 2. 模板生成 (Templates)

### 来源

从 Skill 组合模式（skill combo patterns）生成，取 Top 3 组合。

### 生成步骤

**Step 1: 读取 Skill 组合模式**

检查 `meta/patterns/skill-tactics/` 目录下的模式文件。

**Step 2: 选择 Top 3 组合**

按频率排序，选择前 3 个组合。

**Step 3: 推断项目类型**

根据 Skills 推断项目类型：
- pm-* → 产品管理项目
- dev-* → 开发项目
- design-* → 设计项目

**Step 4: 生成 CLAUDE.md 模板**

```markdown
# {project_name}

## 项目类型

{project_type}

## 推荐工作流

1. {skill_1_description}
2. {skill_2_description}
3. {skill_3_description}

## Skills

推荐使用以下 skills:

- `/{skill_1}`
- `/{skill_2}`
- `/{skill_3}`

## 工具组合

基于历史数据，以下工具组合效率较高：

{tool_recommendations}

## 注意事项

基于 K2D 历史数据分析，此工作流组合的成功率为 {success_rate}%。
```

保存到 `meta/assets/templates/template-{n}.md`

**Step 5: 生成模板元数据**

```json
[
  {
    "id": "template-1",
    "name": "{project_type} 项目模板",
    "description": "基于 {skills} 的工作流模板",
    "skills": ["skill1", "skill2", "skill3"],
    "projectType": "{project_type}",
    "createdAt": "{timestamp}"
  }
]
```

保存到 `meta/assets/templates/templates.json`

---

## 3. Skill Pack 生成 (Skill Packs)

### 来源

从 Skill 组合模式生成，条件：频率 >= 2

### 生成步骤

**Step 1: 读取 Skill 组合模式**

检查 `meta/patterns/skill-tactics/` 目录下的模式文件。

**Step 2: 筛选有效组合**

选择频率 >= 2 的组合。

**Step 3: 计算组合成功率**

```bash
sqlite3 meta/k2d.db "SELECT skill_name, COUNT(*) as total, SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as success FROM skill_usages WHERE skill_name IN ({skill_list}) GROUP BY skill_name"
```

**Step 4: 生成 Skill Pack 文件**

```json
{
  "id": "pack-skill-combo-{n}",
  "name": "{primary_skill} 工作流包",
  "description": "Skills 经常一起使用: {skill_list}",
  "skills": ["skill1", "skill2", "skill3"],
  "successRate": 0.85,
  "context": "{usage_context}",
  "createdAt": "{timestamp}",
  "frequency": {frequency}
}
```

保存到 `meta/assets/skill-packs/pack-skill-combo-{n}.json`

**Step 5: 生成 Skill Pack 索引**

```json
[
  {
    "id": "pack-skill-combo-1",
    "name": "{name}",
    "skills": ["skill1", "skill2"],
    "successRate": 0.85
  }
]
```

保存到 `meta/assets/skill-packs/index.json`

---

## 快速生成命令

### 生成所有资产

1. 确保已运行 k2d-extract 提取模式
2. 执行以上三个生成流程

### 查看已生成的资产

```bash
ls meta/assets/rules/
ls meta/assets/templates/
ls meta/assets/skill-packs/
```

---

## 资产使用

### 规则

- 可作为 Claude Code rules 使用
- 复制到 `.claude/rules/` 目录

### 模板

- 用于新项目的 CLAUDE.md 初始化
- 可根据项目类型选择合适的模板

### Skill Packs

- 团队分享有效的 Skill 组合
- 用于新项目的 skill 配置建议

---

## 输出

1. `meta/assets/` 下的资产文件
2. 控制台展示生成的资产摘要
3. 可选：打包为可分享的格式
