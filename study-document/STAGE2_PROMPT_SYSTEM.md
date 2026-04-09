# 阶段二：提示词系统 — 深入理解多层提示词设计

本阶段目标是深入理解 OpenCode 的多层提示词设计，掌握系统提示词、Agent 提示词、动态注入的完整架构。

---

## 一、提示词系统概述

OpenCode 采用多层提示词架构，不同来源的提示词按优先级叠加，最终构成完整的系统提示词。

### 1.1 提示词层次结构

```
┌─────────────────────────────────────────────────────────────┐
│                    完整提示词构成                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Layer 1: Provider 提示词 (system role)              │    │
│  │ 根据模型 ID 选择：anthropic/beast/gemini/qwen 等    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          +                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Layer 2: Environment 信息 (system role)            │    │
│  │ 工作目录、平台、日期、git 状态等                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          +                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Layer 3: Instruction 文件 (system role)            │    │
│  │ AGENTS.md / CLAUDE.md / 项目自定义指令             │    │
│  └─────────────────────────────────────────────────────┘    │
│                          +                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Layer 4: Agent 专用提示词 (system role)            │    │
│  │ explore / compaction / title / summary 等         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ──────────────────────────────────────────────────────    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Layer 5: 动态注入 (user message - synthetic parts) │    │
│  │ plan 模式提醒 / 最大步数提醒 / 构建切换提醒         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心文件位置

| 功能           | 文件路径               | 行号      |
| -------------- | ---------------------- | --------- |
| 提示词加载入口 | session/llm.ts         | 67-80     |
| Provider 选择  | session/system.ts      | 19-27     |
| 环境信息构建   | session/system.ts      | 29-53     |
| 指令文件加载   | session/instruction.ts | 117-142   |
| 动态注入       | session/prompt.ts      | 1321-1369 |

---

## 三、Provider 提示词

### 3.1 选择逻辑

文件：session/system.ts:19-27

```typescript
export function provider(model: Provider.Model) {
  if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX]
  if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3")) return [PROMPT_BEAST]
  if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
  if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
  return [PROMPT_ANTHROPIC_WITHOUT_TODO]
}
```

### 3.2 提示词文件对照

| 文件                 | 模型      | 大小 |
| -------------------- | --------- | ---- |
| prompt/anthropic.txt | Claude    | ~8KB |
| prompt/beast.txt     | GPT/O1/O3 | ~5KB |
| prompt/gemini.txt    | Gemini    | -    |
| prompt/qwen.txt      | 默认      | -    |

### 3.3 典型 Provider 提示词内容

#### Anthropic (Claude)

- 设定 OpenCode 身份
- 工具使用策略
- TodoWrite 任务管理
- 代码引用格式

#### Beast (GPT/O1/O3)

- 强调自主完成
- 迭代解决问题
- 互联网研究要求
- 严格测试验证

---

## 四、Agent 专用提示词

### 4.1 Agent 定义

文件：agent/agent.ts:76-202

| Agent      | Mode             | 提示词         | 用途         |
| ---------- | ---------------- | -------------- | ------------ |
| build      | primary          | 无             | 默认主 agent |
| plan       | primary          | 无             | 计划模式     |
| general    | subagent         | 无             | 通用子 agent |
| explore    | subagent         | explore.txt    | 代码库探索   |
| compaction | primary (hidden) | compaction.txt | 对话压缩     |
| title      | primary (hidden) | title.txt      | 标题生成     |
| summary    | primary (hidden) | summary.txt    | 摘要生成     |

### 4.2 提示词选择逻辑（重要）

文件：session/llm.ts:70-79

```typescript
// use agent prompt otherwise provider prompt
// For Codex sessions, skip SystemPrompt.provider() since it's sent via options.instructions
...(input.agent.prompt ? [input.agent.prompt] : isCodex ? [] : SystemPrompt.provider(input.model)),
// any custom prompt passed into this call
...input.system,
// any custom prompt from last user message
...(input.user.system ? [input.user.system] : []),
```

**关键结论：Agent 提示词和 Provider 提示词是「替代关系」，不是叠加关系！**

| 条件                           | 结果                                   |
| ------------------------------ | -------------------------------------- |
| agent.prompt 存在              | 使用 agent.prompt                      |
| agent.prompt 不存在 + 非 Codex | 使用 provider prompt                   |
| Codex 模式                     | 跳过（通过 options.instructions 发送） |

**完整优先级顺序：**

1. **agent.prompt** （或 provider prompt 作为后备）
2. **input.system** （自定义传入）
3. **user.system** （用户消息携带）

所有内容用 "\n" 连接成单一系统消息。

### 4.3 各 Agent 提示词内容

#### Explore Agent

你是一个文件搜索专家。擅长彻底地浏览和探索代码库。

优势：

- 使用 glob 模式快速查找文件
- 使用正则表达式搜索代码和文本
- 读取和分析文件内容

#### Compaction Agent

你是一个有用的 AI 助手，负责总结对话。

当被要求总结时，提供详细但简洁的对话摘要。

#### Summary Agent

总结这个对话中做了什么。像写 PR 描述一样写。

规则：

- 最多 2-3 句话
- 描述所做的更改，而不是过程
- 用第一人称写

#### Title Agent

你是一个标题生成器。你只输出一个线程标题。

规则：

- 单行
- 不超过 50 个字符
- 使用与用户消息相同的语言

---

## 五、动态注入机制 (Synthetic Parts)

### 5.1 什么是 Synthetic Parts

不是传统的系统提示词，而是作为 user 消息的一部分动态注入的内容。

### 5.2 实现位置

文件：session/prompt.ts:1321-1369

```typescript
async function insertReminders(input: { messages; agent; session }) {
  const userMessage = input.messages.findLast((msg) => msg.info.role === "user")

  if (input.agent.name === "plan") {
    userMessage.parts.push({
      type: "text",
      text: PROMPT_PLAN,
      synthetic: true,
    })
  }
}
```

### 5.3 动态注入类型

| 注入内容     | 条件                  | 文件                    |
| ------------ | --------------------- | ----------------------- |
| PROMPT_PLAN  | agent.name === "plan" | prompt/plan.txt         |
| BUILD_SWITCH | 从 plan 切换到 build  | prompt/build-switch.txt |
| MAX_STEPS    | 达到最大步数          | prompt/max-steps.txt    |

### 5.4 为什么用 Synthetic Parts

| 方式           | 优点                 | 缺点                     |
| -------------- | -------------------- | ------------------------ |
| 系统提示词     | 模型优先级高         | 无法根据会话状态动态修改 |
| Synthetic Part | 可动态注入、条件控制 | 混在用户消息中           |

---

## 六、指令文件加载 (AGENTS.md)

### 6.1 加载逻辑

文件：session/instruction.ts:117-142

```typescript
export async function system() {
  const config = await Config.get()
  const paths = await systemPaths()

  const files = Array.from(paths).map(async (p) => {
    const content = await Filesystem.readText(p).catch(() => "")
    return content ? "Instructions from: " + p + "\n" + content : ""
  })

  return Promise.all([...files, ...fetches]).then((result) => result.filter(Boolean))
}
```

### 6.2 扫描目录

文件：session/instruction.ts:14-18

```typescript
const FILES = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md"]
```

### 6.3 查找优先级

1. 项目根目录向上搜索
2. 全局 ~/.claude/CLAUDE.md
3. 配置指定的 config.instructions 路径
4. 远程 URL

---

## 七、Skill 提示词注入

### 7.1 三种注入方式

| 方式       | 触发者       | 注入位置             |
| ---------- | ------------ | -------------------- |
| Skill Tool | 模型主动调用 | 工具结果 (tool role) |
| Command    | 用户斜杠命令 | 用户消息 (user role) |
| Permission | 系统自动     | 权限规则             |

### 7.2 Skill Tool 实现

文件：tool/skill.ts

1. 工具描述中列出 available_skills
2. 模型选择调用 skill 工具
3. 返回 skill_content 包含完整内容

### 7.3 Skill 目录白名单

文件：agent/agent.ts:54-62

```typescript
const skillDirs = await Skill.dirs()
const whitelistedDirs = [Truncate.GLOB, ...skillDirs.map((dir) => path.join(dir, "*"))]
```

---

## 八、完整提示词构建流程

### 8.1 代码流程

文件：session/llm.ts:67-80

```typescript
const system = []
system.push(
  [
    ...(input.agent.prompt ? [input.agent.prompt] : SystemPrompt.provider(input.model)),
    ...input.system,
    ...(input.user.system ? [input.user.system] : []),
  ]
    .filter((x) => x)
    .join("\n"),
)
```

### 8.2 完整调用链

```
SessionPrompt.prompt()
    ↓
SessionPrompt.loop()
    ↓
构建 system 数组:
    ├── SystemPrompt.provider(model)
    ├── SystemPrompt.environment(model)
    └── InstructionPrompt.system()
    ↓
LLM.stream()
    ↓
messages:
    ├── { role: "system", content: [...] }
    ├── { role: "user", parts: [...] }
    ├── { role: "assistant", ... }
    └── { role: "tool", ... }
```

---

## 九、提示词大小估算

### 9.1 各部分大小

| 组成部分        | 大小     | 说明                  |
| --------------- | -------- | --------------------- |
| Provider 提示词 | ~8-15 KB | anthropic/beast       |
| 环境信息        | ~0.5 KB  | 目录、平台、日期      |
| AGENTS.md       | ~1-10 KB | 因项目而异            |
| 工具描述        | ~38 KB   | 所有工具描述          |
| Agent 提示词    | ~1-5 KB  | explore/compaction 等 |

### 9.2 典型场景

```
最小场景: ~50 KB (约 12K tokens)
典型场景: ~70 KB (约 17K tokens)
大型项目: ~100 KB+ (约 25K tokens)
```

### 9.3 上下文窗口

| 模型              | 上下文窗口  |
| ----------------- | ----------- |
| big-pickle (默认) | 200K tokens |
| 多数模型          | 128K - 262K |
| 长上下文模型      | 1M - 2M     |

系统提示词占比约 10-15%。

---

## 十、阶段二学习任务

### 任务 1：理解 Provider 提示词选择

目标：掌握如何根据模型选择提示词

文件：session/system.ts

阅读要点：

- [ ] provider() 函数的匹配逻辑
- [ ] 各提示词文件的实际内容
- [ ] 为什么不同模型需要不同提示词

---

### 任务 2：理解 Agent 提示词

目标：掌握 Agent 级别提示词的设计

文件：agent/agent.ts

阅读要点：

- [ ] 各 Agent 的 prompt 字段定义
- [ ] 有无 prompt 的区别
- [ ] 提示词如何与 Provider 提示词叠加

---

### 任务 3：理解动态注入机制

目标：掌握 Synthetic Parts 原理

文件：session/prompt.ts:1321-1369

阅读要点：

- [ ] insertReminders 函数逻辑
- [ ] synthetic: true 的含义
- [ ] 为什么不用系统提示词

---

### 任务 4：理解指令文件加载

目标：掌握 AGENTS.md 加载机制

文件：session/instruction.ts

阅读要点：

- [ ] systemPaths() 查找逻辑
- [ ] 支持的文件名
- [ ] 远程 URL 支持

---

### 任务 5：理解 Skill 注入

目标：掌握 Skill 的多种注入方式

文件：skill/skill.ts, tool/skill.ts

---

#### 5.1 Skill 系统概述

Skill 是一个可动态加载的领域知识模块，类似于 Claude Code 的 skill 系统。

##### SKILL.md 格式

```markdown
---
name: code-review
description: Review code for quality and best practices
---

# Code Review Skill

你是一个代码审查专家...
```

---

#### 5.2 Skill 扫描目录 (skill/skill.ts)

##### 第 45-50 行：定义扫描目录

```typescript
// External skill directories to search for (project-level and global)
// These follow the directory layout used by Claude Code and other agents.
const EXTERNAL_DIRS = [".claude", ".agents"] // 外部目录名
const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md" // 外部 Skill 模式
const OPENCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md" // OpenCode 模式
const SKILL_PATTERN = "**/SKILL.md" // 通配模式
```

| 目录                  | 说明          |
| --------------------- | ------------- |
| `.claude/skills/`     | 全局外部      |
| `.agents/skills/`     | 全局外部      |
| `.opencode/skill/`    | OpenCode 专用 |
| `config.skills.paths` | 用户配置路径  |
| `config.skills.urls`  | 远程 URL      |

##### 第 52-88 行：addSkill 函数

```typescript
export const state = Instance.state(async () => {
  const skills: Record<string, Info> = {}
  const dirs = new Set<string>()

  const addSkill = async (match: string) => {                    // match = 文件路径
    // 1. 解析 Markdown 文件
    const md = await ConfigMarkdown.parse(match).catch((err) => { // 解析 frontmatter
      Bus.publish(Session.Event.Error, {...})                     // 发布错误事件
      log.error("failed to load skill", { skill: match, err })
      return undefined
    })

    if (!md) return                                              // 解析失败则跳过

    // 2. 提取 name 和 description
    const parsed = Info.pick({ name: true, description: true }).safeParse(md.data)
    if (!parsed.success) return                                  // 验证失败则跳过

    // 3. 警告重复名称
    if (skills[parsed.data.name]) {
      log.warn("duplicate skill name", {...})                   // 记录警告
    }

    dirs.add(path.dirname(match))                                 // 记录目录

    // 4. 存储 Skill 信息
    skills[parsed.data.name] = {
      name: parsed.data.name,
      description: parsed.data.description,
      location: match,
      content: md.content,                                       // Markdown 正文
    }
  }
```

关键点：

- 解析 Markdown frontmatter 获取 name/description
- 正文作为 content 存储
- 重复名称会警告但覆盖

##### 第 90-102 行：scanExternal 函数

```typescript
const scanExternal = async (root: string, scope: "global" | "project") => {
  return Glob.scan(EXTERNAL_SKILL_PATTERN, {
    // 扫描 skills/**/SKILL.md
    cwd: root,
    absolute: true,
    include: "file",
    dot: true,
    symlink: true,
  })
    .then((matches) => Promise.all(matches.map(addSkill))) // 并行添加
    .catch((error) => {
      log.error(`failed to scan ${scope} skills`, { dir: root, error })
    })
}
```

##### 第 106-120 行：扫描外部目录

```typescript
if (!Flag.OPENCODE_DISABLE_EXTERNAL_SKILLS) {
  // 检查是否禁用
  // 1. 扫描全局目录 (~/.claude/skills/, ~/.agents/skills/)
  for (const dir of EXTERNAL_DIRS) {
    const root = path.join(Global.Path.home, dir)
    if (!(await Filesystem.isDir(root))) continue // 跳过不存在的目录
    await scanExternal(root, "global")
  }

  // 2. 扫描项目目录 (向上搜索 .claude/, .agents/)
  for await (const root of Filesystem.up({
    targets: EXTERNAL_DIRS,
    start: Instance.directory,
    stop: Instance.worktree,
  })) {
    await scanExternal(root, "project")
  }
}
```

扫描顺序：全局 → 项目（项目级覆盖全局）

##### 第 122-133 行：扫描 OpenCode 目录

```typescript
// Scan .opencode/skill/ directories
for (const dir of await Config.directories()) {
  const matches = await Glob.scan(OPENCODE_SKILL_PATTERN, {
    cwd: dir,
    absolute: true,
    include: "file",
    symlink: true,
  })
  for (const match of matches) {
    await addSkill(match)
  }
}
```

##### 第 135-153 行：扫描配置路径

```typescript
// Scan additional skill paths from config
const config = await Config.get()
for (const skillPath of config.skills?.paths ?? []) {
  const expanded = skillPath.startsWith("~/") ? path.join(os.homedir(), skillPath.slice(2)) : skillPath
  const resolved = path.isAbsolute(expanded) ? expanded : path.join(Instance.directory, expanded)
  // ...扫描文件
}
```

##### 第 155-170 行：远程 URL

```typescript
// Download and load skills from URLs
for (const url of config.skills?.urls ?? []) {
  const list = await Discovery.pull(url) // 下载列表
  for (const dir of list) {
    // 扫描 SKILL.md
  }
}
```

---

#### 5.3 Skill Tool 实现 (tool/skill.ts)

##### 第 10-46 行：Tool 定义

```typescript
export const SkillTool = Tool.define("skill", async (ctx) => {
  const skills = await Skill.all()

  // 1. 按权限过滤
  const agent = ctx?.agent
  const accessibleSkills = agent
    ? skills.filter((skill) => {
        const rule = PermissionNext.evaluate("skill", skill.name, agent.permission)
        return rule.action !== "deny"                           // deny 权限的 Skill 不显示
      })
    : skills

  // 2. 构建工具描述（包含 available_skills 列表）
  const description = [
    "Load a specialized skill...",
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

关键点：

- 根据 agent 权限过滤可用 Skill
- 在工具描述中列出 `<available_skills>`

##### 第 54-56 行：参数定义

```typescript
const parameters = z.object({
  name: z.string().describe(`The name of skill from available_skills...`),
})
```

##### 第 61-75 行：执行逻辑

```typescript
async execute(params, ctx) {
  const skill = await Skill.get(params.name)

  if (!skill) {
    throw new Error(`Skill "${params.name}" not found...`)
  }

  // 1. 权限检查
  await ctx.ask({
    permission: "skill",
    patterns: [params.name],
    always: [params.name],
    metadata: {},
  })

  // 2. 获取 Skill 目录和文件列表
  const dir = path.dirname(skill.location)
  const files = await iife(async () => {
    // 使用 Ripgrep 扫描目录中的文件（最多 10 个）
    const arr = []
    for await (const file of Ripgrep.files({ cwd: dir, ... })) {
      if (file.includes("SKILL.md")) continue                     // 跳过自身
      arr.push(path.resolve(dir, file))
      if (arr.length >= limit) break
    }
    return arr
  })

  // 3. 返回 Skill 内容
  return {
    title: `Loaded skill: ${skill.name}`,
    output: [
      `<skill_content name="${skill.name}">`,
      `# Skill: ${skill.name}`,
      "",                                                    // 空行
      skill.content.trim(),                                  // SKILL.md 正文
      "",
      `Base directory for this skill: ${base}`,
      "<skill_files>",
      files,                                                 // 文件列表
      "</skill_files>",
      "</skill_content>",
    ].join("\n"),
  }
}
```

---

#### 5.4 三种注入方式对比

| 方式           | 触发者       | 注入位置               | 时机         |
| -------------- | ------------ | ---------------------- | ------------ |
| **Skill Tool** | 模型主动调用 | 工具返回值 (tool role) | 运行时       |
| **Command**    | 用户斜杠命令 | 用户消息 (user role)   | 会话开始     |
| **Permission** | 系统自动     | 权限规则               | Agent 初始化 |

##### Skill Tool 注入流程

```
1. 构建工具时
   ToolRegistry.tools() → SkillTool → description 包含 <available_skills>

2. 模型收到请求
   看到可用 Skill 列表

3. 模型决定调用
   模型选择调用 skill 工具，传入 skill name

4. 工具执行
   SkillTool.execute() → 返回 <skill_content> 块

5. 注入到对话
   工具结果作为 tool role 消息，包含 <skill_content>

6. 模型继续推理
   基于 Skill 内容生成响应
```

##### 注入内容格式

```xml
<skill_content name="code-review">
# Skill: code-review

你是一个代码审查专家...

<skill_files>
/path/to/skill/script.sh
/path/to/skill/reference.md
</skill_files>
</skill_content>
```

---

#### 5.5 Skill 权限控制

文件：tool/skill.ts:14-20

```typescript
const accessibleSkills = agent
  ? skills.filter((skill) => {
      const rule = PermissionNext.evaluate("skill", skill.name, agent.permission)
      return rule.action !== "deny" // 只显示非 deny 的
    })
  : skills
```

默认权限（agent/agent.ts）：

```typescript
{
  "*": "deny",                                               // 默认禁止
  skill: "allow",                                             // 允许使用 skill
}
```

---

#### 5.6 总结

| 要点       | 说明                                                      |
| ---------- | --------------------------------------------------------- |
| Skill 定义 | SKILL.md 文件，frontmatter 包含 name/description          |
| 扫描来源   | 5 种目录：.claude, .agents, .opencode, config.paths, URLs |
| 加载时机   | 启动时加载到 state，后续直接使用                          |
| 注入方式   | 模型主动调用 Tool → 返回 <skill_content>                  |
| 权限控制   | 根据 agent.permission 过滤可用 Skill                      |

---

## 十一、阶段二总结

通过本阶段学习，你应该理解：

1. **多层提示词架构** — Provider → Environment → Instruction → Agent → Dynamic
2. **Provider 选择逻辑** — 根据模型 ID 自动匹配
3. **Agent 提示词** — 专用提示词与 Provider 提示词叠加
4. **动态注入** — Synthetic Parts 的原理和优势
5. **指令文件** — AGENTS.md 的加载和优先级
6. **Skill 系统** — 多种注入方式

---

## 十二、后续阶段

- **阶段三：** Agent 系统 — 掌握 Agent 定义与权限机制
- **阶段四：** 上下文管理 — 理解消息压缩与状态维护
- **阶段五：** 工具系统 — 学习工具注册与执行流程

---

## 十三、参考资源

| 资源                   | 说明            |
| ---------------------- | --------------- |
| study-document/prompt/ | 提示词中文翻译  |
| session/system.ts      | Provider 提示词 |
| session/llm.ts         | 提示词构建      |
| session/prompt.ts      | 动态注入        |
| session/instruction.ts | 指令加载        |
| agent/agent.ts         | Agent 定义      |
| skill/skill.ts         | Skill 系统      |
