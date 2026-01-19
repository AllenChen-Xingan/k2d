# K2D - Knowledge to Data

从 Claude Code 使用历史中提取可复用知识资产的 Claude Code 插件。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    数据收集层 (自动)                          │
│  Stop Hook → 自动初始化 + 历史导入 + 实时收集                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      4 个 Skills                             │
│  k2d-query  │ k2d-report │ k2d-extract │ k2d-generate       │
│  查询数据    │ 生成报告    │ 提取模式     │ 生成资产          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        输出                                  │
│  meta/k2d.db │ meta/reports/ │ meta/patterns/ │ meta/assets/│
└─────────────────────────────────────────────────────────────┘
```

## 插件安装

将 `.claude/plugins/k2d/` 目录复制到任何项目即可使用。**完全自动化**，无需手动初始化。

## 开发命令

```bash
# 构建 Hook（开发时使用）
npm run build:hook

# 运行测试
npm test

# 类型检查
npm run typecheck
```

## 源码结构

```
src/
├── index.ts                 # 主入口
├── db/                      # 数据库层
│   ├── init.ts              # 数据库初始化
│   ├── schema.ts            # 表结构定义
│   └── operations.ts        # 数据库操作
├── collectors/              # 数据采集器
│   ├── transcript.ts        # 对话记录收集
│   ├── file-changes.ts      # 文件变更收集
│   └── config-changes.ts    # 配置变更收集
├── extractors/              # 推断引擎
│   ├── skill-inference.ts   # Skill 引入原因推断
│   └── phase-inference.ts   # 项目阶段推断
├── hooks/
│   └── on-turn-end.ts       # Stop Hook（自动初始化 + 数据收集）
├── init/
│   └── create-directories.ts
└── utils/
    ├── git-detector.ts
    └── sensitive-filter.ts
```

## 插件结构

```
.claude/plugins/k2d/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── k2d-query/           # 查询 Skill
│   ├── k2d-report/          # 报告 Skill
│   ├── k2d-extract/         # 提取 Skill
│   └── k2d-generate/        # 生成 Skill
├── hooks/
│   ├── hooks.json
│   └── on-turn-end.js       # 编译后的 Hook
└── README.md
```

## 自动化功能

1. **自动初始化**: Hook 检测到数据库不存在时自动创建
2. **历史导入**: 如果中途安装插件，自动回溯导入已有的对话历史
3. **实时收集**: 每轮对话结束后自动收集数据

## 数据库表

| 表 | 说明 |
|---|-----|
| `sessions` | 会话记录 |
| `turns` | 对话轮次 |
| `tool_calls` | 工具调用 |
| `skill_usages` | Skill 使用 |
| `file_changes` | 文件变更 |
| `config_changes` | 配置变更 |
| `project_phases` | 项目阶段 |
| `skill_lifecycle` | Skill 生命周期 |

## 技术栈

- **Runtime**: Bun
- **Language**: TypeScript
- **Database**: SQLite (bun:sqlite)
- **Testing**: Bun test
