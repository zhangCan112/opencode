# SessionPrompt 模块详解

本文档详细介绍 OpenCode 核心模块 `src/session/prompt.ts` 的设计与实现。

---

## 一、模块概述

`prompt.ts` 是 OpenCode 的**核心处理模块**，负责：

- 接收用户输入并创建消息
- 管理对话循环（LLM 调用 → 工具执行 → 循环）
- 处理 Agent 切换、上下文压缩、计划模式等高级功能

**文件规模：** 1959 行代码

---

## 二、核心入口函数

### 2.1 `prompt()` — 主入口

```typescript
// prompt.ts:158-185
export const prompt = fn(PromptInput, async (input) => {
  const session = await Session.get(input.sessionID)
  await SessionRevert.cleanup(session)

  const message = await createUserMessage(input) // 创建用户消息
  await Session.touch(input.sessionID)

  // 处理权限兼容性问题
  const permissions: PermissionNext.Ruleset = []
  // ...

  if (input.noReply === true) {
    return message // 不需要回复，直接返回
  }

  return loop({ sessionID: input.sessionID }) // 进入主循环
})
```

**职责：**

1. 获取会话
2. 清理 revert 状态
3. 创建用户消息 (`createUserMessage`)
4. 进入主循环 (`loop`)

---

### 2.2 `loop()` — 主循环

```typescript
// prompt.ts:274-724
export const loop = fn(LoopInput, async (input) => {
  const { sessionID, resume_existing } = input
  const abort = resume_existing ? resume(sessionID) : start(sessionID)
  // ...

  while (true) {
    // 1. 过滤已压缩的消息
    // 2. 检查是否需要压缩
    // 3. 构建系统提示词
    // 4. 调用 LLM (SessionProcessor)
    // 5. 执行工具
    // 6. 检查结束条件
  }
})
```

**核心循环逻辑：**

```
┌─────────────────────────────────────────────────────────┐
│                     loop() 主循环                        │
├─────────────────────────────────────────────────────────┤
│  1. 获取消息历史                                        │
│  2. 过滤已压缩消息 (filterCompacted)                    │
│  3. 查找最后用户/助手消息                                │
│  4. 检查是否退出循环                                     │
│                                                         │
│  5. 处理待处理任务:                                     │
│     ├── Subtask (子代理任务)                            │
│     └── Compaction (上下文压缩)                         │
│                                                         │
│  6. 检查上下文溢出 → 触发压缩                           │
│                                                         │
│  7. 构建系统提示词:                                     │
│     ├── SystemPrompt.environment()                     │
│     ├── InstructionPrompt.system()                      │
│     └── Agent 特定提示词                                │
│                                                         │
│  8. 调用 SessionProcessor.process()                     │
│     └── LLM 调用 + 工具执行                            │
│                                                         │
│  9. 检查结束条件                                        │
│     └── 返回或继续循环                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 三、核心组件详解

### 3.1 `createUserMessage()` — 创建用户消息

```typescript
// prompt.ts:954-1319
async function createUserMessage(input: PromptInput) {
  const agent = await Agent.get(input.agent ?? (await Agent.defaultAgent()))
  const model = input.model ?? agent.model ?? (await lastModel(input.sessionID))

  // 构建消息信息
  const info: MessageV2.Info = {
    id: input.messageID ?? Identifier.ascending("message"),
    role: "user",
    sessionID: input.sessionID,
    agent: agent.name,
    model,
    // ...
  }

  // 处理消息 parts
  const parts = await Promise.all(
    input.parts.map(async (part) => {
      // 1. 文件处理 (file://, data:, MCP resources)
      // 2. Agent 调用 (@agent)
      // 3. 普通文本
    }),
  )
}
```

**职责：**

1. 确定使用的 Agent 和 Model
2. 解析并处理消息中的各个 Part（文件、Agent 引用等）
3. 将文件内容转换为文本或 Base64
4. 处理 MCP 资源

---

### 3.2 `resolveTools()` — 解析可用工具

```typescript
// prompt.ts:734-922
export async function resolveTools(input: {
  agent: Agent.Info
  model: Provider.Model
  session: Session.Info
  processor: SessionProcessor.Info
  bypassAgentCheck: boolean
  messages: MessageV2.WithParts[]
}) {
  const tools: Record<string, AITool> = {}

  // 1. 从 ToolRegistry 获取内置工具
  for (const item of await ToolRegistry.tools({ modelID, providerID }, agent)) {
    tools[item.id] = tool({
      id: item.id,
      description: item.description,
      inputSchema: jsonSchema(schema),
      async execute(args, options) {
        // 执行工具
        // 触发插件钩子: tool.execute.before / after
      },
    })
  }

  // 2. 添加 MCP 工具
  for (const [key, item] of Object.entries(await MCP.tools())) {
    // 转换 MCP 工具为 AI SDK 格式
  }

  return tools
}
```

---

### 3.3 `insertReminders()` — 注入系统提醒

```typescript
// prompt.ts:1321-1459
async function insertReminders(input) {
  // 处理 Plan 模式

  // 1. 如果使用 plan agent，注入计划提示词
  if (input.agent.name === "plan") {
    userMessage.parts.push({ type: "text", text: PROMPT_PLAN, synthetic: true })
  }

  // 2. 如果从 plan 切换到 build，注入切换提示词
  if (wasPlan && input.agent.name === "build") {
    userMessage.parts.push({ type: "text", text: BUILD_SWITCH, synthetic: true })
  }
}
```

**Plan 模式工作流（5 阶段）：**

```
Phase 1: 初始理解
  - 启动最多 3 个 explore 子代理并行探索代码库
  - 使用 question 工具澄清需求

Phase 2: 设计
  - 启动 general 子代理设计实现方案
  - 可并行启动最多 1 个代理

Phase 3: 审查
  - 阅读关键文件
  - 确保计划符合用户意图
  - 询问用户问题

Phase 4: 最终计划
  - 将计划写入计划文件
  - 包含关键文件路径和验证方法

Phase 5: 调用 plan_exit
  - 通知用户计划已完成，等待批准
```

---

### 3.4 `shell()` — Shell 命令执行

```typescript
// prompt.ts:1473-1709
export async function shell(input: ShellInput) {
  // 1. 启动/恢复会话
  const abort = start(input.sessionID)

  // 2. 创建用户消息和助手消息
  // 3. 执行 shell 命令
  const proc = spawn(shell, args, { cwd, detached, stdio })

  // 4. 收集输出
  proc.stdout?.on("data", (chunk) => {
    output += chunk
  })
  proc.stderr?.on("data", (chunk) => {
    output += chunk
  })

  // 5. 返回结果
  return { info: msg, parts: [part] }
}
```

---

### 3.5 `command()` — 命令执行

```typescript
// prompt.ts:1744-1886
export async function command(input: CommandInput) {
  // 1. 解析命令
  const command = await Command.get(input.command)

  // 2. 处理参数替换
  //    - $1, $2, ... 位置参数
  //    - $ARGUMENTS 全部参数

  // 3. 执行 shell 模板
  const shell = ConfigMarkdown.shell(template)

  // 4. 决定是创建 Subtask 还是直接 prompt
  const isSubtask = ...

  // 5. 调用 prompt
  const result = await prompt({ sessionID, agent, parts, ... })
}
```

---

### 3.6 `ensureTitle()` — 自动生成会话标题

```typescript
// prompt.ts:1888-1958
async function ensureTitle(input) {
  // 仅对第一个真实用户消息生成标题
  if (!isFirst) return

  // 使用 title agent 生成标题
  const agent = await Agent.get("title")
  const result = await LLM.stream({
    agent,
    messages: [{ role: "user", content: "Generate a title for this conversation:" }, ...contextMessages],
  })

  // 清理并设置标题
  const title = cleaned.length > 100 ? cleaned.substring(0, 97) + "..." : cleaned
  await Session.setTitle({ sessionID, title })
}
```

---

## 四、状态管理

### 4.1 会话状态

```typescript
// prompt.ts:65-84
const state = Instance.state(
  () => {
    const data: Record<
      string,
      {
        abort: AbortController
        callbacks: {
          resolve(input: MessageV2.WithParts): void
          reject(reason?: any): void
        }[]
      }
    > = {}
    return data
  },
  async (current) => {
    for (const item of Object.values(current)) {
      item.abort.abort() // 清理时中止所有会话
    }
  },
)
```

**管理：**

- `start(sessionID)` — 启动新会话
- `resume(sessionID)` — 恢复已有会话
- `cancel(sessionID)` — 取消会话

---

## 五、关键数据流

### 5.1 完整消息处理流程

```
用户输入 (HTTP POST /session/:id/message)
    ↓
SessionPrompt.prompt(input)
    ↓
1. createUserMessage()
   ├── 解析 Agent
   ├── 解析 Model
   ├── 处理文件 (file://, data:, MCP)
   └── 创建 MessageV2
    ↓
2. loop()
   ├── 过滤已压缩消息
   ├── 检查待处理任务 (Subtask, Compaction)
   ├── 检查上下文溢出
   ├── insertReminders() - 注入计划/切换提示词
   ├── resolveTools() - 获取可用工具
   └── SessionProcessor.process() - LLM 调用
        ↓
        ├── 发送消息到 LLM
        ├── 流式接收响应
        ├── 解析工具调用
        ├── 执行工具
        └── 循环或结束
    ↓
返回结果
```

---

## 六、Plan 模式详解

### 6.1 启用方式

1. **Flag 模式**：`OPENCODE_EXPERIMENTAL_PLAN_MODE=true`
2. **Agent 切换**：从 `build` 切换到 `plan` Agent

### 6.2 核心提示词

**PROMPT_PLAN** (`src/session/prompt/plan.txt`)：

- Plan 模式的基本指令
- 禁止编辑，只能阅读和创建计划文件

**BUILD_SWITCH** (`src/session/prompt/build-switch.txt`)：

- 从 Plan 切换到 Build 时的提示
- 告知计划文件位置，指示执行计划

---

## 七、结构化输出

### 7.1 支持模式

```typescript
// prompt.ts:52-60
const STRUCTURED_OUTPUT_DESCRIPTION = `Use this tool to return your final response...`

const STRUCTURED_OUTPUT_SYSTEM_PROMPT = `IMPORTANT: The user has requested structured output...`
```

当用户请求 JSON Schema 格式输出时：

1. 注入 `StructuredOutput` 工具
2. 在系统提示词中添加指令
3. 模型调用工具后立即返回

---

## 八、错误处理

### 8.1 主要错误类型

| 错误                 | 处理方式               |
| -------------------- | ---------------------- |
| `Session.BusyError`  | 会话繁忙，拒绝新请求   |
| `ModelNotFoundError` | 提示可用模型           |
| 工具执行失败         | 记录错误，返回失败状态 |
| 上下文溢出           | 触发压缩               |

---

## 九、关键文件依赖

```
prompt.ts 依赖
├── Session (./index.ts)         # 会话管理
├── MessageV2 (./message-v2.ts) # 消息结构
├── SessionProcessor (./processor.ts) # LLM 处理
├── Agent (../agent/agent.ts)   # Agent 定义
├── Provider (../provider/provider.ts) # LLM 提供商
├── SystemPrompt (./system.ts)   # 环境提示词
├── InstructionPrompt (./instruction.ts) # 指令提示词
├── SessionCompaction (./compaction.ts) # 上下文压缩
├── ToolRegistry (../tool/registry.ts) # 工具注册
├── MCP (../mcp)                 # MCP 工具
├── Plugin (../plugin)          # 插件系统
└── LLM (./llm.ts)              # LLM 调用
```

---

## 十、总结

| 维度         | 说明                                      |
| ------------ | ----------------------------------------- |
| **核心职责** | 用户消息处理 → LLM 调用 → 工具执行 → 循环 |
| **主入口**   | `prompt()`                                |
| **核心循环** | `loop()` (约 450 行)                      |
| **关键功能** | Plan 模式、上下文压缩、结构化输出         |
| **工具解析** | `resolveTools()`                          |
| **消息创建** | `createUserMessage()`                     |

SessionPrompt 是整个 OpenCode 的**大脑**，协调所有组件完成用户请求。
