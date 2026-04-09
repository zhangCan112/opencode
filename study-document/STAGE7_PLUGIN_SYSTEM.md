# 阶段七：插件系统 — Hook 机制与扩展点

本阶段目标是深入理解 OpenCode 的插件系统，掌握 Hook 机制和扩展点。

---

## 一、插件系统概述

OpenCode 的插件系统允许开发者扩展和定制系统行为，通过 Hook 机制在各种事件点注入自定义逻辑。

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    插件系统架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  内置插件    │    │  NPM 插件   │    │  本地插件   │     │
│  │  INTERNAL   │    │  BUILTIN    │    │  file://    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            ▼                                │
│                   ┌─────────────┐                          │
│                   │   Hooks     │                          │
│                   │  Registry   │                          │
│                   └─────────────┘                          │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              触发点 (Trigger Points)                 │   │
│  │  • tool.execute.before / tool.execute.after        │   │
│  │  • tool.definition                                  │   │
│  │  • experimental.session.compacting                  │   │
│  │  • experimental.chat.system.transform               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心文件位置

| 功能         | 文件路径          | 说明           |
| ------------ | ----------------- | -------------- |
| 插件加载     | plugin/index.ts   | 插件系统核心   |
| 插件类型定义 | @opencode-ai/plugin | 类型定义包   |
| 内置插件     | plugin/codex.ts   | Codex 认证插件 |
| 内置插件     | plugin/copilot.ts | Copilot 认证   |

---

## 三、插件加载流程

### 3.1 加载顺序

文件：`plugin/index.ts`

```typescript
const state = Instance.state(async () => {
  // 1. 加载内部插件 (直接导入)
  const INTERNAL_PLUGINS: PluginInstance[] = [
    CodexAuthPlugin, 
    CopilotAuthPlugin, 
    GitlabAuthPlugin
  ]
  
  for (const plugin of INTERNAL_PLUGINS) {
    const init = await plugin(input)
    if (init) hooks.push(init)
  }

  // 2. 加载默认 NPM 插件
  const BUILTIN = ["opencode-anthropic-auth@0.0.13"]
  
  // 3. 加载用户配置的插件
  let plugins = config.plugin ?? []
  plugins = [...BUILTIN, ...plugins]
  
  for (let plugin of plugins) {
    // 安装并加载插件...
  }
})
```

### 3.2 插件来源

| 来源       | 格式                        | 说明               |
| ---------- | --------------------------- | ------------------ |
| 内置插件   | 直接 import                 | 随 OpenCode 发布   |
| NPM 插件   | `package@version`           | 自动安装           |
| 本地插件   | `file://path/to/plugin`     | 本地开发           |

---

## 四、Hook 类型

### 4.1 Hooks 接口定义

```typescript
interface Hooks {
  // 配置钩子
  config?: (config: Config) => void
  
  // 事件钩子 - 监听所有事件
  event?: (input: { event: any }) => void
  
  // 认证钩子
  auth?: (input: AuthInput) => AuthOutput
  
  // 工具钩子
  tool?: (input: ToolInput) => ToolDefinition
  
  // 工具定义修改
  "tool.definition"?: (input: { toolID: string }, output: { description: string; parameters: any }) => void
  
  // 工具执行前
  "tool.execute.before"?: (input: { tool: string; args: any }, output: { args: any }) => void
  
  // 工具执行后
  "tool.execute.after"?: (input: { tool: string; args: any }, output: any) => void
  
  // 系统提示词转换
  "experimental.chat.system.transform"?: (input: { model: any }, output: { system: string[] }) => void
  
  // 压缩钩子
  "experimental.session.compacting"?: (input: { sessionID: string }, output: { context: string[]; prompt?: string }) => void
}
```

### 4.2 常用 Hook 说明

| Hook                              | 触发时机       | 用途               |
| --------------------------------- | -------------- | ------------------ |
| `tool.definition`                 | 工具定义时     | 修改工具描述       |
| `tool.execute.before`             | 工具执行前     | 修改参数、记录日志 |
| `tool.execute.after`              | 工具执行后     | 处理输出、监控     |
| `experimental.chat.system.transform` | 构建系统提示词时 | 添加自定义提示词 |
| `experimental.session.compacting` | 上下文压缩时   | 自定义压缩行为     |

---

## 五、Trigger 函数

### 5.1 触发机制

文件：`plugin/index.ts`

```typescript
export async function trigger<
  Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "tool">,
  Input = Parameters<Required<Hooks>[Name]>[0],
  Output = Parameters<Required<Hooks>[Name]>[1],
>(name: Name, input: Input, output: Output): Promise<Output> {
  for (const hook of await state().then((x) => x.hooks)) {
    const fn = hook[name]
    if (!fn) continue
    await fn(input, output)  // 执行 hook，修改 output
  }
  return output  // 返回修改后的 output
}
```

### 5.2 使用示例

**修改工具描述**：

```typescript
// 在工具注册时
await Plugin.trigger("tool.definition", { toolID: "read" }, {
  description: originalDescription,
  parameters: originalParameters,
})
// hook 可以修改 description 和 parameters
```

**工具执行前后**：

```typescript
// 执行前
await Plugin.trigger("tool.execute.before", { tool: "edit", args }, { args })

// 执行后
await Plugin.trigger("tool.execute.after", { tool: "edit", args }, result)
```

---

## 六、开发自定义插件

### 6.1 插件结构

```typescript
import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin"

const myPlugin: Plugin = (input: PluginInput) => {
  return {
    // 配置钩子
    config: (config) => {
      console.log("Config loaded:", config)
    },
    
    // 事件监听
    event: ({ event }) => {
      console.log("Event received:", event)
    },
    
    // 工具执行后记录
    "tool.execute.after": (input, output) => {
      console.log(`Tool ${input.tool} executed`)
    },
    
    // 添加自定义系统提示词
    "experimental.chat.system.transform": (input, output) => {
      output.system.push("Custom instruction: Always be helpful.")
    },
  }
}

export default myPlugin
```

### 6.2 PluginInput 接口

```typescript
interface PluginInput {
  client: OpenCodeClient    // API 客户端
  project: ProjectInfo      // 项目信息
  worktree: string          // Worktree 路径
  directory: string         // 工作目录
  serverUrl: string         // 服务器 URL
  $: Bun.$                  // Bun shell
}
```

### 6.3 配置使用

在 `opencode.json` 中配置：

```json
{
  "plugin": [
    "my-plugin@1.0.0",
    "file://./plugins/my-local-plugin.ts"
  ]
}
```

---

## 七、内置插件示例

### 7.1 Codex 认证插件

文件：`plugin/codex.ts`

```typescript
export const CodexAuthPlugin: Plugin = (input) => {
  return {
    auth: async (input) => {
      // 处理 OpenAI Codex 认证
      if (input.provider === "openai") {
        return {
          token: await getOpenAIToken(),
        }
      }
    },
  }
}
```

### 7.2 Copilot 认证插件

文件：`plugin/copilot.ts`

```typescript
export const CopilotAuthPlugin: Plugin = (input) => {
  return {
    auth: async (input) => {
      // 处理 GitHub Copilot 认证
      if (input.provider === "copilot") {
        return {
          token: await getCopilotToken(),
        }
      }
    },
  }
}
```

---

## 八、事件系统

### 8.1 事件订阅

插件可以通过 `event` hook 监听所有系统事件：

```typescript
const myPlugin: Plugin = (input) => {
  return {
    event: ({ event }) => {
      // 监听会话事件
      if (event.type === "session.message") {
        console.log("New message:", event.data)
      }
      
      // 监听错误事件
      if (event.type === "session.error") {
        console.error("Error:", event.data)
      }
    },
  }
}
```

### 8.2 常见事件类型

| 事件类型            | 触发时机       |
| ------------------- | -------------- |
| `session.message`   | 新消息创建     |
| `session.error`     | 发生错误       |
| `session.compacted` | 上下文压缩完成 |
| `tool.execute`      | 工具执行       |

---

## 九、阶段七学习任务

### 任务 1：理解插件加载流程

- [ ] 阅读 `plugin/index.ts` 中的 `state` 函数
- [ ] 理解内置插件、NPM 插件、本地插件的加载顺序

### 任务 2：理解 Hook 机制

- [ ] 分析 `trigger` 函数的实现
- [ ] 理解 input/output 参数的作用

### 任务 3：开发简单插件

- [ ] 创建一个本地插件
- [ ] 实现 `tool.execute.after` hook 记录工具调用

### 任务 4：研究内置插件

- [ ] 阅读 `plugin/codex.ts` 源码
- [ ] 理解认证插件的工作原理

---

## 十、阶段七总结

通过本阶段学习，你应该理解：

1. **插件架构** — 内置、NPM、本地三种插件来源
2. **Hook 机制** — 触发点和修改输出的方式
3. **事件系统** — 监听系统事件
4. **插件开发** — 创建自定义插件的流程

---

## 十一、参考资源

| 资源                    | 说明           |
| ----------------------- | -------------- |
| plugin/index.ts         | 插件系统核心   |
| @opencode-ai/plugin     | 类型定义包     |
| plugin/codex.ts         | Codex 认证插件 |
| plugin/copilot.ts       | Copilot 认证   |