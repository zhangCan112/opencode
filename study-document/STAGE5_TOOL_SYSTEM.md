# 阶段五：工具系统 — 学习工具注册与执行流程

本阶段目标是深入理解 OpenCode 的工具系统，掌握工具注册、执行流程、权限控制等核心概念。

---

## 一、工具系统概述

OpenCode 的工具系统是让大模型与外部世界交互的核心机制。

```
┌─────────────────────────────────────────────────────────────┐
│                    工具系统架构                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 工具注册 (ToolRegistry)                                │
│     └── 内置工具 + 自定义工具 + 插件工具                     │
│                                                             │
│  2. 工具定义 (Tool.define)                                 │
│     └── id + description + parameters + execute              │
│                                                             │
│  3. 工具执行                                               │
│     └── 权限检查 → Hook → 执行 → 输出截断                  │
│                                                             │
│  4. 权限控制                                               │
│     └── PermissionNext.ask()                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心文件位置

| 功能       | 文件路径          | 行号    |
| ---------- | ----------------- | ------- |
| 工具注册表 | tool/registry.ts  | 全文    |
| 工具定义   | tool/tool.ts      | 全文    |
| 工具执行   | session/prompt.ts | 780-826 |
| 权限检查   | session/prompt.ts | 771-778 |
| 内置工具   | tool/\*.ts        | -       |

---

## 三、工具注册 (ToolRegistry)

### 3.1 工具来源

文件：`tool/registry.ts:98-125`

```typescript
async function all(): Promise<Tool.Info[]> {
  return [
    InvalidTool, // 无效工具
    QuestionTool, // 提问工具
    BashTool, // 终端命令
    ReadTool, // 读取文件
    GlobTool, // 文件搜索
    GrepTool, // 代码搜索
    EditTool, // 编辑文件
    WriteTool, // 写入文件
    TaskTool, // 任务/子 Agent
    WebFetchTool, // 网页抓取
    TodoWriteTool, // 写 Todo
    WebSearchTool, // 网络搜索
    CodeSearchTool, // 代码搜索
    SkillTool, // Skill 加载
    ApplyPatchTool, // 应用补丁
    ...(Flag.OPENCODE_EXPERIMENTAL_LSP_TOOL ? [LspTool] : []), // LSP 工具
    ...custom, // 自定义工具
  ]
}
```

### 3.2 工具分类

| 分类     | 工具                            | 说明               |
| -------- | ------------------------------- | ------------------ |
| 文件操作 | read, write, edit, glob, grep   | 文件读写搜索       |
| 命令执行 | bash                            | 终端命令           |
| 任务管理 | task, todowrite                 | 子 Agent, 待办事项 |
| 网络     | webfetch, websearch, codesearch | 网络请求           |
| 特殊     | skill, lsp, apply_patch         | 技能、LSP、补丁    |
| 提问     | question                        | 向用户提问         |

### 3.3 自定义工具加载

文件：`tool/registry.ts:40-52`

```typescript
// 从配置文件目录加载
const matches = await Config.directories().then((dirs) =>
  dirs.flatMap((dir) => Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true })),
)

// 从插件加载
const plugins = await Plugin.list()
for (const plugin of plugins) {
  for (const [id, def] of Object.entries(plugin.tool ?? {})) {
    custom.push(fromPlugin(id, def))
  }
}
```

---

## 四、工具定义 (Tool)

### 4.1 Tool.Info 结构

文件：`tool/tool.ts:27-43`

```typescript
export interface Info<Parameters extends z.ZodType, M extends Metadata> {
  id: string // 工具唯一标识
  init: (ctx?: InitContext) => Promise<{
    description: string // 工具描述（给模型看）
    parameters: Parameters // 参数 Schema
    execute: (
      args,
      ctx,
    ) => Promise<{
      // 执行函数
      title: string // 标题
      metadata: M // 元数据
      output: string // 输出内容
      attachments?: FilePart[] // 附件
    }>
  }>
}
```

### 4.2 Tool.define 包装器

文件：`tool/tool.ts:48-88`

```typescript
export function define(id, init) {
  return {
    id,
    init: async (initCtx) => {
      const toolInfo = await init(initCtx)

      // 包装 execute 函数
      const execute = toolInfo.execute
      toolInfo.execute = async (args, ctx) => {
        // 1. 参数验证
        toolInfo.parameters.parse(args)

        // 2. 执行
        const result = await execute(args, ctx)

        // 3. 输出截断
        const truncated = await Truncate.output(result.output, {}, initCtx?.agent)
        return {
          ...result,
          output: truncated.content,
          metadata: { ...result.metadata, truncated: truncated.truncated },
        }
      }
      return toolInfo
    },
  }
}
```

### 4.3 定义示例

文件：`tool/read.ts`

```typescript
export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  execute: async (args, ctx) => {
    const content = await Filesystem.readText(args.filePath, args.limit, args.offset)
    return { title: "...", metadata: {...}, output: content }
  }
})
```

---

## 五、工具执行流程

### 5.1 流程概览

文件：`session/prompt.ts:780-826`

```
┌─────────────────────────────────────────────────────────────┐
│                    工具执行流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 获取工具列表                                            │
│     ToolRegistry.tools(model, agent)                        │
│           ↓                                                 │
│  2. 构建工具定义                                            │
│     - description (可被插件修改)                           │
│     - parameters (JSON Schema)                            │
│           ↓                                                 │
│  3. 包装执行函数                                           │
│     - ctx.ask() 权限检查                                  │
│     - Plugin.trigger("tool.execute.before")               │
│     - item.execute() 实际执行                             │
│     - Plugin.trigger("tool.execute.after")                │
│     - 输出截断                                             │
│           ↓                                                 │
│  4. 返回给 LLM                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 核心代码

```typescript
// 1. 获取工具
for (const item of await ToolRegistry.tools(model, agent)) {

  // 2. 构建工具定义
  tools[item.id] = tool({
    description: item.description,
    inputSchema: jsonSchema(schema),

    // 3. 包装执行函数
    async execute(args, options) {
      const ctx = context(args, options)

      // Hook: 执行前
      await Plugin.trigger("tool.execute.before", { tool: item.id, ... }, { args })

      // 执行
      const result = await item.execute(args, ctx)

      // Hook: 执行后
      await Plugin.trigger("tool.execute.after", { tool: item.id, ... }, result)

      return result
    }
  })
}
```

### 5.3 Context 上下文

文件：`session/prompt.ts:746-778`

```typescript
const context = (args, options): Tool.Context => ({
  sessionID: input.session.id,
  abort: options.abortSignal!,
  messageID: input.processor.message.id,
  callID: options.toolCallId,
  agent: input.agent.name,

  // 可用的方法：
  messages: input.messages,                    // 对话历史
  metadata: (val) => {...},                  // 设置元数据
  ask: async (req) => {...},                 // 请求权限
})
```

---

## 六、权限控制

### 6.1 权限检查时机

工具执行前通过 `ctx.ask()` 检查权限。

```typescript
async execute(args, options) {
  const ctx = context(args, options)

  // 权限检查
  await ctx.ask({
    permission: "edit",           // 权限类型
    patterns: ["src/*.ts"],      // 匹配模式
    always: ["*.ts"],            // 记住选择
    metadata: {},
  })

  // 执行...
}
```

### 6.2 权限规则

文件：`permission/next.ts`

```typescript
// Agent 默认权限
const defaults = PermissionNext.fromConfig({
  "*": "allow", // 默认允许
  question: "deny", // 禁止提问
  plan_enter: "deny", // 禁止进入计划模式
  edit: { "*": "deny" }, // 禁止编辑
})
```

### 6.3 权限动作

| Action  | 行为     |
| ------- | -------- |
| `allow` | 允许执行 |
| `deny`  | 拒绝执行 |
| `ask`   | 询问用户 |

---

## 七、工具描述

### 7.1 描述文件

每个工具有一个 `.txt` 文件描述其用途：

| 文件           | 工具  | 内容         |
| -------------- | ----- | ------------ |
| tool/read.txt  | read  | 读取文件说明 |
| tool/edit.txt  | edit  | 编辑文件说明 |
| tool/task.txt  | task  | 任务工具说明 |
| tool/skill.txt | skill | 技能加载说明 |
| tool/lsp.txt   | lsp   | LSP 操作说明 |

### 7.2 描述格式

```
Read a file from the filesystem.

Tools can read files from the filesystem and return the contents.

Arguments:
- filePath: The path to the file to read (required)
- limit: Maximum number of lines to read (optional)
- offset: Line number to start reading from (optional)

Notes:
- Supports large files through limit/offset
- Returns error if file doesn't exist
```

### 7.3 动态描述

某些工具的描述是动态生成的：

```typescript
// SkillTool - 动态列出可用技能
const description = [
  "Load a specialized skill...",
  "",
  "<available_skills>",
  ...accessibleSkills.flatMap((skill) => [
    `  <skill>`,
    `    <name>${skill.name}</name>`,
    `    <description>${skill.description}</description>`,
    `  </skill>`,
  ]),
  "</available_skills>",
].join("\n")
```

---

## 八、插件 Hook

### 8.1 可用 Hook

| Hook                  | 时机       | 用途               |
| --------------------- | ---------- | ------------------ |
| `tool.definition`     | 工具定义时 | 修改工具描述       |
| `tool.execute.before` | 执行前     | 修改参数、记录日志 |
| `tool.execute.after`  | 执行后     | 监听结果、处理输出 |

### 8.2 使用示例

```typescript
// 监听工具执行
Plugin.trigger("tool.execute.after", {
  tool: "read",
  sessionID: "...",
  args: { filePath: "src/index.ts" }
}, {
  output: "...",
  metadata: {...}
})
```

---

## 九、输出截断

### 9.1 截断机制

文件：`tool/tool.ts:70-83`

```typescript
// 执行后截断
const truncated = await Truncate.output(result.output, {}, agent)
return {
  ...result,
  output: truncated.content,
  metadata: {
    ...result.metadata,
    truncated: truncated.truncated,
    outputPath: truncated.outputPath, // 如果截断，保存到文件
  },
}
```

### 9.2 截断策略

- 超过限制的输出保存到临时文件
- 返回文件路径而非完整内容
- 支持大文件处理

---

## 十、阶段五学习任务

### 任务 1：理解工具注册

目标：掌握工具如何注册到系统

文件：tool/registry.ts

阅读要点：

- [ ] 内置工具列表
- [ ] 自定义工具加载
- [ ] 插件工具加载

---

### 任务 2：理解工具定义

目标：掌握工具的数据结构

文件：tool/tool.ts

阅读要点：

- [ ] Tool.Info 接口
- [ ] Tool.define 包装器
- [ ] 参数验证

---

### 任务 3：理解工具执行流程

目标：掌握工具从定义到执行的完整流程

文件：session/prompt.ts:780-826

阅读要点：

- [ ] 工具获取
- [ ] Hook 机制
- [ ] 权限检查

---

### 任务 4：理解权限控制

目标：掌握工具权限检查机制

文件：session/prompt.ts:771-778

阅读要点：

- [ ] ctx.ask() 方法
- [ ] 权限规则
- [ ] allow/deny/ask 动作

---

### 任务 5：理解输出截断

目标：掌握大文件处理机制

文件：tool/tool.ts:70-83, tool/truncation.ts

阅读要点：

- [ ] 截断时机
- [ ] 文件保存
- [ ] 元数据标记

---

## 十一、阶段五总结

通过本阶段学习，你应该理解：

1. **工具注册** — ToolRegistry 管理所有工具
2. **工具定义** — Tool.define 标准化工具结构
3. **执行流程** — 获取 → 定义 → 权限 → 执行 → Hook
4. **权限控制** — ctx.ask() 进行权限检查
5. **输出截断** — Truncate.output 处理大文件
6. **插件扩展** — Hook 系统可修改工具行为

---

## 十二、参考资源

| 资源               | 说明       |
| ------------------ | ---------- |
| tool/registry.ts   | 工具注册表 |
| tool/tool.ts       | 工具定义   |
| tool/\*.ts         | 各工具实现 |
| session/prompt.ts  | 工具执行   |
| permission/next.ts | 权限系统   |
