# K2D - Knowledge to Data

**从 Claude Code 使用历史中提取可复用的知识资产。**

K2D 是一个 Claude Code 插件，自动收集你与 Claude 的对话数据，帮助你分析使用模式、提取工作流、生成可复用的知识资产。

## 安装

```bash
# 克隆仓库
git clone https://github.com/AllenChen-Xingan/k2d.git

# 复制插件到你的项目
cp -r k2d/.claude/plugins/k2d /path/to/your/project/.claude/plugins/
```

**就这么简单！** 插件会在你开始对话时自动初始化。

## 前置要求

- [Bun](https://bun.sh/) 运行时

安装 Bun:
```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

## 工作原理

### 完全自动化

1. **自动初始化**: 当你开始对话时，K2D 自动创建 `meta/` 目录和数据库
2. **历史导入**: 如果已有对话历史，K2D 会自动回溯导入所有历史对话
3. **实时收集**: 每轮对话结束后自动收集数据

### 数据收集内容

- 对话内容（用户消息、助手响应）
- 工具调用（参数和结果）
- Skill 使用情况
- 文件变更（Git 或快照模式）
- 配置变更

### 4 个 Skills

| Skill | 功能 | 触发示例 |
|-------|------|---------|
| **k2d-query** | 查询使用数据 | "查询 K2D 数据"、"使用统计" |
| **k2d-report** | 生成分析报告 | "生成报告"、"项目全景" |
| **k2d-extract** | 提取工作模式 | "提取模式"、"分析工作流" |
| **k2d-generate** | 生成知识资产 | "生成资产"、"创建规则" |

## 数据存储

```
meta/
├── k2d.db                    # SQLite 数据库
├── patterns/                 # 提取的模式
│   ├── workflows/
│   ├── skill-tactics/
│   └── tool-combos/
├── assets/                   # 生成的资产
│   ├── rules/
│   ├── templates/
│   └── skill-packs/
└── reports/                  # 生成的报告
```

## 使用示例

### 查询数据

对 Claude 说：
- "帮我查看 K2D 数据库的统计信息"
- "有多少个 session 记录"
- "最常用的工具是什么"

### 生成报告

对 Claude 说：
- "生成一份项目全景报告"
- "分析我的使用模式"

### 提取模式

对 Claude 说：
- "提取我的工作流模式"
- "分析 Skill 组合"

### 生成资产

对 Claude 说：
- "根据模式生成规则"
- "创建 CLAUDE.md 模板"

## 隐私

- 所有数据**本地存储**
- 敏感数据自动过滤
- 不发送任何数据到外部服务器

## 插件结构

```
.claude/plugins/k2d/
├── .claude-plugin/
│   └── plugin.json           # 插件元数据
├── skills/                   # 4 个 Skills
│   ├── k2d-query/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── schema.md
│   ├── k2d-report/
│   │   └── SKILL.md
│   ├── k2d-extract/
│   │   └── SKILL.md
│   └── k2d-generate/
│       └── SKILL.md
├── hooks/
│   ├── hooks.json            # Hook 配置
│   └── on-turn-end.js        # 数据收集 Hook (自动初始化)
└── README.md
```

## 开发

如果你想修改插件源码：

```bash
# 安装依赖
bun install

# 运行测试
bun test

# 重新编译 Hook
bun build ./src/hooks/on-turn-end.ts --outfile ./.claude/plugins/k2d/hooks/on-turn-end.js --target bun
```

## License

MIT
