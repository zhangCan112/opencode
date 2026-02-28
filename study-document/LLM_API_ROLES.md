# 大模型 API 角色

大模型 API 定义了四种核心消息角色，用于构建对话流程。

---

## 角色概览

```
┌─────────────────────────────────────────────────────────────┐
│                   大模型 API 消息角色                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ system - 系统提示词                                   │    │
│  │ 定义 AI 的身份、行为规则、能力边界                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ user - 用户输入                                       │    │
│  │ 用户的请求、问题、指令                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ assistant - 模型响应                                  │    │
│  │ AI 的回复、思考、工具调用                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ tool - 工具结果                                       │    │
│  │ 工具执行后的返回结果                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## System 角色

设定 AI 的身份和行为规则。

### 定义位置

`session/llm.ts` 第67-80行

```typescript
const system = []
system.push(
  [
    ...(input.agent.prompt ? [input.agent.prompt] : SystemPrompt.provider(input.model)),
    ...input.system,
    ...(input.user.system ? [input.user.system] : []),
  ].join("\n"),
)
```

### 作用

- 设定 AI 的身份和角色
- 定义行为规则和约束
- 提供上下文和背景知识
- 对用户不可见，在对话历史中隐藏

### 优先级

`agent.prompt` > `SystemPrompt.provider()` > `input.system` > `user.system`

---

## User 角色

用户的输入消息。

### 定义位置

`session/message-v2.ts` 第345-369行

```typescript
export const User = Base.extend({
  role: z.literal("user"),
  time: z.object({ created: z.number() }),
  format: Format.optional(),
  agent: z.string(),
  model: z.object({ providerID: z.string(), modelID: z.string() }),
  system: z.string().optional(),
  variant: z.string().optional(),
})
```

### 作用

- 存储用户的输入内容
- 可包含多个 part（文本、文件、子任务等）
- 可携带 agent、model 选择
- 支持 structured output 格式

### Part 类型

| Part          | 说明             |
| ------------- | ---------------- |
| `TextPart`    | 文本内容         |
| `FilePart`    | 文件附件         |
| `AgentPart`   | agent 调用       |
| `SubtaskPart` | 子任务           |
| `ToolPart`    | 工具调用（合成） |

---

## Assistant 角色

模型的响应消息。

### 定义位置

`session/message-v2.ts` 第391-438行

```typescript
export const Assistant = Base.extend({
  role: z.literal("assistant"),
  time: z.object({ created: z.number(), completed: z.number().optional() }),
  error: z.discriminatedUnion("name", [...]).optional(),
  parentID: z.string(),
  modelID: z.string(),
  providerID: z.string(),
  agent: z.string(),
  cost: z.number(),
  tokens: z.object({...}),
  finish: z.string().optional(),
})
```

### 作用

- 存储模型的响应
- 包含 token 使用统计
- 记录错误信息
- 追踪成本

### finish 字段值

| 值           | 含义         |
| ------------ | ------------ |
| `stop`       | 正常结束     |
| `tool-calls` | 调用工具中   |
| `length`     | 达到长度限制 |
| `unknown`    | 未知状态     |

---

## Tool 角色

工具执行的返回结果。

### 定义位置

`provider/transform.ts`

```typescript
if (msg.role === "tool" && nextMsg?.role === "user") {
  // 工具结果处理
}
```

### 作用

- 返回工具执行结果给模型
- 让模型根据结果继续推理
- 支持多轮工具调用

---

## 消息流转示例

```
[system]
"You are OpenCode, the best coding agent..."

[user]
"帮我分析 agent.ts 文件"

[assistant]
"我来读取这个文件..." [tool_use: read]

[tool]
{ content: "import { Config }...", path: "..." }

[assistant]
"这个文件定义了 Agent 系统..."
```

---

## Synthetic Parts

Opencode 将动态内容注入到 user 消息中作为 synthetic part。

### 实现方式

`session/prompt.ts` 第1327-1336行

```typescript
userMessage.parts.push({
  type: "text",
  text: PROMPT_PLAN,
  synthetic: true,
})
```

### 特点

- 对用户不可见
- 作为上下文传递给模型
- 可根据状态动态调整

### 为什么不放在 system

| 位置             | 优点                   | 缺点                     |
| ---------------- | ---------------------- | ------------------------ |
| system           | 模型优先级高、语义清晰 | 无法根据对话状态动态修改 |
| user (synthetic) | 可动态注入、条件控制   | 混在用户消息中           |

`PROMPT_PLAN` 等内容需要根据当前 agent 状态动态注入，所以选择了 synthetic part 的方式。
