# 阶段三：Agent 系统 — 掌握 Agent 定义与权限机制

本阶段目标是深入理解 OpenCode 的 Agent 系统，掌握 Agent 定义、权限规则、模式分类等核心概念。

---

## 一、Agent 系统概述

Agent 是 OpenCode 的核心执行单元，每个 Agent 拥有独立的：

- 权限配置
- 提示词（可选）
- 模型配置（可选）
- 执行模式

### 1.1 Agent 在提示词系统中的位置

```
┌─────────────────────────────────────────────────────────────┐
│                    完整请求构成                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SessionPrompt.prompt()                                    │
│       ↓                                                    │
│  构建 tools (ToolRegistry)                                 │
│       ↓                                                    │
│  processor.process({                                       │
│    agent: Agent.Info,     ← Agent 配置在这里               │
│    system,                                                     │
│    messages,                                                 │
│    tools,                                                    │
│  })                                                          │
│       ↓                                                    │
│  LLM.stream({                                               │
│    agent: input.agent,  ← 传递给 LLM                       │
│  })                                                          │
│       ↓                                                    │
│  构建最终系统提示词时使用 agent.prompt                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心文件位置

| 功能           | 文件路径           | 行号    |
| -------------- | ------------------ | ------- |
| Agent 定义     | agent/agent.ts     | 24-49   |
| 7 种内置 Agent | agent/agent.ts     | 76-202  |
| 权限评估       | permission/next.ts | 236-243 |
| 权限请求       | permission/next.ts | 131-161 |
| 工具注册       | tool/registry.ts   | 129-170 |

---

## 三、Agent 定义结构

### 3.1 Info Schema

文件：agent/agent.ts:24-49

```typescript
const Info = z.object({
  name: z.string(), // Agent 标识符
  description: z.string().optional(), // 描述
  mode: z.enum(["subagent", "primary", "all"]), // 运行模式
  native: z.boolean().optional(), // 是否原生 Agent
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
  prompt: z.string().optional(), // Agent 专用提示词
  options: z.record(z.string(), z.any()), // 扩展选项
  steps: z.number().int().positive().optional(), // 最大步数
})
```

### 3.2 Agent Mode 类型

| Mode       | 说明     | 使用场景                     |
| ---------- | -------- | ---------------------------- |
| `primary`  | 主 Agent | 用户直接交互，会话默认 Agent |
| `subagent` | 子 Agent | 被 Task 工具调用，并行执行   |
| `all`      | 通用     | 用户自定义 Agent 默认值      |

---

## 四、7 种内置 Agent

文件：agent/agent.ts:76-202

### 4.1 Agent 对比表

| Agent      | Mode     | prompt         | hidden | 用途                   |
| ---------- | -------- | -------------- | ------ | ---------------------- |
| build      | primary  | 无             | ❌     | 默认主 Agent，执行工具 |
| plan       | primary  | 无             | ❌     | 计划模式，禁止编辑     |
| general    | subagent | 无             | ❌     | 通用子 Agent           |
| explore    | subagent | explore.txt    | ❌     | 代码库探索             |
| compaction | primary  | compaction.txt | ✅     | 对话压缩               |
| title      | primary  | title.txt      | ✅     | 标题生成               |
| summary    | primary  | summary.txt    | ✅     | 摘要生成               |

### 4.2 各 Agent 权限特点

#### build (默认主 Agent)

```typescript
{
  name: "build",
  permission: PermissionNext.merge(defaults, {
    question: "allow",
    plan_enter: "allow",
  }, user),
  mode: "primary",
  native: true,
}
```

特点：完整工具权限，允许提问和进入计划模式。

#### plan (计划模式)

```typescript
{
  name: "plan",
  permission: PermissionNext.merge(defaults, {
    edit: { "*": "deny" },  // 禁止所有编辑
    // 只允许编辑计划文件
    [path.join(".opencode", "plans", "*.md")]: "allow",
  }, user),
  mode: "primary",
  native: true,
}
```

特点：只读模式，禁止编辑代码。

#### explore (探索 Agent)

```typescript
{
  name: "explore",
  permission: PermissionNext.merge(defaults, {
    "*": "deny",           // 禁止所有
    grep: "allow",         // 允许搜索
    glob: "allow",        // 允许文件搜索
    read: "allow",        // 允许读取
    bash: "allow",        // 允许命令
  }, user),
  mode: "subagent",
  native: true,
}
```

特点：只读探索工具权限。

---

## 五、权限系统

### 5.1 权限数据结构

文件：permission/next.ts:30-44

```typescript
const Rule = z.object({
  permission: z.string(), // 权限名称 (如 "edit", "read", "bash")
  pattern: z.string(), // 匹配模式 (如 "*", "*.ts", "/path/to/file")
  action: z.enum(["allow", "deny", "ask"]), // 动作
})

const Ruleset = Rule.array() // 规则集合
```

### 5.2 权限动作

| Action  | 行为               |
| ------- | ------------------ |
| `allow` | 允许执行，无需询问 |
| `deny`  | 禁止执行，抛出错误 |
| `ask`   | 需要用户确认       |

### 5.3 权限评估逻辑

文件：permission/next.ts:236-243

```typescript
export function evaluate(permission, pattern, ...rulesets): Rule {
  const merged = merge(...rulesets) // 合并所有规则

  // 从后往前查找最后一个匹配规则
  const match = merged.findLast(
    (rule) => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern),
  )

  // 未匹配时默认询问
  return match ?? { action: "ask", permission, pattern: "*" }
}
```

**关键点：后面的规则优先（findLast）**

### 5.4 权限请求流程

```
工具执行请求
    ↓
Permission.ask({
  permission: "edit",
  patterns: ["src/index.ts"],
  metadata: {...},
})
    ↓
evaluate() 评估规则
    ↓
┌─────────────────────────────────────────┐
│  action = "allow"  → 直接执行          │
│  action = "deny"   → 抛出 DeniedError │
│  action = "ask"    → 暂停等待用户确认  │
└─────────────────────────────────────────┘
```

---

## 六、默认权限配置

文件：agent/agent.ts:51-73

### 6.1 defaults 规则

```typescript
const defaults = PermissionNext.fromConfig({
  "*": "allow", // 默认允许所有
  doom_loop: "ask", // 死循环检测需询问
  external_directory: {
    "*": "ask", // 外部目录默认询问
    ...whitelistedDirs, // Skill 目录白名单
  },
  question: "deny", // 默认禁止提问
  plan_enter: "deny", // 禁止进入计划模式
  plan_exit: "deny", // 禁止退出计划模式
  read: {
    "*": "allow", // 允许读取
    "*.env": "ask", // .env 询问
    "*.env.*": "ask", // .env.xxx 询问
    "*.env.example": "allow", // .env.example 允许
  },
})
```

### 6.2 安全设计

- **.env 文件**：需要用户确认，防止泄露密钥
- **Skill 目录**：自动加入白名单
- **doom_loop**：防止无限循环

---

## 七、用户配置覆盖

文件：agent/agent.ts:205-232

### 7.1 配置格式

```json
{
  "agent": {
    "my-agent": {
      "description": "我的自定义 Agent",
      "mode": "primary",
      "prompt": "你是一个专门的...",
      "permission": {
        "read": "allow",
        "edit": "deny"
      }
    }
  }
}
```

### 7.2 覆盖逻辑

```typescript
// 如果配置了 disable，删除 Agent
if (value.disable) {
  delete result[key]
  continue
}

// 合并配置（用户配置优先）
item.prompt = value.prompt ?? item.prompt
item.permission = PermissionNext.merge(item.permission, PermissionNext.fromConfig(value.permission))
```

---

## 八、Agent 选择流程

### 8.1 默认 Agent 选择

文件：agent/agent.ts:266-281

```typescript
export async function defaultAgent() {
  // 1. 优先使用配置
  if (cfg.default_agent) {
    const agent = agents[cfg.default_agent]
    if (!agent) throw new Error(`agent not found`)
    if (agent.mode === "subagent") throw new Error("subagent cannot be default")
    if (agent.hidden === true) throw new Error("hidden cannot be default")
    return agent.name
  }

  // 2. 找第一个可见的主 Agent
  const primaryVisible = Object.values(agents).find((a) => a.mode !== "subagent" && a.hidden !== true)
  return primaryVisible.name
}
```

### 8.2 选择优先级

```
1. 配置文件 default_agent
2. 第一个非 subagent 且非 hidden 的 Agent
```

---

## 九、Task 工具与子 Agent

### 9.1 Task 调用流程

文件：tool/task.ts

```
用户请求 → Task 工具 → SessionPrompt.prompt({ agent: "explorer" })
                                    ↓
                              使用 explore Agent
                                    ↓
                              返回结果给主 Agent
```

### 9.2 子 Agent 执行特点

- 使用 `mode: "subagent"`
- 独立权限配置
- 结果返回给主 Agent
- 支持并行执行多个

---

## 十、阶段三学习任务

### 任务 1：理解 Agent 定义

目标：掌握 Agent 的数据结构

文件：agent/agent.ts:24-49

阅读要点：

- [ ] Info Schema 各字段含义
- [ ] mode 字段的三种类型
- [ ] native 和 hidden 的区别

---

### 任务 2：理解内置 Agent

目标：掌握 7 种内置 Agent 的配置

文件：agent/agent.ts:76-202

阅读要点：

- [ ] 各 Agent 的权限配置差异
- [ ] prompt 字段的分布情况
- [ ] hidden Agent 的用途

---

### 任务 3：理解权限系统

目标：掌握权限评估机制

文件：permission/next.ts

阅读要点：

- [ ] Rule 和 Ruleset 数据结构
- [ ] evaluate() 函数逻辑
- [ ] ask() 函数的请求流程

---

### 任务 4：理解权限配置

目标：掌握默认权限和安全设计

文件：agent/agent.ts:51-73

阅读要点：

- [ ] .env 文件的特殊处理
- [ ] Skill 目录白名单机制
- [ ] 用户配置覆盖逻辑

---

### 任务 5：理解 Agent 选择

目标：掌握默认 Agent 选择流程

文件：agent/agent.ts:266-281

阅读要点：

- [ ] default_agent 配置优先
- [ ] subagent 不能作为默认
- [ ] hidden Agent 不能作为默认

---

## 十一、阶段三总结

通过本阶段学习，你应该理解：

1. **Agent 数据结构** — Info Schema 各字段含义
2. **7 种内置 Agent** — 权限和用途差异
3. **权限系统** — Rule/Ruleset/Action 结构
4. **权限评估** — evaluate() 函数和匹配逻辑
5. **默认权限** — 安全设计和白名单机制
6. **用户配置** — 覆盖和禁用逻辑
7. **Agent 选择** — 默认 Agent 选择流程

---

## 十二、后续阶段

- **阶段四：** 上下文管理 — 理解消息压缩与状态维护
- **阶段五：** 工具系统 — 学习工具注册与执行流程

---

## 十三、参考资源

| 资源               | 说明                        |
| ------------------ | --------------------------- |
| agent/agent.ts     | Agent 定义与 7 种内置 Agent |
| permission/next.ts | 权限评估与请求              |
| tool/task.ts       | Task 工具与子 Agent         |
| tool/registry.ts   | 工具注册表                  |
