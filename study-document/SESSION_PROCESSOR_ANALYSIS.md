# SessionProcessor 模块详解

本文档详细介绍 OpenCode 核心模块 `src/session/processor.ts` 的设计与实现。

---

## 一、模块概述

`processor.ts` 是 OpenCode 的 **LLM 流式响应处理器**，负责：

- 接收 LLM 的流式输出
- 解析和处理各种事件类型（文本、推理、工具调用等）
- 执行工具调用
- 处理错误和重试逻辑
- 管理上下文压缩

**文件规模：** 421 行代码

---

## 二、核心数据结构

### 2.1 常量定义

```typescript
// processor.ts:19-21
export namespace SessionProcessor {
  const DOOM_LOOP_THRESHOLD = 3 //  doom loop 检测阈值
  const log = Log.create({ service: "session.processor" })
}
```

- `DOOM_LOOP_THRESHOLD` — 检测连续调用相同工具的次数，超过则触发权限询问

---

## 三、create() 函数

### 3.1 函数签名

```typescript
// processor.ts:26-31
export function create(input: {
  assistantMessage: MessageV2.Assistant  // 助手消息
  sessionID: string                       // 会话 ID
  model: Provider.Model                   // 模型信息
  abort: AbortSignal                      // 中止信号
}) {
```

### 3.2 内部状态

```typescript
// processor.ts:32-36
const toolcalls: Record<string, MessageV2.ToolPart> = {} // 正在进行的工具调用
let snapshot: string | undefined // 文件快照
let blocked = false // 是否被阻塞
let attempt = 0 // 重试次数
let needsCompaction = false // 是否需要压缩
```

| 变量              | 类型    | 作用                       |
| ----------------- | ------- | -------------------------- |
| `toolcalls`       | Record  | 追踪正在执行的工具调用     |
| `snapshot`        | string  | 文件系统快照，用于跟踪修改 |
| `blocked`         | boolean | 是否因权限问题被阻塞       |
| `attempt`         | number  | 当前重试次数               |
| `needsCompaction` | boolean | 是否需要上下文压缩         |

---

## 四、process() 函数 — 核心处理循环

### 4.1 函数入口

```typescript
// processor.ts:45-48
async process(streamInput: LLM.StreamInput) {
  log.info("process")
  needsCompaction = false
  const shouldBreak = (await Config.get()).experimental?.continue_loop_on_deny !== true
```

### 4.2 主循环

```typescript
// processor.ts:49-417
while (true) {
  try {
    // 处理流式事件...
  } catch (e) {
    // 错误处理...
  }

  // 返回结果
  if (needsCompaction) return "compact"
  if (blocked) return "stop"
  if (input.assistantMessage.error) return "stop"
  return "continue"
}
```

**返回类型：**

- `"continue"` — 继续循环
- `"stop"` — 停止循环
- `"compact"` — 需要压缩上下文

---

## 五、事件处理详解

### 5.1 事件类型总览

```
LLM 流式输出事件
    │
    ├─ start                    # 会话开始
    ├─ reasoning-start          # 推理开始
    ├─ reasoning-delta          # 推理增量
    ├─ reasoning-end            # 推理结束
    ├─ tool-input-start         # 工具输入开始
    ├─ tool-input-delta         # 工具输入增量
    ├─ tool-input-end           # 工具输入结束
    ├─ tool-call                # 工具调用
    ├─ tool-result              # 工具结果
    ├─ tool-error               # 工具错误
    ├─ start-step               # 步骤开始
    ├─ finish-step              # 步骤完成
    ├─ text-start                # 文本开始
    ├─ text-delta               # 文本增量
    ├─ text-end                 # 文本结束
    ├─ error                    # 错误
    └─ finish                   # 完成
```

---

### 5.2 推理过程处理 (reasoning-start/delta/end)

```typescript
// processor.ts:62-109

// 推理开始
case "reasoning-start":
  const reasoningPart = {
    id: Identifier.ascending("part"),
    messageID: input.assistantMessage.id,
    type: "reasoning",  // 特殊类型
    text: "",
    time: { start: Date.now() },
    metadata: value.providerMetadata,
  }
  reasoningMap[value.id] = reasoningPart
  await Session.updatePart(reasoningPart)
  break

// 推理增量
case "reasoning-delta":
  reasoningMap[value.id].text += value.text
  await Session.updatePartDelta({ /* ... */ })
  break

// 推理结束
case "reasoning-end":
  const part = reasoningMap[value.id]
  part.text = part.text.trimEnd()
  part.time.end = Date.now()
  await Session.updatePart(part)
  delete reasoningMap[value.id]
  break
```

**作用：**

- 记录模型的推理过程（如 OpenAI 的 o1、Claude 的 extended thinking）
- 存储为特殊的 `ReasoningPart` 类型

---

### 5.3 工具调用处理 (tool-input-start/call)

```typescript
// processor.ts:111-178

// 工具输入开始
case "tool-input-start":
  const part = await Session.updatePart({
    id: toolcalls[value.id]?.id ?? Identifier.ascending("part"),
    messageID: input.assistantMessage.id,
    type: "tool",
    tool: value.toolName,
    callID: value.id,
    state: {
      status: "pending",  // 初始状态为 pending
      input: {},
      raw: "",
    },
  })
  toolcalls[value.id] = part
  break

// 工具调用确定
case "tool-call":
  const match = toolcalls[value.toolCallId]
  if (match) {
    // 更新状态为 running
    await Session.updatePart({
      ...match,
      tool: value.toolName,
      state: {
        status: "running",
        input: value.input,
        time: { start: Date.now() },
      },
    })

    // Doom Loop 检测
    // 如果连续 3 次调用相同工具，询问权限
    const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD)
    if (lastThree.length === DOOM_LOOP_THRESHOLD &&
        lastThree.every(p => p.tool === value.toolName && /* ... */)) {
      await PermissionNext.ask({ /* 权限询问 */ })
    }
  }
  break
```

**关键点：**

1. 工具调用有三种状态：`pending` → `running` → `completed/error`
2. `Doom Loop` 检测：防止模型陷入重复调用同一工具

---

### 5.4 工具结果处理 (tool-result)

```typescript
// processor.ts:180-202
case "tool-result":
  const match = toolcalls[value.toolCallId]
  if (match && match.state.status === "running") {
    await Session.updatePart({
      ...match,
      state: {
        status: "completed",  // 标记为完成
        input: value.input ?? match.state.input,
        output: value.output.output,      // 工具输出
        metadata: value.output.metadata,
        title: value.output.title,
        time: { start: match.state.time.start, end: Date.now() },
        attachments: value.output.attachments,
      },
    })
    delete toolcalls[value.toolCallId]  // 从追踪中移除
  }
  break
```

---

### 5.5 工具错误处理 (tool-error)

```typescript
// processor.ts:204-229
case "tool-error":
  const match = toolcalls[value.toolCallId]
  if (match && match.state.status === "running") {
    await Session.updatePart({
      ...match,
      state: {
        status: "error",
        input: value.input ?? match.state.input,
        error: value.error.toString(),
        time: { start: match.state.time.start, end: Date.now() },
      },
    })

    // 如果是权限拒绝，阻塞后续处理
    if (value.error instanceof PermissionNext.RejectedError ||
        value.error instanceof Question.RejectedError) {
      blocked = shouldBreak
    }
    delete toolcalls[value.toolCallId]
  }
  break
```

---

### 5.6 文本处理 (text-start/delta/end)

```typescript
// processor.ts:287-337

// 文本开始
case "text-start":
  currentText = {
    id: Identifier.ascending("part"),
    messageID: input.assistantMessage.id,
    type: "text",
    text: "",
    time: { start: Date.now() },
  }
  await Session.updatePart(currentText)
  break

// 文本增量
case "text-delta":
  currentText.text += value.text
  await Session.updatePartDelta({ /* 增量更新 */ })
  break

// 文本结束
case "text-end":
  // 触发插件钩子
  const textOutput = await Plugin.trigger(
    "experimental.text.complete",
    { sessionID, messageID, partID: currentText.id },
    { text: currentText.text }
  )
  currentText.text = textOutput.text
  currentText.time.end = Date.now()
  await Session.updatePart(currentText)
  currentText = undefined
  break
```

---

### 5.7 步骤处理 (start-step/finish-step)

```typescript
// processor.ts:233-285

// 步骤开始
case "start-step":
  snapshot = await Snapshot.track()  // 记录文件快照
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: input.assistantMessage.id,
    sessionID: input.sessionID,
    snapshot,
    type: "step-start",
  })
  break

// 步骤完成
case "finish-step":
  // 记录使用量
  const usage = Session.getUsage({ model, usage: value.usage, metadata })

  // 更新助手消息
  input.assistantMessage.finish = value.finishReason
  input.assistantMessage.cost += usage.cost
  input.assistantMessage.tokens = usage.tokens

  // 计算文件变更
  if (snapshot) {
    const patch = await Snapshot.patch(snapshot)
    if (patch.files.length) {
      await Session.updatePart({
        type: "patch",
        hash: patch.hash,
        files: patch.files,
      })
    }
  }

  // 检查是否需要压缩
  if (await SessionCompaction.isOverflow({ tokens: usage.tokens, model })) {
    needsCompaction = true
  }
  break
```

**关键功能：**

1. **Snapshot 跟踪** — 记录步骤开始时的文件状态
2. **Patch 计算** — 计算步骤完成后的文件变更
3. **使用量统计** — 记录 token 消耗和成本
4. **压缩检查** — 检查是否需要压缩上下文

---

## 六、错误处理

### 6.1 错误捕获

```typescript
// processor.ts:350-378
catch (e: any) {
  log.error("process", { error: e, stack: JSON.stringify(e.stack) })

  const error = MessageV2.fromError(e, { providerID: input.model.providerID })

  // 检查是否可重试
  const retry = SessionRetry.retryable(error)
  if (retry !== undefined) {
    attempt++
    const delay = SessionRetry.delay(attempt, /* ... */)
    // 设置重试状态
    SessionStatus.set(input.sessionID, {
      type: "retry",
      attempt,
      message: retry,
      next: Date.now() + delay,
    })
    // 等待后重试
    await SessionRetry.sleep(delay, input.abort)
    continue
  }

  // 不可重试，记录错误
  input.assistantMessage.error = error
  Bus.publish(Session.Event.Error, { sessionID, error })
  SessionStatus.set(input.sessionID, { type: "idle" })
}
```

### 6.2 重试机制

- `SessionRetry.retryable(error)` — 检查错误是否可重试
- `SessionRetry.delay(attempt, error)` — 计算重试延迟（指数退避）
- `SessionRetry.sleep(delay, abort)` — 延迟后重试

---

## 七、清理和返回

### 7.1 步骤结束清理

```typescript
// processor.ts:379-392
if (snapshot) {
  const patch = await Snapshot.patch(snapshot)
  if (patch.files.length) {
    await Session.updatePart({
      type: "patch",
      hash: patch.hash,
      files: patch.files,
    })
  }
  snapshot = undefined
}
```

### 7.2 中止未完成工具

```typescript
// processor.ts:393-409
const p = await MessageV2.parts(input.assistantMessage.id)
for (const part of p) {
  if (part.type === "tool" && part.state.status !== "completed" && part.state.status !== "error") {
    await Session.updatePart({
      ...part,
      state: {
        ...part.state,
        status: "error",
        error: "Tool execution aborted",
        time: { start: Date.now(), end: Date.now() },
      },
    })
  }
}
```

### 7.3 返回结果

```typescript
// processor.ts:410-416
input.assistantMessage.time.completed = Date.now()
await Session.updateMessage(input.assistantMessage)

if (needsCompaction) return "compact"
if (blocked) return "stop"
if (input.assistantMessage.error) return "stop"
return "continue"
```

---

## 八、数据流图

```
LLM.stream()
    ↓
stream.fullStream (流式迭代)
    │
    ├─ reasoning-* → ReasoningPart (推理)
    ├─ text-* → TextPart (文本)
    ├─ tool-* → ToolPart (工具调用)
    │              │
    │              ├─ pending → running → completed/error
    │              │
    │              └─ Doom Loop 检测
    │
    ├─ start-step → Snapshot.track()
    │
    └─ finish-step → Snapshot.patch() → PatchPart
                          ↓
                      返回结果
                      ├─ "continue" 继续
                      ├─ "stop" 停止
                      └─ "compact" 压缩
```

---

## 九、关键功能总结

| 功能               | 说明                     |
| ------------------ | ------------------------ |
| **流式处理**       | 实时处理 LLM 的流式输出  |
| **推理追踪**       | 记录模型的推理过程       |
| **工具执行**       | 管理工具调用生命周期     |
| **Doom Loop 检测** | 防止无限循环调用同一工具 |
| **快照跟踪**       | 记录文件变更             |
| **使用量统计**     | 追踪 token 消耗和成本    |
| **错误重试**       | 指数退避重试机制         |
| **压缩检查**       | 自动检测上下文溢出       |

---

## 十、与 loop() 的关系

```
loop() ──────────────────────────────────────────┐
  │                                                │
  ├─> processor.process() ────────────────────────┤
  │   │                                           │
  │   └─ 处理 LLM 流式响应                         │
  │       │                                       │
  │       ├─ 推理 (reasoning-*)                   │
  │       ├─ 文本 (text-*)                        │
  │       ├─ 工具调用 (tool-*)                   │
  │       └─ 步骤 (step-*)                       │
  │                                                │
  │   返回: "continue" | "stop" | "compact"       │
  │                                                │
  <───────────────────────────────────────────────┘
```

**简单理解：**

- `loop()` 负责整体流程控制
- `processor.process()` 负责具体的 LLM 调用和工具执行

---

## 十一、总结

| 维度         | 说明                                     |
| ------------ | ---------------------------------------- |
| **核心职责** | LLM 流式响应处理、工具执行管理           |
| **主函数**   | `create()` → 返回包含 `process()` 的对象 |
| **事件类型** | 10+ 种（推理、文本、工具、步骤等）       |
| **状态管理** | pending → running → completed/error      |
| **返回结果** | "continue" / "stop" / "compact"          |

SessionProcessor 是 OpenCode 的 **"执行引擎"**，负责将 LLM 的输出转化为可执行的工具调用，并将结果反馈给 LLM。
