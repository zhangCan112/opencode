# Agent 模块分析

Agent 系统的核心定义文件，负责 agent 配置管理、权限控制、提示词选择和动态生成。

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent 模块架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Config    │───▶│    state    │───▶│  Agent Map  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                   │            │
│         ▼                  ▼                   ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Permission  │    │   Prompt    │    │   Model     │     │
│  │  Defaults   │    │   Files     │    │  Provider   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心数据结构

### Info Schema (第24-49行)

定义单个 agent 的完整配置结构：

```typescript
const Info = z.object({
  name: z.string(), // agent 标识符
  description: z.string().optional(), // 描述文本
  mode: z.enum(["subagent", "primary", "all"]), // 运行模式
  native: z.boolean().optional(), // 是否原生 agent
  hidden: z.boolean().optional(), // 是否隐藏
  topP: z.number().optional(), // 采样参数
  temperature: z.number().optional(), // 温度参数
  color: z.string().optional(), // 显示颜色
  permission: PermissionNext.Ruleset, // 权限规则集
  model: z
    .object({
      // 指定模型
      modelID: z.string(),
      providerID: z.string(),
    })
    .optional(),
  variant: z.string().optional(), // 模型变体
  prompt: z.string().optional(), // 系统提示词
  options: z.record(z.string(), z.any()), // 扩展选项
  steps: z.number().int().positive().optional(), // 最大步数
})
```

### Agent Mode 类型

| Mode       | 说明     | 使用场景                     |
| ---------- | -------- | ---------------------------- |
| `primary`  | 主 agent | 用户直接交互，会话默认 agent |
| `subagent` | 子 agent | 被 Task 工具调用，并行执行   |
| `all`      | 通用     | 用户自定义 agent 默认值      |

---

## 逐行解析

### 导入部分 (第1-21行)

```typescript
// 第1-9行：核心依赖
import { Config } from "../config/config" // 配置管理
import z from "zod" // Schema 验证
import { Provider } from "../provider/provider" // 模型提供者
import { generateObject, streamObject } from "ai" // AI 生成
import { SystemPrompt } from "../session/system" // 系统提示词
import { Instance } from "../project/instance" // 项目实例
import { Truncate } from "../tool/truncation" // 截断工具
import { Auth } from "../auth" // 认证
import { ProviderTransform } from "../provider/transform" // 提供者转换

// 第11-15行：提示词文件导入
import PROMPT_GENERATE from "./generate.txt" // 动态生成 agent
import PROMPT_COMPACTION from "./prompt/compaction.txt" // 压缩提示词
import PROMPT_EXPLORE from "./prompt/explore.txt" // 探索提示词
import PROMPT_SUMMARY from "./prompt/summary.txt" // 摘要提示词
import PROMPT_TITLE from "./prompt/title.txt" // 标题提示词

// 第16-21行：工具依赖
import { PermissionNext } from "@/permission/next" // 权限系统
import { mergeDeep, pipe, sortBy, values } from "remeda" // 工具函数
import { Global } from "@/global" // 全局配置
import path from "path" // 路径处理
import { Plugin } from "@/plugin" // 插件系统
import { Skill } from "../skill" // 技能系统
```

### 权限默认配置 (第51-73行)

```typescript
const state = Instance.state(async () => {
  const cfg = await Config.get()

  // 获取技能目录白名单
  const skillDirs = await Skill.dirs()
  const whitelistedDirs = [Truncate.GLOB, ...skillDirs.map((dir) => path.join(dir, "*"))]

  // 构建默认权限配置
  const defaults = PermissionNext.fromConfig({
    "*": "allow",                    // 默认允许所有操作
    doom_loop: "ask",                // 死循环检测需询问
    external_directory: {
      "*": "ask",                    // 外部目录默认询问
      ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow"])),
    },
    question: "deny",                // 默认禁止提问
    plan_enter: "deny",              // 禁止进入计划模式
    plan_exit: "deny",               // 禁止退出计划模式
    read: {
      "*": "allow",                  // 允许读取所有文件
      "*.env": "ask",                // .env 文件需询问
      "*.env.*": "ask",              // .env.xxx 文件需询问
      "*.env.example": "allow",      // .env.example 允许读取
    },
  })
```

**关键点**：

- 使用 `Instance.state` 创建惰性加载状态
- 技能目录自动加入白名单
- `.env` 文件安全处理（参考 gitignore 规范）

### 原生 Agent 定义 (第76-202行)

#### build agent (第77-91行)

```typescript
build: {
  name: "build",
  description: "The default agent. Executes tools based on configured permissions.",
  options: {},
  permission: PermissionNext.merge(
    defaults,
    PermissionNext.fromConfig({
      question: "allow",    // 允许提问
      plan_enter: "allow",  // 允许进入计划模式
    }),
    user,
  ),
  mode: "primary",
  native: true,
}
```

**用途**：默认主 agent，具备完整工具执行能力。

#### plan agent (第92-114行)

```typescript
plan: {
  name: "plan",
  description: "Plan mode. Disallows all edit tools.",
  permission: PermissionNext.merge(
    defaults,
    PermissionNext.fromConfig({
      question: "allow",
      plan_exit: "allow",   // 允许退出计划模式
      external_directory: {
        [path.join(Global.Path.data, "plans", "*")]: "allow",
      },
      edit: {
        "*": "deny",        // 禁止编辑所有文件
        // 仅允许编辑计划文件
        [path.join(".opencode", "plans", "*.md")]: "allow",
        [path.relative(Instance.worktree, path.join(Global.Path.data, path.join("plans", "*.md")))]: "allow",
      },
    }),
    user,
  ),
  mode: "primary",
  native: true,
}
```

**用途**：计划模式，禁止编辑代码，仅允许编辑计划文件。

#### general agent (第115-129行)

```typescript
general: {
  name: "general",
  description: `General-purpose agent for researching complex questions...`,
  permission: PermissionNext.merge(
    defaults,
    PermissionNext.fromConfig({
      todoread: "deny",   // 禁止 todo 读取
      todowrite: "deny",  // 禁止 todo 写入
    }),
    user,
  ),
  options: {},
  mode: "subagent",
  native: true,
}
```

**用途**：通用子 agent，用于并行执行多步任务，禁止操作 todo。

#### explore agent (第130-156行)

```typescript
explore: {
  name: "explore",
  permission: PermissionNext.merge(
    defaults,
    PermissionNext.fromConfig({
      "*": "deny",         // 默认禁止所有
      grep: "allow",       // 仅允许搜索工具
      glob: "allow",
      list: "allow",
      bash: "allow",
      webfetch: "allow",
      websearch: "allow",
      codesearch: "allow",
      read: "allow",
      external_directory: {...},
    }),
    user,
  ),
  description: `Fast agent specialized for exploring codebases...`,
  prompt: PROMPT_EXPLORE,  // 使用专用提示词
  options: {},
  mode: "subagent",
  native: true,
}
```

**用途**：代码库探索专用 agent，配备专用提示词。

#### 隐藏 Agent (第157-202行)

```typescript
// compaction - 对话压缩
compaction: {
  name: "compaction",
  mode: "primary",
  native: true,
  hidden: true,            // 隐藏
  prompt: PROMPT_COMPACTION,
  permission: PermissionNext.merge(defaults, PermissionNext.fromConfig({"*": "deny"}), user),
  options: {},
}

// title - 标题生成
title: {
  name: "title",
  mode: "primary",
  options: {},
  native: true,
  hidden: true,
  temperature: 0.5,        // 特定温度
  permission: PermissionNext.merge(defaults, PermissionNext.fromConfig({"*": "deny"}), user),
  prompt: PROMPT_TITLE,
}

// summary - 摘要生成
summary: {
  name: "summary",
  mode: "primary",
  options: {},
  native: true,
  hidden: true,
  permission: PermissionNext.merge(defaults, PermissionNext.fromConfig({"*": "deny"}), user),
  prompt: PROMPT_SUMMARY,
}
```

**用途**：系统内部使用，不暴露给用户。

### 用户配置合并 (第205-232行)

```typescript
for (const [key, value] of Object.entries(cfg.agent ?? {})) {
  if (value.disable) {
    delete result[key] // 禁用 agent
    continue
  }
  let item = result[key]
  if (!item)
    // 创建新 agent
    item = result[key] = {
      name: key,
      mode: "all",
      permission: PermissionNext.merge(defaults, user),
      options: {},
      native: false,
    }
  // 合并用户配置
  if (value.model) item.model = Provider.parseModel(value.model)
  item.variant = value.variant ?? item.variant
  item.prompt = value.prompt ?? item.prompt // 提示词覆盖
  item.description = value.description ?? item.description
  item.temperature = value.temperature ?? item.temperature
  item.topP = value.top_p ?? item.topP
  item.mode = value.mode ?? item.mode
  item.color = value.color ?? item.color
  item.hidden = value.hidden ?? item.hidden
  item.name = value.name ?? item.name
  item.steps = value.steps ?? item.steps
  item.options = mergeDeep(item.options, value.options ?? {})
  item.permission = PermissionNext.merge(item.permission, PermissionNext.fromConfig(value.permission ?? {}))
}
```

**关键逻辑**：

1. `disable` 字段可删除任意 agent
2. 不存在的 key 创建新 agent
3. 所有配置使用 `??` 运算符，用户配置优先

### Truncate 白名单确保 (第234-248行)

```typescript
for (const name in result) {
  const agent = result[name]
  // 检查是否显式配置了 deny
  const explicit = agent.permission.some((r) => {
    if (r.permission !== "external_directory") return false
    if (r.action !== "deny") return false
    return r.pattern === Truncate.GLOB
  })
  if (explicit) continue // 用户明确禁止则跳过

  // 默认允许 Truncate 目录
  result[name].permission = PermissionNext.merge(
    result[name].permission,
    PermissionNext.fromConfig({ external_directory: { [Truncate.GLOB]: "allow" } }),
  )
}
```

**用途**：确保截断目录默认可访问，除非用户显式禁止。

### 工具函数 (第253-281行)

```typescript
// 获取单个 agent
export async function get(agent: string) {
  return state().then((x) => x[agent])
}

// 列出所有 agent，默认 agent 排在最前
export async function list() {
  const cfg = await Config.get()
  return pipe(
    await state(),
    values(),
    sortBy([(x) => (cfg.default_agent ? x.name === cfg.default_agent : x.name === "build"), "desc"]),
  )
}

// 获取默认 agent
export async function defaultAgent() {
  const cfg = await Config.get()
  const agents = await state()

  // 优先使用配置的默认 agent
  if (cfg.default_agent) {
    const agent = agents[cfg.default_agent]
    if (!agent) throw new Error(`default agent "${cfg.default_agent}" not found`)
    if (agent.mode === "subagent") throw new Error(`default agent "${cfg.default_agent}" is a subagent`)
    if (agent.hidden === true) throw new Error(`default agent "${cfg.default_agent}" is hidden`)
    return agent.name
  }

  // 否则找第一个可见的主 agent
  const primaryVisible = Object.values(agents).find((a) => a.mode !== "subagent" && a.hidden !== true)
  if (!primaryVisible) throw new Error("no primary visible agent found")
  return primaryVisible.name
}
```

### 动态生成 Agent (第283-338行)

```typescript
export async function generate(input: { description: string; model?: { providerID: string; modelID: string } }) {
  const cfg = await Config.get()
  const defaultModel = input.model ?? (await Provider.defaultModel())
  const model = await Provider.getModel(defaultModel.providerID, defaultModel.modelID)
  const language = await Provider.getLanguage(model)

  const system = [PROMPT_GENERATE]
  await Plugin.trigger("experimental.chat.system.transform", { model }, { system })
  const existing = await list()

  const params = {
    experimental_telemetry: {...},
    temperature: 0.3,
    messages: [
      ...system.map((item): ModelMessage => ({
        role: "system",
        content: item,
      })),
      {
        role: "user",
        content: `Create an agent configuration based on this request: \"${input.description}\".\n\nIMPORTANT: The following identifiers already exist and must NOT be used: ${existing.map((i) => i.name).join(", ")}\n  Return ONLY the JSON object, no other text, do not wrap in backticks`,
      },
    ],
    model: language,
    schema: z.object({
      identifier: z.string(),
      whenToUse: z.string(),
      systemPrompt: z.string(),
    }),
  }

  // OpenAI OAuth 特殊处理
  if (defaultModel.providerID === "openai" && (await Auth.get(defaultModel.providerID))?.type === "oauth") {
    const result = streamObject({...})
    for await (const part of result.fullStream) {
      if (part.type === "error") throw part.error
    }
    return result.object
  }

  const result = await generateObject(params)
  return result.object
}
```

**流程**：

1. 获取默认模型
2. 加载生成提示词
3. 触发插件钩子
4. 构建请求，排除已存在标识符
5. 返回 `{identifier, whenToUse, systemPrompt}`

---

## 提示词选择机制

系统提示词分为两层：**Agent 层** 和 **Provider 层**。

### 两层提示词架构

```
┌─────────────────────────────────────────────────────────────┐
│                    完整系统提示词构成                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Agent 层提示词 (可选)                    │   │
│   │  agent.prompt - agent 特定的系统指令                  │   │
│   └─────────────────────────────────────────────────────┘   │
│                          +                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Provider 层提示词 (必需)                 │   │
│   │  SystemPrompt.provider(model) - 模型相关的提示词      │   │
│   └─────────────────────────────────────────────────────┘   │
│                          +                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Environment 层 (动态)                   │   │
│   │  SystemPrompt.environment(model) - 环境信息          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent 层提示词 (agent.ts 第152、162、186、201行)

| Agent        | prompt 字段         | 文件                    | 用途             |
| ------------ | ------------------- | ----------------------- | ---------------- |
| `build`      | 无                  | -                       | 依赖 Provider 层 |
| `plan`       | 无                  | -                       | 依赖 Provider 层 |
| `general`    | 无                  | -                       | 依赖 Provider 层 |
| `explore`    | `PROMPT_EXPLORE`    | `prompt/explore.txt`    | 代码库探索指令   |
| `compaction` | `PROMPT_COMPACTION` | `prompt/compaction.txt` | 对话压缩摘要     |
| `title`      | `PROMPT_TITLE`      | `prompt/title.txt`      | 会话标题生成     |
| `summary`    | `PROMPT_SUMMARY`    | `prompt/summary.txt`    | PR 风格摘要      |

### Provider 层提示词 (session/system.ts 第19-27行)

根据模型 ID 选择对应的提示词文件：

| 模型匹配规则          | 提示词文件                | 说明             |
| --------------------- | ------------------------- | ---------------- |
| `gpt-5`               | `prompt/codex_header.txt` | GPT-5 专用       |
| `gpt-*` / `o1` / `o3` | `prompt/beast.txt`        | OpenAI 推理模型  |
| `gemini-*`            | `prompt/gemini.txt`       | Google Gemini    |
| `claude`              | `prompt/anthropic.txt`    | Anthropic Claude |
| `trinity`             | `prompt/trinity.txt`      | Trinity 模型     |
| 其他                  | `prompt/qwen.txt`         | 默认 (Qwen 等)   |

### Provider 选择代码 (session/system.ts)

```typescript
export function provider(model: Provider.Model) {
  if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX]
  if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3")) return [PROMPT_BEAST]
  if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
  if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
  return [PROMPT_ANTHROPIC_WITHOUT_TODO] // 默认
}
```

### 选择流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    提示词选择流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐                                       │
│   │ 获取 agent 配置 │                                       │
│   └────────┬────────┘                                       │
│            │                                                │
│            ▼                                                │
│   ┌─────────────────┐    是    ┌─────────────────┐         │
│   │ agent.prompt?    │────────▶│ 使用 agent prompt│         │
│   └────────┬────────┘          └─────────────────┘         │
│            │ 否                                               │
│            ▼                                                │
│   ┌─────────────────────────────────────────────────┐       │
│   │ SystemPrompt.provider(model)                    │       │
│   │ 根据模型 ID 选择对应的 provider 提示词           │       │
│   └─────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 提示词文件完整对照

**Agent 专用提示词 (agent/prompt/)**

| 文件                    | Agent      | 用途               |
| ----------------------- | ---------- | ------------------ |
| `prompt/explore.txt`    | explore    | 代码库探索专家指令 |
| `prompt/compaction.txt` | compaction | 对话压缩摘要       |
| `prompt/summary.txt`    | summary    | PR 风格摘要生成    |
| `prompt/title.txt`      | title      | 会话标题生成       |
| `generate.txt`          | generate() | 动态创建 agent     |

**Provider 模型提示词 (session/prompt/)**

| 文件               | 模型      | 特点                            |
| ------------------ | --------- | ------------------------------- |
| `anthropic.txt`    | Claude    | 包含完整工具使用指南、Todo 管理 |
| `beast.txt`        | GPT/O1/O3 | 强调自主完成、迭代解决问题      |
| `gemini.txt`       | Gemini    | 模型适配                        |
| `codex_header.txt` | GPT-5     | 专用头部                        |
| `trinity.txt`      | Trinity   | 模型适配                        |
| `qwen.txt`         | 默认      | 不含 Todo 的版本                |

---

## 关键设计模式

### 1. 惰性状态初始化

```typescript
const state = Instance.state(async () => {
  // 仅在首次访问时执行
})
```

### 2. 权限分层合并

```typescript
PermissionNext.merge(
  defaults,              // 系统默认
  PermissionNext.fromConfig({...}),  // 特定配置
  user,                  // 用户配置
)
```

优先级：用户配置 > 特定配置 > 默认配置

### 3. 配置覆盖模式

```typescript
item.prompt = value.prompt ?? item.prompt
```

使用 `??` 运算符实现优雅覆盖。

---

## 文件依赖关系

```
agent.ts
├── config/config.ts      ← 配置读取
├── provider/provider.ts  ← 模型获取
├── session/system.ts     ← 系统提示词
├── project/instance.ts   ← 项目实例
├── permission/next.ts    ← 权限系统
├── auth/index.ts         ← 认证状态
├── plugin/index.ts       ← 插件钩子
├── skill/index.ts        ← 技能目录
├── tool/truncation.ts    ← 截断配置
│
├── prompt/
│   ├── explore.txt
│   ├── compaction.txt
│   ├── summary.txt
│   └── title.txt
│
└── generate.txt
```

---

## 扩展点

### 添加新的原生 agent

1. 在 `result` 对象中添加定义
2. 可选：添加专用提示词文件
3. 配置权限规则

### 用户自定义 agent

通过配置文件：

```json
{
  "agent": {
    "my-agent": {
      "description": "我的自定义 agent",
      "mode": "primary",
      "prompt": "你是一个专门的...",
      "permission": {
        "*": "deny",
        "read": "allow"
      }
    }
  }
}
```

### 动态生成

调用 `Agent.generate()` 让 AI 自动创建 agent 配置。
