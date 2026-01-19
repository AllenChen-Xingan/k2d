# K2D 插件架构重设计

## 问题分析

### 当前架构的问题

```
当前: TypeScript 模块 → CLI 工具 → 用户在终端执行
     src/skills/*.ts → bin/k2d-*.js → npm run k2d:xxx
```

- `src/skills/` 下的文件是 TypeScript 业务逻辑模块
- 用户需要在终端运行 `npm run k2d:query` 等命令
- Claude 不能直接使用这些能力，只能通过 Bash 调用 CLI
- 这不是真正的 Claude Code Skills

### 目标架构

```
目标: Claude 直接使用 Skills 执行分析
     SKILL.md 指令 → Claude 理解 → 直接操作数据库/生成文件
```

- Skills 是 SKILL.md 文件，包含具体执行指令
- Claude 可以直接查询 SQLite 数据库
- Claude 可以直接生成报告和资产
- 用户通过自然语言或 `/k2d:xxx` 触发

---

## 新架构设计

### 整体数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        用户对话                              │
│  "帮我分析一下我的 Claude Code 使用模式"                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Skill 触发层                              │
│  description 关键词匹配 → 加载对应 SKILL.md                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Claude 执行层                             │
│  1. 读取 SKILL.md 指令                                       │
│  2. 使用 sqlite3 查询数据库                                  │
│  3. 分析数据并生成输出                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       输出层                                 │
│  - 控制台展示结果                                            │
│  - 写入 meta/reports/ 报告                                   │
│  - 写入 meta/assets/ 资产                                    │
└─────────────────────────────────────────────────────────────┘
```

### 三层架构

#### 1. 数据收集层（保持不变）

- **Hook**: `on-turn-end.ts` 在每轮对话结束时自动触发
- **采集器**: transcript, file-changes, config-changes
- **推断器**: skill-inference, phase-inference
- **存储**: `meta/k2d.db` SQLite 数据库

#### 2. Skill 层（重新设计）

| Skill | 触发场景 | 执行方式 |
|-------|---------|---------|
| k2d-query | 查询使用统计、历史记录 | Claude 直接执行 SQL |
| k2d-report | 生成项目/会话/模式报告 | Claude 分析数据 + 生成 Markdown |
| k2d-extract | 提取工作流/Skill组合/工具组合模式 | Claude 执行复杂 SQL + 模式识别 |
| k2d-generate | 生成规则/模板/Skill Pack | Claude 基于模式生成资产文件 |

#### 3. 辅助脚本层（可选）

保留 `bin/` 下的脚本作为复杂操作的辅助工具，但主要逻辑由 Claude 直接执行。

---

## Skill 设计详情

### 1. k2d-query

**目的**: 让 Claude 直接查询 K2D 数据库

**触发条件**:
- "查询/查看/显示 K2D 数据"
- "我的使用统计"
- "有多少个 session/turn"
- "工具使用情况"

**执行方式**:
- Claude 使用 `sqlite3 meta/k2d.db "SQL"` 直接查询
- 提供常用查询模板
- 支持用户自定义只读 SQL

**references 文件**:
- `schema.md`: 数据库表结构参考

### 2. k2d-report

**目的**: 让 Claude 分析数据并生成报告

**触发条件**:
- "生成报告"
- "项目全景"
- "会话总结"
- "模式分析"

**执行方式**:
1. Claude 执行多个查询收集数据
2. Claude 分析数据提取洞察
3. Claude 生成 Markdown 报告
4. 保存到 `meta/reports/`

**三种报告类型**:
- **Project Report**: 项目全景（统计、技术栈、Top Skills/Tools、阶段、里程碑）
- **Session Report**: 会话报告（时长、工具、Skills、文件变更）
- **Pattern Report**: 模式报告（工作流、Skill组合、工具组合）

### 3. k2d-extract

**目的**: 从历史数据中提取可复用模式

**触发条件**:
- "提取模式"
- "分析工作流"
- "Skill 组合"
- "使用规律"

**执行方式**:
1. Claude 执行聚合查询
2. Claude 识别重复模式（频率 >= 阈值）
3. Claude 生成模式描述
4. 保存到 `meta/patterns/`

**三种模式类型**:
- **Workflow Patterns**: 工具序列（频率 >= 3）
- **Skill Combo Patterns**: Skill 组合（频率 >= 2）
- **Tool Combo Patterns**: 工具类型组合（频率 >= 3）

### 4. k2d-generate

**目的**: 基于模式生成可复用资产

**触发条件**:
- "生成资产"
- "创建规则"
- "生成模板"
- "Skill Pack"

**执行方式**:
1. Claude 读取已提取的模式
2. Claude 根据模式生成资产
3. 保存到 `meta/assets/`

**三种资产类型**:
- **Rules**: 工作流建议规则（频率 >= 5）
- **Templates**: CLAUDE.md 项目模板
- **Skill Packs**: 经验证的 Skill 组合

---

## 目录结构调整

### 插件目录（新）

```
.claude/plugins/k2d/
├── .claude-plugin/
│   └── plugin.json
├── skills/                    # 4 个独立 Skills
│   ├── k2d-query/
│   │   ├── SKILL.md          # 查询指令
│   │   └── references/
│   │       └── schema.md     # 数据库 schema 参考
│   ├── k2d-report/
│   │   ├── SKILL.md          # 报告生成指令
│   │   └── references/
│   │       └── report-templates.md
│   ├── k2d-extract/
│   │   ├── SKILL.md          # 模式提取指令
│   │   └── references/
│   │       └── pattern-types.md
│   └── k2d-generate/
│       ├── SKILL.md          # 资产生成指令
│       └── references/
│           └── asset-templates.md
├── hooks/
│   ├── hooks.json
│   └── on-turn-end.js        # 数据收集 hook（保留）
└── README.md
```

### 源码目录（精简）

```
src/
├── db/                       # 数据库层（保留）
│   ├── init.ts
│   ├── schema.ts
│   └── operations.ts
├── collectors/               # 采集器（保留）
│   ├── transcript.ts
│   ├── file-changes.ts
│   └── config-changes.ts
├── extractors/               # 推断器（保留）
│   ├── skill-inference.ts
│   └── phase-inference.ts
├── hooks/
│   └── on-turn-end.ts       # Hook 实现（保留）
├── init/
│   └── create-directories.ts
└── utils/
    ├── git-detector.ts
    └── sensitive-filter.ts

# 删除或废弃:
# - src/skills/ (业务逻辑移到 SKILL.md)
# - src/cli/ (不再需要 CLI 工具)
# - bin/ (不再需要编译的 CLI)
```

---

## 执行方式对比

### 旧方式（CLI）

```bash
# 用户在终端执行
npm run k2d:query sessions
npm run k2d:report overview
npm run k2d:extract workflows
```

### 新方式（Skill）

```
# 用户对 Claude 说
"帮我查看所有的 session 记录"
"生成一份项目全景报告"
"提取我的工作流模式"

# Claude 自动执行
sqlite3 meta/k2d.db "SELECT * FROM sessions ORDER BY started_at DESC"
[分析数据]
[生成报告]
```

---

## 混合方案实现

### 简单查询：直接 SQL

```markdown
# 在 SKILL.md 中指导 Claude 使用 sqlite3

查询 session 列表:
sqlite3 meta/k2d.db "SELECT id, project_path, started_at, turn_count FROM sessions ORDER BY started_at DESC"

查询工具统计:
sqlite3 meta/k2d.db "SELECT tool_name, COUNT(*) as count FROM tool_calls GROUP BY tool_name ORDER BY count DESC LIMIT 10"
```

### 复杂分析：Claude 执行多步骤

```markdown
# 生成项目报告的步骤

1. 查询基础统计
   sqlite3 meta/k2d.db "SELECT COUNT(*) FROM sessions"
   sqlite3 meta/k2d.db "SELECT COUNT(*) FROM turns"
   ...

2. 查询 Top Skills/Tools
   sqlite3 meta/k2d.db "SELECT skill_name, COUNT(*) ..."

3. 分析数据，提取洞察

4. 生成 Markdown 报告

5. 保存到 meta/reports/project-report-{timestamp}.md
```

---

## 优势

1. **Claude 原生能力**: 让 Claude 直接使用其分析能力，而不是调用黑盒脚本
2. **灵活性**: 用户可以用自然语言描述需求，Claude 灵活响应
3. **透明性**: 所有操作都是 Claude 直接执行，用户可以看到过程
4. **可扩展**: 新增功能只需修改 SKILL.md，无需重新编译
5. **团队共享**: Skills 可以打包分享，团队成员可以直接使用

---

## 迁移计划

1. **Phase 1**: 创建 4 个 SKILL.md 文件
2. **Phase 2**: 创建 references 文件（schema、模板等）
3. **Phase 3**: 测试 Skills 功能
4. **Phase 4**: 删除旧的 CLI 工具和 src/skills/
5. **Phase 5**: 更新文档

---

## 下一步

创建以下 SKILL.md 文件:
1. `.claude/plugins/k2d/skills/k2d-query/SKILL.md`
2. `.claude/plugins/k2d/skills/k2d-report/SKILL.md`
3. `.claude/plugins/k2d/skills/k2d-extract/SKILL.md`
4. `.claude/plugins/k2d/skills/k2d-generate/SKILL.md`
