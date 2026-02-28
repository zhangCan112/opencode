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

### 4.2 提示词选择逻辑

文件：session/llm.ts:72

```typescript
...(input.agent.prompt ? [input.agent.prompt] : isCodex ? [] : SystemPrompt.provider(input.model)),
```

优先级：

1. agent.prompt 存在 → 使用 agent.prompt
2. agent.prompt 不存在 → 使用 SystemPrompt.provider()

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

阅读要点：

- [ ] Skill 扫描目录
- [ ] Skill Tool 实现
- [ ] 三种注入方式对比

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
