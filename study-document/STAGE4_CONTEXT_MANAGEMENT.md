# 阶段四：上下文管理 — 理解消息压缩与状态维护

本阶段目标是深入理解 OpenCode 的上下文管理机制，掌握消息压缩（Compaction）、剪枝（Prune）、会话状态维护等核心概念。

---

## 一、上下文管理概述

OpenCode 通过多种机制管理上下文，防止超出模型的上下文窗口：

```
┌─────────────────────────────────────────────────────────────┐
│                    上下文管理机制                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 溢出检测 (isOverflow)                                  │
│     └── 检查是否接近上下文限制                               │
│                                                             │
│  2. 压缩 (Compaction)                                     │
│     └── 调用 compaction agent 总结历史                      │
│                                                             │
│  3. 剪枝 (Prune)                                          │
│     └── 清理旧的工具调用输出                                │
│                                                             │
│  4. 消息过滤                                               │
│     └── 跳过已压缩的消息                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心文件位置

| 功能     | 文件路径              | 行号    |
| -------- | --------------------- | ------- |
| 压缩逻辑 | session/compaction.ts | 全文    |
| 溢出检测 | session/compaction.ts | 32-48   |
| 剪枝逻辑 | session/compaction.ts | 58-99   |
| 压缩执行 | session/compaction.ts | 101-200 |
| 消息过滤 | session/prompt.ts     | 400-450 |

---

## 三、溢出检测 (isOverflow)

### 3.1 检测逻辑

文件：`session/compaction.ts:32-48`

```typescript
export async function isOverflow(input: { tokens: MessageV2.Assistant["tokens"]; model: Provider.Model }) {
  const config = await Config.get()
  if (config.compaction?.auto === false) return false // 禁用则跳过

  const context = input.model.limit.context
  if (context === 0) return false

  // 计算总 token 数
  const count =
    input.tokens.total || input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write

  // 保留空间 = 输出 token 或 20K（取较小值）
  const reserved =
    config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, ProviderTransform.maxOutputTokens(input.model))

  // 可用空间 = 总限制 - 保留空间
  const usable = input.model.limit.input
    ? input.model.limit.input - reserved
    : context - ProviderTransform.maxOutputTokens(input.model)

  return count >= usable
}
```

### 3.2 配置参数

```typescript
const COMPACTION_BUFFER = 20_000 // 默认保留 20K token
```

---

## 四、压缩 (Compaction)

### 4.1 压缩时机

当检测到溢出时，调用 `SessionCompaction.process()` 执行压缩。

### 4.2 压缩流程

文件：`session/compaction.ts:101-200`

```typescript
export async function process(input: {
  parentID: string      // 用户消息 ID
  messages: MessageV2.WithParts[]
  sessionID: string
  abort: AbortSignal
  auto: boolean
}) {
  // 1. 获取用户消息
  const userMessage = input.messages.findLast((m) => m.info.id === input.parentID)!

  // 2. 使用 compaction agent 执行压缩
  const agent = await Agent.get("compaction")
  const model = agent.model
    ? await Provider.getModel(agent.model.providerID, agent.model.modelID)
    : await Provider.getModel(userMessage.model.providerID, userMessage.model.modelID)

  // 3. 创建压缩消息
  const msg = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "assistant",
    parentID: input.parentID,
    sessionID: input.sessionID,
    mode: "compaction",
    agent: "compaction",
    summary: true,  // 标记为摘要消息
    // ...
  })

  // 4. 调用 LLM 生成摘要
  const processor = SessionProcessor.create({...})

  // 5. 构建压缩提示词（可被插件扩展）
  const compacting = await Plugin.trigger(
    "experimental.session.compacting",
    { sessionID: input.sessionID },
    { context: [], prompt: undefined },
  )

  const defaultPrompt = `Provide a detailed prompt for continuing our conversation above.
Focus on information that would be helpful for continuing the conversation...`

  const promptText = compacting.prompt ?? [defaultPrompt, ...compacting.context].join("\n\n")

  // 6. 执行并返回摘要
  // ...
}
```

### 4.3 压缩提示词模板

```markdown
## Goal

[用户想要完成什么目标？]

## Instructions

- [用户给出的重要指令]
- [计划和规范信息]

## Discoveries

[对话中发现的重要信息，对继续工作有帮助]

## Accomplished

[已完成的工作、进行中的工作、剩余工作]

## Relevant files / directories

[相关文件/目录列表]
```

---

## 五、剪枝 (Prune)

### 5.1 剪枝目的

清理旧的工具调用输出，释放上下文空间。

### 5.2 剪枝逻辑

文件：`session/compaction.ts:58-99`

```typescript
export async function prune(input: { sessionID: string }) {
  const config = await Config.get()
  if (config.compaction?.prune === false) return // 可禁用

  const msgs = await Session.messages({ sessionID: input.sessionID })
  let total = 0
  let pruned = 0
  const toPrune = []
  let turns = 0

  loop: for (let msgIndex = msgs.length - 1; msgIndex >= 0; msgIndex--) {
    const msg = msgs[msgIndex]

    // 统计用户消息轮次
    if (msg.info.role === "user") turns++

    // 只处理倒数第二个用户消息之后的内容
    if (turns < 2) continue

    // 遇到已压缩消息则停止
    if (msg.info.role === "assistant" && msg.info.summary) break loop

    // 遍历消息中的工具调用
    for (let partIndex = msg.parts.length - 1; partIndex >= 0; partIndex--) {
      const part = msg.parts[partIndex]
      if (part.type === "tool" && part.state.status === "completed") {
        // skill 工具调用受保护，不剪枝
        if (PRUNE_PROTECTED_TOOLS.includes(part.tool)) continue

        // 已有压缩标记则停止
        if (part.state.time.compacted) break loop

        // 估算 token 并累加
        const estimate = Token.estimate(part.state.output)
        total += estimate

        // 超过阈值则标记待剪枝
        if (total > PRUNE_PROTECT) {
          pruned += estimate
          toPrune.push(part)
        }
      }
    }
  }

  // 执行剪枝
  if (pruned > PRUNE_MINIMUM) {
    for (const part of toPrune) {
      part.state.time.compacted = Date.now() // 标记为已压缩
      await Session.updatePart(part)
    }
  }
}
```

### 5.3 剪枝参数

```typescript
const PRUNE_MINIMUM = 20_000 // 最小剪枝阈值
const PRUNE_PROTECT = 40_000 // 保留 token 数
const PRUNE_PROTECTED_TOOLS = ["skill"] // 保护的工具
```

### 5.4 剪枝策略

| 策略          | 说明                         |
| ------------- | ---------------------------- |
| 保留最近 2 轮 | 倒数第二个用户消息之前不剪枝 |
| 遇到摘要停止  | 遇到 summary 消息后停止      |
| 保护 skill    | skill 工具调用不剪枝         |
| 阈值触发      | 超过 40K token 才剪枝        |

---

## 六、压缩与剪枝的关系（重要）

### 6.1 两者是互补关系

压缩和剪枝是**两种不同的上下文管理机制**，各自有不同的职责：

|              | 压缩 (Compaction)        | 剪枝 (Prune)     |
| ------------ | ------------------------ | ---------------- |
| **触发条件** | 溢出检测 (isOverflow) 时 | **每次循环结束** |
| **执行方式** | 调用 LLM 生成结构化摘要  | 直接修改数据库   |
| **目的**     | 生成可读的上下文摘要     | 释放 token 空间  |
| **保留内容** | 生成 summary 消息        | 保留工具调用记录 |

### 6.2 执行时机

**剪枝不是在压缩之后才执行，而是每次 while(true) 循环结束时都会执行。**

文件：`session/prompt.ts:292-714`

```typescript
let step = 0
while (true) {
  // 1. 获取消息（已过滤压缩的）
  let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))

  // 2. 检查是否需要压缩
  if (isOverflow) {
    await SessionCompaction.create({...})  // 压缩
    continue  // 继续下一轮循环
  }

  // 3. 正常处理...

  // 4. 检查是否退出
  if (lastAssistant?.finish && ...) {
    break
  }

  step++
}

// 5. 循环结束后 - 执行剪枝！
SessionCompaction.prune({ sessionID })
```

### 6.3 调用流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    while(true) 循环                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  第 N 轮:                                                  │
│    1. 获取消息                                             │
│    2. 溢出? → 压缩 → continue (继续下一轮)                │
│    3. 正常处理                                             │
│    4. 检查退出条件                                         │
│       ↓                                                    │
│  第 N+1 轮: (如果没有退出)                                 │
│    ...                                                     │
│       ↓                                                    │
│  退出循环时:                                               │
│    prune()  ← 执行剪枝                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 实际效果对比

假设有这样的对话历史：

```
[用户] 修改 foo.ts
[助手] 调用 edit 工具 → 输出 "已修改"
[用户] 添加测试
[助手] 调用 test 工具 → 输出 "10 passed"
[用户] 重构 bar.ts
[助手] 调用 read 工具 → 输出 "200行代码..."
[助手] 调用 edit 工具 → 输出 "已重构"
...
```

**压缩后：**

```
[摘要消息 - summary: true]
Goal: 修改 foo.ts, 添加测试, 重构 bar.ts
Instructions: ...
Discoveries: ...
Accomplished: 完成了...
Relevant files: foo.ts, bar.ts, test.ts
```

**剪枝后：**

```
[用户] 修改 foo.ts
[助手] 调用 edit 工具 → 输出 ""  (已清空)
[用户] 添加测试
[助手] 调用 test 工具 → 输出 ""  (已清空)
[用户] 重构 bar.ts
[助手] 调用 read 工具 → 输出 ""  (已清空)
[助手] 调用 edit 工具 → 输出 ""  (已清空)
...
```

### 6.5 本质区别

```
压缩 = 总结 + 替换
  → 生成结构化摘要
  → 替换整个历史
  → 给"人"看的

剪枝 = 清理 + 释放
  → 只清理工具输出内容
  → 保留工具调用记录（知道调用了什么工具）
  → 给"机器"看的
```

### 6.6 为什么需要两者？

1. **压缩**：让后续 Agent 能快速理解上下文（生成人类可读的摘要）
2. **剪枝**：释放 token 空间，但保留"调用了什么工具"的记录

简单说：

- **压缩**是给"人"看的（摘要）
- **剪枝**是给"机器"看的（释放空间，但保留调用记录）

---

## 七、消息过滤

### 6.1 过滤已压缩消息

文件：`session/prompt.ts:400-450`

```typescript
// 跳过已压缩的工具调用
if (part.type === "tool" && part.state.time.compacted) {
  // 跳过，不发送给 LLM
}
```

### 6.2 过滤逻辑

```typescript
// 遍历所有消息
for (const msg of msgs) {
  // 如果是摘要消息，只取 summary 部分
  if (msg.info.summary) {
    // 只保留摘要内容
  }

  // 如果有压缩标记的工具调用
  for (const part of msg.parts) {
    if (part.type === "tool" && part.state.time.compacted) {
      // 跳过压缩过的工具调用
    }
  }
}
```

---

## 七、上下文管理流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    完整上下文管理流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  每次 LLM 调用后                                          │
│       ↓                                                    │
│  1. 检查溢出 isOverflow()                                 │
│       ↓                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  溢出?                                                │   │
│  └─────────────────────────────────────────────────────┘   │
│       ↓ 是                                                 │
│  2. 执行压缩 SessionCompaction.process()                  │
│       ├── 调用 compaction agent                            │
│       ├── 生成摘要消息                                      │
│       └── 替换历史                                        │
│       ↓                                                    │
│  3. 执行剪枝 prune()                                      │
│       ├── 估算工具输出 token                              │
│       ├── 超过阈值则压缩旧工具调用                         │
│       └── 标记为已压缩                                    │
│       ↓                                                    │
│  下次调用时                                                │
│       ↓                                                    │
│  4. 过滤已压缩消息                                        │
│       ├── 跳过压缩的工具调用                               │
│       ├── 摘要消息只取 summary                           │
│       └── 发送给 LLM                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、插件扩展点

### 8.1 experimental.session.compacting

文件：`session/compaction.ts:146-150`

```typescript
const compacting = await Plugin.trigger(
  "experimental.session.compacting",
  { sessionID: input.sessionID },
  { context: [], prompt: undefined },
)
```

**用途**：允许插件注入额外上下文或替换压缩提示词。

**返回**：

```typescript
{
  context: string[]    // 额外上下文
  prompt: string      // 自定义提示词
}
```

### 8.2 压缩完成后事件

文件：`session/compaction.ts:22-28`

```typescript
export const Event = {
  Compacted: BusEvent.define("session.compacted", z.object({ sessionID: z.string() })),
}
```

---

## 九、配置选项

### 9.1 配置参数

```typescript
config.compaction = {
  auto: true, // 自动压缩（默认开启）
  prune: true, // 自动剪枝（默认开启）
  reserved: 20000, // 保留 token 数
}
```

### 9.2 禁用压缩

```json
{
  "compaction": {
    "auto": false
  }
}
```

---

## 十、阶段四学习任务

### 任务 1：理解溢出检测

目标：掌握何时触发压缩

文件：session/compaction.ts:32-48

阅读要点：

- [ ] isOverflow 函数逻辑
- [ ] COMPACTION_BUFFER 参数
- [ ] 可用空间计算方式

---

### 任务 2：理解压缩流程

目标：掌握压缩如何执行

文件：session/compaction.ts:101-200

阅读要点：

- [ ] compaction agent 如何调用
- [ ] 压缩提示词模板
- [ ] 摘要消息结构

---

### 任务 3：理解剪枝逻辑

目标：掌握旧工具输出如何清理

文件：session/compaction.ts:58-99

阅读要点：

- [ ] 保护机制（skill 工具）
- [ ] 剪枝阈值
- [ ] 压缩标记

---

### 任务 4：理解消息过滤

目标：掌握已压缩消息如何处理

文件：session/prompt.ts:400-450

阅读要点：

- [ ] 压缩消息过滤逻辑
- [ ] 摘要消息处理

---

### 任务 5：理解插件扩展

目标：掌握如何自定义压缩行为

文件：session/compaction.ts:146-150

阅读要点：

- [ ] experimental.session.compacting hook
- [ ] 上下文注入方式
- [ ] 提示词覆盖

---

## 十一、阶段四总结

通过本阶段学习，你应该理解：

1. **溢出检测** — isOverflow 函数判断是否接近上下文限制
2. **压缩机制** — 调用 compaction agent 生成摘要
3. **剪枝机制** — 清理旧的工具调用输出
4. **消息过滤** — 跳过已压缩的消息
5. **插件扩展** — 通过 hook 自定义压缩行为

---

## 十二、后续阶段

- **阶段五：** 工具系统 — 学习工具注册与执行流程

---

## 十三、参考资源

| 资源                  | 说明           |
| --------------------- | -------------- |
| session/compaction.ts | 压缩与剪枝逻辑 |
| session/prompt.ts     | 消息过滤       |
| tool/registry.ts      | 工具注册       |
