# Skill 提示词注入

Skill 是一种可动态加载的领域知识模块，通过多种方式注入到提示词系统中。

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Skill 注入架构                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   SKILL.md 文件                       │    │
│  │  ---                                                 │    │
│  │  name: code-review                                  │    │
│  │  description: Review code quality                   │    │
│  │  ---                                                 │    │
│  │  # 详细的指令内容...                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Skill.state() 加载                       │    │
│  │  扫描多个目录，解析 SKILL.md 文件                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                 │
│           ┌───────────────┼───────────────┐                │
│           ▼               ▼               ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Skill Tool  │  │  Command    │  │  Permission │        │
│  │ 模型主动调用 │  │ 斜杠命令    │  │  白名单     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Skill 加载流程

### 扫描目录

`skill/skill.ts` 第47-50行

```typescript
const EXTERNAL_DIRS = [".claude", ".agents"]
const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
const OPENCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
```

### 加载优先级

| 顺序 | 目录                   | 说明              |
| ---- | ---------------------- | ----------------- |
| 1    | `~/.claude/skills/`    | 全局外部 skills   |
| 2    | `~/.agents/skills/`    | 全局外部 skills   |
| 3    | `项目/.claude/skills/` | 项目级外部 skills |
| 4    | `项目/.agents/skills/` | 项目级外部 skills |
| 5    | `.opencode/skill/`     | Opencode 专用     |
| 6    | `config.skills.paths`  | 配置指定路径      |
| 7    | `config.skills.urls`   | 远程 URL          |

### SKILL.md 格式

```markdown
---
name: code-review
description: Review code for quality and best practices
---

# Code Review Skill

You are a code reviewer. When reviewing code:

1. Check for bugs and errors
2. Verify coding standards
3. Suggest improvements
```

---

## 注入方式一：Skill Tool

### 定义位置

`tool/skill.ts`

### 工作流程

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  工具描述中列出  │────▶│   模型选择调用   │────▶│   返回内容给模型  │
│  available_skills│     │   skill 工具     │     │   作为工具结果   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 工具描述生成

`tool/skill.ts` 第22-46行

```typescript
const description = [
  "Load a specialized skill that provides domain-specific instructions...",
  "",
  "<available_skills>",
  ...accessibleSkills.flatMap((skill) => [
    `  <skill>`,
    `    <name>${skill.name}</name>`,
    `    <description>${skill.description}</description>`,
    `    <location>${pathToFileURL(skill.location).href}</location>`,
    `  </skill>`,
  ]),
  "</available_skills>",
].join("\n")
```

### 工具执行返回

`tool/skill.ts` 第99-115行

```typescript
return {
  title: `Loaded skill: ${skill.name}`,
  output: [
    `<skill_content name="${skill.name}">`,
    `# Skill: ${skill.name}`,
    skill.content.trim(),
    `Base directory for this skill: ${base}`,
    "<skill_files>",
    files,
    "</skill_files>",
    "</skill_content>",
  ].join("\n"),
}
```

### 权限检查

`tool/skill.ts` 第14-20行

```typescript
const accessibleSkills = agent
  ? skills.filter((skill) => {
      const rule = PermissionNext.evaluate("skill", skill.name, agent.permission)
      return rule.action !== "deny"
    })
  : skills
```

---

## 注入方式二：Command

### 定义位置

`command/index.ts` 第125-138行

```typescript
// Add skills as invokable commands
for (const skill of await Skill.all()) {
  if (result[skill.name]) continue
  result[skill.name] = {
    name: skill.name,
    description: skill.description,
    source: "skill",
    get template() {
      return skill.content
    },
    hints: [],
  }
}
```

### 调用流程

`session/prompt.ts` 第1744-1792行

```typescript
export async function command(input: CommandInput) {
  const command = await Command.get(input.command)
  const template = await command.template

  // 替换 $1, $2 等占位符
  const withArgs = template.replaceAll(placeholderRegex, ...)

  // 执行 shell 命令（如果有）
  // ...
}
```

### 使用方式

```
/code-review main.ts
```

---

## 注入方式三：权限白名单

### 定义位置

`agent/agent.ts` 第54-62行

```typescript
const skillDirs = await Skill.dirs()
const whitelistedDirs = [Truncate.GLOB, ...skillDirs.map((dir) => path.join(dir, "*"))]

const defaults = PermissionNext.fromConfig({
  // ...
  external_directory: {
    "*": "ask",
    ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow"])),
  },
  // ...
})
```

### 作用

确保所有 agent 默认可以访问 skill 目录中的文件，无需额外权限确认。

---

## 完整注入流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    完整提示词构成                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [system]                                                   │
│  ├── SystemPrompt.provider(model)                          │
│  ├── SystemPrompt.environment(model)                       │
│  ├── InstructionPrompt.system() ← AGENTS.md 等             │
│  └── agent.prompt (如果有)                                  │
│                                                             │
│  [user]                                                     │
│  ├── 用户实际输入                                            │
│  └── synthetic parts (动态注入)                             │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│  以下为 Skill 相关注入：                                     │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  [tool description] ← Skill Tool                           │
│  └── <available_skills> 列出所有可用 skills                 │
│                                                             │
│  [tool result] ← 模型调用 skill 工具后                      │
│  └── <skill_content> skill 完整内容                         │
│                                                             │
│  [command] ← 用户使用斜杠命令                                │
│  └── skill.content 作为 template                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三种注入方式对比

| 方式       | 触发者 | 时机         | 内容位置 |
| ---------- | ------ | ------------ | -------- |
| Skill Tool | 模型   | 运行时按需   | 工具结果 |
| Command    | 用户   | 会话开始时   | 用户消息 |
| Permission | 系统   | Agent 初始化 | 权限规则 |

---

## 关键代码位置

| 功能             | 文件                | 行号      |
| ---------------- | ------------------- | --------- |
| Skill 定义和加载 | `skill/skill.ts`    | 17-189    |
| Skill Tool 定义  | `tool/skill.ts`     | 10-123    |
| Command 注册     | `command/index.ts`  | 125-138   |
| 权限白名单       | `agent/agent.ts`    | 54-62     |
| Command 执行     | `session/prompt.ts` | 1744-1792 |
