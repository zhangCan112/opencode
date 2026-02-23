# 阶段一：理解整体架构

本阶段目标是建立对 OpenCode 项目的全局认知，理解核心模块职责和整体数据流。

---

## 一、项目概述

OpenCode 是一个开源的 AI 编程代理（coding agent），采用 TypeScript/Bun 开发，核心设计围绕**会话管理**、**提示词工程**、**Agent 系统**和**工具执行**四大模块。

---

## 二、核心目录结构

```
packages/opencode/src/
│
├── session/              # 核心模块：会话管理与提示词处理
│   ├── prompt.ts         # 核心循环入口，处理用户输入并管理对话流程
│   ├── processor.ts      # LLM 调用处理，流式响应解析
│   ├── message-v2.ts     # 消息结构定义
│   ├── system.ts        # 环境信息构建
│   ├── instruction.ts    # 指令文件加载 (AGENTS.md)
│   ├── compaction.ts    # 上下文压缩机制
│   └── summary.ts       # 会话摘要生成
│
├── agent/                # Agent 系统
│   └── agent.ts         # Agent 定义与 7 种内置 Agent
│
├── tool/                 # 工具系统
│   ├── registry.ts      # 工具注册表
│   ├── task.ts          # Task 工具（启动子代理）
│   ├── read.ts          # 文件读取
│   ├── edit.ts          # 文件编辑
│   ├── write.ts         # 文件写入
│   ├── bash.ts          # 命令执行
│   ├── grep.ts          # 代码搜索
│   ├── glob.ts          # 文件搜索
│   └── ...
│
├── skill/                # 技能系统
│   └── skill.ts         # Skill 加载逻辑
│
├── config/               # 配置系统
│   ├── config.ts        # 配置加载与合并
│   └── markdown.ts      # Markdown 配置解析
│
├── permission/           # 权限系统
│   └── next.ts          # 基于规则的权限评估
│
├── provider/             # LLM Provider 适配
│   └── provider.ts      # 模型选择与 API 调用
│
├── storage/              # 数据持久化
│   ├── db.ts           # 数据库连接
│   └── schema.ts       # Drizzle schema 定义
│
└── util/                 # 工具函数
    ├── log.ts           # 日志
    ├── filesystem.ts    # 文件操作
    └── ...
```

---

## 三、核心入口：src/index.ts

**作用：** CLI 入口，定义所有命令。

**关键命令：**
| 命令 | 作用 |
|------|------|
| `run` | 启动交互式会话 |
| `agent` | Agent 管理 |
| `serve` | 启动 API 服务 |
| `auth` | 认证配置 |
| `mcp` | MCP 服务器管理 |

**初始化流程：**

1. 解析命令行参数
2. 初始化日志系统
3. 执行数据库迁移
4. 加载配置
5. 执行对应命令

---

## 四、核心流程：会话循环

**核心文件：** `src/session/prompt.ts`

### 4.1 主循环逻辑

```
用户输入
    ↓
SessionPrompt.prompt(input)
    ↓
创建用户消息 (MessageV2)
    ↓
loop() {
    ├── 1. 检查会话状态
    ├── 2. 过滤已压缩的消息
    ├── 3. 检查是否需要压缩上下文
    ├── 4. 构建系统提示词
    │       ├── SystemPrompt.environment() - 环境信息
    │       ├── InstructionPrompt.system() - 指令文件
    │       └── Agent 特定提示词
    ├── 5. 解析工具权限
    ├── 6. SessionProcessor.process() - 调用 LLM
    │       ├── 发送请求
    │       ├── 流式响应处理
    │       └── 工具调用处理
    ├── 7. 执行工具
    ├── 8. 检查结束条件
    └── 9. 循环或结束
    ↓
返回结果
```

### 4.2 关键组件职责

| 组件                         | 职责                     | 位置                 |
| ---------------------------- | ------------------------ | -------------------- |
| `SessionPrompt.prompt()`     | 入口，验证输入并创建消息 | `prompt.ts:158`      |
| `SessionPrompt.loop()`       | 主循环，管理对话流程     | `prompt.ts:274`      |
| `SessionProcessor.process()` | LLM 调用与工具执行       | `processor.ts:45`    |
| `SystemPrompt.environment()` | 构建环境信息             | `system.ts:29`       |
| `InstructionPrompt.system()` | 加载指令文件             | `instruction.ts:117` |

---

## 五、关键数据流

### 5.1 消息生命周期

```
1. 用户输入
   ↓
2. PromptInput 验证 (Zod schema)
   ↓
3. 创建 MessageV2 消息
   ├── role: "user"
   ├── parts: [TextPart | FilePart | AgentPart]
   └── model: { providerID, modelID }
   ↓
4. 插入系统提示词 (通过 insertReminders)
   ↓
5. 转换为 Model Messages (AI SDK 格式)
   ↓
6. 调用 LLM
   ↓
7. 流式响应 → 解析为 Assistant 消息
   ↓
8. 工具调用 → 执行工具 → 返回结果
   ↓
9. 循环或结束
```

### 5.2 消息 Part 类型

| 类型             | 作用           | 定义位置            |
| ---------------- | -------------- | ------------------- |
| `TextPart`       | 文本内容       | `message-v2.ts:99`  |
| `FilePart`       | 文件内容       | `message-v2.ts:170` |
| `AgentPart`      | Agent 调用标记 | `message-v2.ts:181` |
| `SubtaskPart`    | 子任务标记     | `message-v2.ts`     |
| `CompactionPart` | 压缩标记       | `message-v2.ts:196` |
| `ReasoningPart`  | 推理过程       | `message-v2.ts:116` |
| `ToolPart`       | 工具调用与结果 | `message-v2.ts`     |

---

## 六、配置加载优先级

**文件：** `src/config/config.ts:69-149`

```
优先级从低到高：
1. 远程 .well-known/opencode (企业配置)
2. 全局配置 ~/.config/opencode/
3. 自定义配置 (OPENCODE_CONFIG 环境变量)
4. 项目配置 (opencode.json)
5. .opencode 目录 (.opencode/agents/, .opencode/commands/)
6. 内联配置 (OPENCODE_CONFIG_CONTENT 环境变量)
7. 托管配置 (企业版 /etc/opencode)
```

---

## 七、阶段一学习任务

### 任务 1：通读 CLI 入口

**目标：** 理解项目如何启动

**文件：** `src/index.ts`

**阅读要点：**

- [ ] Yargs CLI 配置
- [ ] 命令注册方式
- [ ] 全局中间件（日志、数据库迁移）
- [ ] 错误处理机制

---

### 任务 2：浏览会话模块

**目标：** 了解会话管理职责

**文件：** `src/session/` 目录

**浏览要点：**

- [ ] 各文件的导出内容
- [ ] 核心命名空间定义
- [ ] 消息类型定义

---

### 任务 3：理解 Agent 定义

**目标：** 掌握 Agent 系统基础

**文件：** `src/agent/agent.ts`

**阅读要点：**

- [ ] Agent.Info 类型定义
- [ ] 7 种内置 Agent 的配置
- [ ] 权限规则的结构
- [ ] Agent 状态管理

---

## 八、阶段一总结

通过本阶段学习，你应该理解：

1. **项目结构** — 核心模块的职责划分
2. **入口流程** — 从 CLI 到会话创建的完整链路
3. **核心循环** — prompt → process → tool → loop 的工作方式
4. **数据流** — 消息的创建、转换、与处理

---

## 九、后续阶段

- **阶段二：** 提示词系统 — 深入理解多层提示词设计
- **阶段三：** Agent 系统 — 掌握 Agent 定义与权限机制
- **阶段四：** 上下文管理 — 理解消息压缩与状态维护
- **阶段五：** 工具系统 — 学习工具注册与执行流程

---

## 十、参考资源

| 资源                                                | 说明                |
| --------------------------------------------------- | ------------------- |
| `src/index.ts`                                      | CLI 入口            |
| `src/session/prompt.ts`                             | 核心循环 (1959 行)  |
| `src/session/index.ts`                              | 会话管理 (873 行)   |
| `src/agent/agent.ts`                                | Agent 定义 (339 行) |
| `packages/opencode/CONTEXT_ENGINEERING_LEARNING.md` | 完整学习计划        |
