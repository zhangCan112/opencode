# 阶段六：Plan Mode 工作流 — 五阶段规划系统

本阶段目标是深入理解 OpenCode 的 Plan Mode 完整工作流程。

---

## 一、Plan Mode 概述

Plan Mode 是一个专门用于规划而非执行的模式，通过五阶段工作流帮助用户制定完整的实施计划。

### 1.1 Plan Mode 特点

- **只读模式**：禁止编辑代码文件
- **结构化规划**：通过五阶段流程生成完整计划
- **计划文件**：将计划写入 `.opencode/plans/` 目录

### 1.2 与 Build Mode 的区别

| 特性       | Plan Mode        | Build Mode      |
| ---------- | ---------------- | --------------- |
| 编辑代码   | ❌ 禁止          | ✅ 允许         |
| 执行工具   | 只读工具         | 所有工具        |
| 输出       | 计划文件 (.md)   | 代码更改        |
| 适用场景   | 复杂任务规划     | 直接实施        |

---

## 二、核心文件位置

| 功能           | 文件路径               | 说明           |
| -------------- | ---------------------- | -------------- |
| Plan Mode 入口 | session/prompt.ts      | 五阶段工作流   |
| Plan Agent     | agent/agent.ts         | Plan Agent 定义|
| Plan 提示词    | prompt/plan.txt        | 动态注入提示词 |
| Plan 退出工具  | tool/plan.ts           | PlanExit 工具  |

---

## 三、五阶段工作流详解

### Phase 1: 初始理解

**目的**：理解用户需求和代码库结构

**执行内容**：
1. 启动 `explore` 子代理探索代码库
2. 收集相关文件和上下文
3. 理解现有架构

### Phase 2: 设计

**目的**：设计解决方案

**执行内容**：
1. 分析需求与现有代码的差距
2. 设计技术方案
3. 识别潜在风险

### Phase 3: 审查

**目的**：与用户确认设计方向

**执行内容**：
1. 向用户展示初步设计
2. 收集反馈
3. 调整方案

### Phase 4: 编写最终计划

**目的**：生成完整的实施计划

**执行内容**：
1. 编写结构化计划文件
2. 包含具体步骤和文件列表
3. 保存到 `.opencode/plans/` 目录

### Phase 5: 退出计划模式

**目的**：切换到 Build Mode 开始实施

**执行内容**：
1. 调用 `plan_exit` 工具
2. 用户确认切换
3. 进入 Build Mode

---

## 四、Plan Agent 权限配置

```typescript
plan: {
  name: "plan",
  permission: PermissionNext.merge(
    defaults,
    PermissionNext.fromConfig({
      question: "allow",      // 允许提问
      plan_exit: "allow",     // 允许退出计划模式
      edit: {
        "*": "deny",          // 禁止编辑所有文件
        // 仅允许编辑计划文件
        [path.join(".opencode", "plans", "*.md")]: "allow",
      },
    }),
    user,
  ),
  mode: "primary",
  native: true,
}
```

---

## 五、动态提示词注入

### 5.1 注入时机

在 `session/prompt.ts:1321-1369` 中，当检测到 `agent.name === "plan"` 时，动态注入 `PROMPT_PLAN`。

### 5.2 注入代码

```typescript
async function insertReminders(input: { messages; agent; session }) {
  const userMessage = input.messages.findLast((msg) => msg.info.role === "user")

  if (input.agent.name === "plan") {
    userMessage.parts.push({
      type: "text",
      text: PROMPT_PLAN,
      synthetic: true,  // 标记为合成内容
    })
  }
}
```

### 5.3 为什么用 Synthetic Parts

| 方式           | 优点                 | 缺点                     |
| -------------- | -------------------- | ------------------------ |
| 系统提示词     | 模型优先级高         | 无法根据会话状态动态修改 |
| Synthetic Part | 可动态注入、条件控制 | 混在用户消息中           |

---

## 六、计划文件格式

计划文件保存在 `.opencode/plans/` 目录下，格式如下：

```markdown
# 实施计划：[任务名称]

## 目标
[描述要完成的目标]

## 背景
[相关背景信息]

## 实施步骤

### 阶段 1: [步骤名称]
- [ ] 任务 1
- [ ] 任务 2

### 阶段 2: [步骤名称]
- [ ] 任务 1
- [ ] 任务 2

## 相关文件
- `path/to/file1.ts` - 说明
- `path/to/file2.ts` - 说明

## 风险与注意事项
- [风险1]
- [风险2]
```

---

## 七、PlanExit 工具

### 7.1 工具定义

```typescript
export const PlanExitTool = Tool.define("plan_exit", {
  description: "Exit plan mode and switch to build mode",
  parameters: z.object({}),
  execute: async (args, ctx) => {
    // 询问用户是否切换
    await ctx.ask({
      permission: "plan_exit",
      patterns: [],
      metadata: {},
    })
    
    return {
      title: "Switching to build mode",
      output: "Ready to implement the plan",
    }
  },
})
```

### 7.2 触发条件

- 计划已完成编写
- 用户确认可以开始实施
- 没有未解答的问题

---

## 八、阶段六学习任务

### 任务 1：理解 Plan Mode 入口

- [ ] 阅读 `session/prompt.ts` 中的五阶段工作流代码
- [ ] 理解各阶段的触发条件

### 任务 2：理解 Plan Agent 配置

- [ ] 分析 `agent/agent.ts` 中 Plan Agent 的权限
- [ ] 理解为什么只允许编辑计划文件

### 任务 3：理解动态注入机制

- [ ] 阅读 `insertReminders` 函数
- [ ] 理解 Synthetic Parts 的作用

### 任务 4：实践 Plan Mode

- [ ] 使用 Plan Mode 规划一个复杂任务
- [ ] 观察五阶段工作流的执行过程

---

## 九、阶段六总结

通过本阶段学习，你应该理解：

1. **Plan Mode 目的** — 规划而非执行
2. **五阶段工作流** — 理解→设计→审查→编写→退出
3. **权限控制** — 只读模式的安全设计
4. **动态注入** — Synthetic Parts 的原理
5. **计划文件格式** — 结构化的实施计划

---

## 十、参考资源

| 资源                   | 说明           |
| ---------------------- | -------------- |
| session/prompt.ts      | 五阶段工作流   |
| agent/agent.ts         | Plan Agent 定义|
| prompt/plan.txt        | Plan 提示词    |
| tool/plan.ts           | PlanExit 工具  |