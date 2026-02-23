# loop() 函数逐行详解

本文档对 `src/session/prompt.ts` 中的 `loop` 函数进行逐行解析。

---

## 函数签名

```typescript
// prompt.ts:270-274
export const LoopInput = z.object({
  sessionID: Identifier.schema("session"),
  resume_existing: z.boolean().optional(),
})

export const loop = fn(LoopInput, async (input) => {
```

**LoopInput 定义：**

- `sessionID` — 会话 ID（必填）
- `resume_existing` — 是否恢复已有会话（可选）

---

## 第 275-283 行：会话状态管理

```typescript
// 275: 解构输入参数
const { sessionID, resume_existing } = input

// 277: 启动或恢复会话
const abort = resume_existing ? resume(sessionID) : start(sessionID)

// 278-283: 如果会话已在运行，将当前调用加入等待队列
if (!abort) {
  return new Promise<MessageV2.WithParts>((resolve, reject) => {
    const callbacks = state()[sessionID].callbacks
    callbacks.push({ resolve, reject })
  })
}
```

**解释：**

- 如果 `resume_existing` 为 true，尝试恢复已有会话（返回 AbortSignal）
- 否则，启动新会话
- 如果会话已在运行（`abort` 为 undefined），将当前调用加入 callbacks 队列，等待当前会话完成

---

## 第 285 行：会话清理

```typescript
// 285: 使用 defer 确保函数结束时调用 cancel(sessionID)
using _ = defer(() => cancel(sessionID))
```

**解释：**

- `defer` 是一个辅助函数，在函数退出时自动执行清理
- 确保会话结束时调用 `cancel` 清理状态

---

## 第 287-293 行：初始化变量

```typescript
// 287-290: 结构化输出状态初始化
// Note: 恢复会话时状态会重置，但 outputFormat 会保留在用户消息中
let structuredOutput: unknown | undefined

// 292: 步骤计数器
let step = 0

// 293: 获取会话信息
const session = await Session.get(sessionID)
```

**解释：**

- `structuredOutput` — 存储结构化输出结果
- `step` — 追踪 LLM 调用次数（用于限制最大步数）
- `session` — 从数据库获取会话信息

---

## 第 294 行：主循环开始

```typescript
// 294: while(true) 无限循环
while (true) {
```

**解释：**

- 真正的对话循环开始
- 每次循环可能包含：LLM 调用 + 工具执行

---

## 第 295-298 行：循环准备

```typescript
// 295: 设置会话状态为 "busy"
SessionStatus.set(sessionID, { type: "busy" })

// 296: 记录日志
log.info("loop", { step, sessionID })

// 297: 检查是否已中止
if (abort.aborted) break

// 298: 获取消息历史（过滤已压缩的）
let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))
```

---

## 第 300-315 行：遍历消息查找关键消息

```typescript
// 300-303: 初始化变量
let lastUser: MessageV2.User | undefined // 最后的用户消息
let lastAssistant: MessageV2.Assistant | undefined // 最后的助手消息
let lastFinished: MessageV2.Assistant | undefined // 最后的已完成助手消息
let tasks: (MessageV2.CompactionPart | MessageV2.SubtaskPart)[] = [] // 待处理任务

// 304-315: 从后向前遍历消息
for (let i = msgs.length - 1; i >= 0; i--) {
  const msg = msgs[i]

  // 306: 找最后一个用户消息
  if (!lastUser && msg.info.role === "user") lastUser = msg.info as MessageV2.User

  // 307: 找最后一个助手消息
  if (!lastAssistant && msg.info.role === "assistant") lastAssistant = msg.info as MessageV2.Assistant

  // 308-309: 找最后一个已完成（finish）的助手消息
  if (!lastFinished && msg.info.role === "assistant" && msg.info.finish) lastFinished = msg.info as MessageV2.Assistant

  // 310: 找到关键消息后退出
  if (lastUser && lastFinished) break

  // 311-314: 收集待处理的 compaction 和 subtask 任务
  const task = msg.parts.filter((part) => part.type === "compaction" || part.type === "subtask")
  if (task && !lastFinished) {
    tasks.push(...task)
  }
}
```

**解释：**

- 从最新的消息向前查找
- `lastUser` — 当前用户发送的最新消息
- `lastAssistant` — 最后一条助手消息
- `lastFinished` — 最后一个"完成"的助手消息（非 tool-calls）
- `tasks` — 收集待处理的子任务和压缩任务

---

## 第 317-325 行：退出条件检查

```typescript
// 317: 确保有用户消息
if (!lastUser) throw new Error("No user message found in stream. This should never happen.")

// 318-325: 检查是否应该退出循环
if (
  lastAssistant?.finish && // 助手消息已完成
  !["tool-calls", "unknown"].includes(lastAssistant.finish) && // 不是工具调用
  lastUser.id < lastAssistant.id // 用户消息在助手消息之前
) {
  log.info("exiting loop", { sessionID })
  break // 退出循环
}
```

**解释：**

- 如果助手消息已完成（不是调用工具），且用户消息在之前，则对话已完成
- 退出循环，返回结果

---

## 第 327-334 行：第一步处理

```typescript
// 327: 步数 +1
step++

// 328-334: 如果是第一步，生成会话标题
if (step === 1)
  ensureTitle({
    session,
    modelID: lastUser.model.modelID,
    providerID: lastUser.model.providerID,
    history: msgs,
  })
```

**解释：**

- 首次调用 LLM 时，自动生成会话标题

---

## 第 336-347 行：获取模型

```typescript
// 336-347: 获取模型信息
const model = await Provider.getModel(lastUser.model.providerID, lastUser.model.modelID).catch((e) => {
  // 如果模型不存在，发布错误事件
  if (Provider.ModelNotFoundError.isInstance(e)) {
    const hint = e.data.suggestions?.length ? ` Did you mean: ${e.data.suggestions.join(", ")}?` : ""
    Bus.publish(Session.Event.Error, {
      sessionID,
      error: new NamedError.Unknown({
        message: `Model not found: ${e.data.providerID}/${e.data.modelID}.${hint}`,
      }).toObject(),
    })
  }
  throw e
})
```

---

## 第 348 行：取出待处理任务

```typescript
// 348: 从任务队列中取出一个任务
const task = tasks.pop()
```

---

## 第 350-526 行：处理 Subtask（子任务）

```typescript
// 350-352: 如果有待处理的子任务
if (task?.type === "subtask") {

  // 353: 初始化 Task 工具
  const taskTool = await TaskTool.init()

  // 354: 获取任务使用的模型
  const taskModel = task.model
    ? await Provider.getModel(task.model.providerID, task.model.modelID)
    : model

  // 355-379: 创建助手消息
  const assistantMessage = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "assistant",
    parentID: lastUser.id,
    sessionID,
    mode: task.agent,
    agent: task.agent,
    variant: lastUser.variant,
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: taskModel.id,
    providerID: taskModel.providerID,
    time: { created: Date.now() },
  })

  // 380-399: 创建工具调用部分
  let part = await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: assistantMessage.id,
    sessionID: assistantMessage.sessionID,
    type: "tool",
    callID: ulid(),
    tool: TaskTool.id,
    state: {
      status: "running",
      input: {
        prompt: task.prompt,
        description: task.description,
        subagent_type: task.agent,
        command: task.command,
      },
      time: { start: Date.now() },
    },
  })

  // 400-405: 准备任务参数
  const taskArgs = {
    prompt: task.prompt,
    description: task.description,
    subagent_type: task.agent,
    command: task.command,
  }

  // 406-414: 触发插件钩子
  await Plugin.trigger(
    "tool.execute.before",
    { tool: "task", sessionID, callID: part.id },
    { args: taskArgs }
  )

  // 415-447: 执行任务
  let executionError: Error | undefined
  const taskAgent = await Agent.get(task.agent)
  const taskCtx: Tool.Context = {
    agent: task.agent,
    messageID: assistantMessage.id,
    sessionID: sessionID,
    abort,
    callID: part.callID,
    extra: { bypassAgentCheck: true },  // 绕过权限检查
    messages: msgs,
    // ... metadata 和 ask 方法
  }
  const result = await taskTool.execute(taskArgs, taskCtx).catch((error) => {
    executionError = error
    log.error("subtask execution failed", { error, agent: task.agent, description: task.description })
    return undefined
  })

  // 448-453: 处理附件
  const attachments = result?.attachments?.map((attachment) => ({
    ...attachment,
    id: Identifier.ascending("part"),
    sessionID,
    messageID: assistantMessage.id,
  }))

  // 454-463: 触发执行后钩子
  await Plugin.trigger(
    "tool.execute.after",
    { tool: "task", sessionID, callID: part.id, args: taskArgs },
    result
  )

  // 464-466: 更新助手消息状态
  assistantMessage.finish = "tool-calls"
  assistantMessage.time.completed = Date.now()
  await Session.updateMessage(assistantMessage)

  // 467-483: 更新工具调用结果（成功）
  if (result && part.state.status === "running") {
    await Session.updatePart({
      ...part,
      state: {
        status: "completed",
        input: part.state.input,
        title: result.title,
        metadata: result.metadata,
        output: result.output,
        attachments,
        time: { ...part.state.time, end: Date.now() },
      },
    })
  }

  // 484-498: 更新工具调用结果（失败）
  if (!result) {
    await Session.updatePart({
      ...part,
      state: {
        status: "error",
        error: executionError
          ? `Tool execution failed: ${executionError.message}`
          : "Tool execution failed",
        time: { ... },
        metadata: part.metadata,
        input: part.state.input,
      },
    })
  }

  // 500-523: 如果有 command，添加总结用户消息
  // 防止某些推理模型（如 Gemini）出错
  if (task.command) {
    const summaryUserMsg: MessageV2.User = { ... }
    await Session.updateMessage(summaryUserMsg)
    await Session.updatePart({
      ...,
      type: "text",
      text: "Summarize the task tool output above and continue with your task.",
      synthetic: true,
    })
  }

  // 525: 继续循环
  continue
}
```

**解释：**

- Subtask 是通过 Task 工具启动的子代理
- 创建助手消息和工具调用部分
- 执行任务工具
- 更新执行结果
- 继续循环处理下一个任务

---

## 第 528-539 行：处理 Compaction（压缩）

```typescript
// 528-529: 如果有待处理的压缩任务
if (task?.type === "compaction") {
  // 530-536: 执行压缩
  const result = await SessionCompaction.process({
    messages: msgs,
    parentID: lastUser.id,
    abort,
    sessionID,
    auto: task.auto,
  })

  // 537-538: 如果返回 "stop" 则退出，否则继续
  if (result === "stop") break
  continue
}
```

---

## 第 541-554 行：上下文溢出检查

```typescript
// 541-554: 检查是否需要压缩
if (
  lastFinished &&
  lastFinished.summary !== true &&
  (await SessionCompaction.isOverflow({ tokens: lastFinished.tokens, model }))
) {
  // 创建压缩任务
  await SessionCompaction.create({
    sessionID,
    agent: lastUser.agent,
    model: lastUser.model,
    auto: true,
  })
  continue
}
```

**解释：**

- 如果上下文接近模型限制，自动创建压缩任务

---

## 第 556-564 行：正常处理（调用 LLM）

```typescript
// 556-559: 获取 Agent 和最大步数
const agent = await Agent.get(lastUser.agent)
const maxSteps = agent.steps ?? Infinity
const isLastStep = step >= maxSteps

// 560-564: 注入系统提醒（如 Plan 模式提示词）
msgs = await insertReminders({
  messages: msgs,
  agent,
  session,
})
```

---

## 第 566-595 行：创建处理器

```typescript
// 566-595: 创建 SessionProcessor
const processor = SessionProcessor.create({
  assistantMessage: (await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: lastUser.id,
    role: "assistant",
    mode: agent.name,
    agent: agent.name,
    variant: lastUser.variant,
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.id,
    providerID: model.providerID,
    time: { created: Date.now() },
    sessionID,
  })) as MessageV2.Assistant,
  sessionID: sessionID,
  model,
  abort,
})

// 596: 使用 defer 清理
using _ = defer(() => InstructionPrompt.clear(processor.message.id))
```

---

## 第 598-610 行：解析工具

```typescript
// 598-600: 检查用户是否通过 @ 显式调用了某个 Agent
const lastUserMsg = msgs.findLast((m) => m.info.role === "user")
const bypassAgentCheck = lastUserMsg?.parts.some((p) => p.type === "agent") ?? false

// 602-610: 获取可用工具列表
const tools = await resolveTools({
  agent,
  session,
  model,
  tools: lastUser.tools,
  processor,
  bypassAgentCheck,
  messages: msgs,
})
```

---

## 第 612-620 行：结构化输出

```typescript
// 612-620: 如果需要结构化输出，注入工具
if (lastUser.format?.type === "json_schema") {
  tools["StructuredOutput"] = createStructuredOutputTool({
    schema: lastUser.format.schema,
    onSuccess(output) {
      structuredOutput = output
    },
  })
}
```

---

## 第 622-627 行：会话摘要

```typescript
// 622-627: 第一步时生成会话摘要
if (step === 1) {
  SessionSummary.summarize({
    sessionID: sessionID,
    messageID: lastUser.id,
  })
}
```

---

## 第 629-646 行：包裹待处理用户消息

```typescript
// 629-646: 给队列中的用户消息添加提醒
if (step > 1 && lastFinished) {
  for (const msg of msgs) {
    // 只处理在 lastFinished 之后的用户消息
    if (msg.info.role !== "user" || msg.info.id <= lastFinished.id) continue

    for (const part of msg.parts) {
      // 跳过非文本、已忽略、合成消息
      if (part.type !== "text" || part.ignored || part.synthetic) continue
      if (!part.text.trim()) continue

      // 添加系统提醒
      part.text = [
        "<system-reminder>",
        "The user sent the following message:",
        part.text,
        "",
        "Please address this message and continue with your tasks.",
        "</system-reminder>",
      ].join("\n")
    }
  }
}
```

**解释：**

- 在后续步骤中，如果用户发送了新消息，添加提醒让 LLM 知道

---

## 第 648 行：插件钩子

```typescript
// 648: 插件转换消息
await Plugin.trigger("experimental.chat.messages.transform", {}, { messages: msgs })
```

---

## 第 650-655 行：构建系统提示词

```typescript
// 650-651: 构建系统提示词
const system = [
  ...(await SystemPrompt.environment(model)), // 环境信息
  ...(await InstructionPrompt.system()), // 指令文件
]

// 652: 获取输出格式
const format = lastUser.format ?? { type: "text" }

// 653-655: 如果是 JSON schema 模式，添加指令
if (format.type === "json_schema") {
  system.push(STRUCTURED_OUTPUT_SYSTEM_PROMPT)
}
```

---

## 第 657-677 行：调用 LLM

```typescript
// 657-677: 调用 SessionProcessor.process() 处理对话
const result = await processor.process({
  user: lastUser,
  agent,
  abort,
  sessionID,
  system,
  messages: [
    ...MessageV2.toModelMessages(msgs, model),
    ...(isLastStep ? [{ role: "assistant", content: MAX_STEPS }] : []), // 最后一步添加提醒
  ],
  tools,
  model,
  toolChoice: format.type === "json_schema" ? "required" : undefined,
})
```

**解释：**

- 这是真正的 LLM 调用
- 包含系统提示词、消息历史、可用工具
- 返回结果可能是 "stop"、"compact" 或 "continue"

---

## 第 679-686 行：结构化输出处理

```typescript
// 679-686: 如果捕获到结构化输出，立即返回
if (structuredOutput !== undefined) {
  processor.message.structured = structuredOutput
  processor.message.finish = processor.message.finish ?? "stop"
  await Session.updateMessage(processor.message)
  break
}
```

---

## 第 688-701 行：模型完成检查

```typescript
// 688-689: 检查模型是否完成
const modelFinished = processor.message.finish && !["tool-calls", "unknown"].includes(processor.message.finish)

// 691-701: 如果完成但需要结构化输出却没输出，报错
if (modelFinished && !processor.message.error) {
  if (format.type === "json_schema") {
    processor.message.error = new MessageV2.StructuredOutputError({
      message: "Model did not produce structured output",
      retries: 0,
    }).toObject()
    await Session.updateMessage(processor.message)
    break
  }
}
```

---

## 第 703-712 行：循环控制

```typescript
// 703: 如果返回 stop，退出循环
if (result === "stop") break

// 704-711: 如果返回 compact，创建压缩任务
if (result === "compact") {
  await SessionCompaction.create({
    sessionID,
    agent: lastUser.agent,
    model: lastUser.model,
    auto: true,
  })
}

// 712: 继续下一次循环
continue
```

---

## 第 714-723 行：循环结束处理

```typescript
// 714: 压缩旧消息
SessionCompaction.prune({ sessionID })

// 715-722: 返回最后的助手消息
for await (const item of MessageV2.stream(sessionID)) {
  if (item.info.role === "user") continue

  // 解析等待队列中的回调
  const queued = state()[sessionID]?.callbacks ?? []
  for (const q of queued) {
    q.resolve(item)
  }

  return item
}

// 723: 不可能到达这里
throw new Error("Impossible")
```

---

## loop() 函数流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    loop() 主循环                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 启动/恢复会话                                           │
│     ↓                                                        │
│  2. while(true) {                                           │
│                                                              │
│     3. 设置状态为 busy                                       │
│     4. 获取消息历史                                          │
│     5. 查找关键消息 (lastUser, lastFinished, tasks)         │
│                                                              │
│     6. 检查退出条件 ────────────────────────────────────     │
│        │                                                    │
│        ├─→ 是 → break                                      │
│        │                                                    │
│        └─→ 否 ↓                                            │
│                                                              │
│     7. step++                                               │
│     8. 如果是第一步 → ensureTitle()                         │
│                                                              │
│     9. 获取模型                                             │
│                                                              │
│    10. 处理待处理任务 ─────────────────────────────────     │
│        │                                                    │
│        ├─→ subtask → 执行子任务 → continue                  │
│        │                                                    │
│        ├─→ compaction → 执行压缩 → continue                 │
│        │                                                    │
│        └─→ 无 ↓                                            │
│                                                              │
│    11. 检查上下文溢出 ─────────────────────────────────     │
│        │                                                    │
│        ├─→ 是 → 创建压缩任务 → continue                     │
│        │                                                    │
│        └─→ 否 ↓                                            │
│                                                              │
│    12. 正常处理 ────────────────────────────────────────   │
│        │                                                    │
│        ├─→ insertReminders()                               │
│        ├─→ resolveTools()                                  │
│        ├─→ processor.process() → LLM 调用                   │
│        │                                                    │
│        └─→ 检查结果 ─────────────────────────────────     │
│             │                                               │
│             ├─→ stop → break                               │
│             ├─→ compact → 创建压缩 → continue                │
│             └─→ continue → 继续循环                         │
│                                                              │
│    }                                                        │
│                                                              │
│ 13. prune() 压缩                                            │
│ 14. 返回最后的助手消息                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 总结

| 行号    | 功能                           |
| ------- | ------------------------------ |
| 275-293 | 初始化：启动会话、变量设置     |
| 294-325 | 消息遍历、退出条件检查         |
| 327-347 | 标题生成、模型获取             |
| 348-539 | 任务处理：Subtask / Compaction |
| 541-554 | 上下文溢出检查                 |
| 556-677 | 正常 LLM 调用流程              |
| 679-712 | 循环控制                       |
| 714-723 | 结束处理                       |
