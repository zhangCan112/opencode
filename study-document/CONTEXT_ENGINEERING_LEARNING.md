# OpenCode 上下文工程学习计划

本文档为想要深入学习 OpenCode 上下文工程设计而制定的学习计划。

---

## 学习目标

掌握 OpenCode 的提示词工程架构、Agent 系统设计、上下文管理机制以及工具调用流程。

---

## 阶段一：理解整体架构

### 1.1 项目结构概览

首先浏览核心源码目录，了解各模块的职责划分。

**核心目录：**

- `src/session/` — 会话管理与提示词处理
- `src/agent/` — Agent 定义与注册
- `src/tool/` — 工具系统实现
- `src/skill/` — 技能系统
- `src/config/` — 配置加载逻辑
- `src/provider/` — LLM Provider 适配

**建议阅读顺序：**

| 顺序 | 文件                         | 作用                   |
| ---- | ---------------------------- | ---------------------- |
| 1    | `src/session/prompt.ts`      | 核心循环，理解整体流程 |
| 2    | `src/agent/agent.ts`         | Agent 定义与内置 Agent |
| 3    | `src/session/system.ts`      | 环境信息构建           |
| 4    | `src/session/instruction.ts` | 指令文件加载           |

---

## 阶段二：提示词系统

### 2.1 提示词分层设计

OpenCode 采用多层提示词叠加的设计，理解这一设计是掌握上下文工程的关键。

**提示词层次：**

```
┌─────────────────────────────────────┐
│ SystemPrompt.environment()          │  ← 动态环境信息
├─────────────────────────────────────┤
│ InstructionPrompt.system()         │  ← AGENTS.md 等指令
├─────────────────────────────────────┤
│ Agent.prompt                        │  ← Agent 特定提示词
├─────────────────────────────────────┤
│ Provider 适配提示词                 │  ← 模型优化
└─────────────────────────────────────┘
```

### 2.2 核心提示词文件

**必须阅读的提示词模板：**

| 文件                                  | 内容                  | 重要性 |
| ------------------------------------- | --------------------- | ------ |
| `src/session/prompt/anthropic.txt`    | 主系统提示词，最完整  | ⭐⭐⭐ |
| `src/agent/prompt/explore.txt`        | Explore 子代理提示词  | ⭐⭐   |
| `src/agent/prompt/title.txt`          | 标题生成提示词        | ⭐     |
| `src/session/prompt/plan.txt`         | Plan 模式提示词       | ⭐⭐⭐ |
| `src/session/prompt/build-switch.txt` | Plan→Build 切换提示词 | ⭐⭐   |

### 2.3 实践任务

1. 对比 `anthropic.txt`、`beast.txt`、`gemini.txt` 的差异
2. 分析 `plan.txt` 中的工作流设计
3. 理解 `InstructionPrompt.system()` 如何递归查找指令文件

---

## 阶段三：Agent 系统

### 3.1 Agent 定义与类型

`src/agent/agent.ts` 定义了 Agent 的完整结构，包括权限、提示词、模型配置等。

**内置 Agent 分类：**

| Agent        | 模式     | 用途                 |
| ------------ | -------- | -------------------- |
| `build`      | primary  | 默认执行代理         |
| `plan`       | primary  | 计划模式（禁止编辑） |
| `explore`    | subagent | 代码探索             |
| `general`    | subagent | 通用任务             |
| `compaction` | primary  | 上下文压缩           |
| `title`      | primary  | 标题生成             |
| `summary`    | primary  | 摘要生成             |

### 3.2 权限系统

每个 Agent 拥有独立的权限规则，支持 glob 模式匹配。

**关键源码：**

- `src/permission/next.ts` — 权限评估逻辑

### 3.3 实践任务

1. 分析 `build` Agent 和 `plan` Agent 的权限差异
2. 理解 Agent 如何通过 `Task` 工具调用子代理
3. 探索如何自定义新 Agent

---

## 阶段四：上下文管理

### 4.1 会话消息结构

**核心文件：**

- `src/session/message-v2.ts` — 消息与 Part 类型定义

**消息 Part 类型：**

- `TextPart` — 文本内容
- `FilePart` — 文件内容
- `AgentPart` — Agent 调用标记
- `SubtaskPart` — 子任务标记
- `CompactionPart` — 压缩标记

### 4.2 上下文压缩

当上下文接近模型限制时，系统会自动触发压缩机制。

**关键源码：**

- `src/session/compaction.ts` — 压缩逻辑

**压缩策略：**

- 保留最近 40K tokens 的工具调用输出
- 旧消息标记为已压缩，仅保留摘要
- 支持手动触发压缩

### 4.3 实践任务

1. 分析 `SessionCompaction.isOverflow()` 的判断逻辑
2. 理解消息流中如何过滤已压缩的消息
3. 探索压缩前后的消息结构变化

---

## 阶段五：工具系统与执行流程

### 5.1 工具注册与执行

**关键源码：**

- `src/tool/registry.ts` — 工具注册表
- `src/tool/task.ts` — Task 工具（启动子代理）
- `src/tool/read.ts` / `edit.ts` / `write.ts` — 文件操作

### 5.2 核心处理循环

`src/session/prompt.ts` 中的 `loop` 函数是整个系统的核心：

```
用户输入 → 创建消息 → Loop {
  1. 构建系统提示词
  2. 加载指令文件
  3. 解析工具权限
  4. 调用 LLM
  5. 执行工具
  6. 检查压缩/结束条件
} → 返回结果
```

### 5.3 实践任务

1. 追踪一次完整的工具调用流程
2. 分析 `TaskTool` 如何创建子会话
3. 理解工具执行前后的权限检查机制

---

## 阶段六：技能系统

### 6.1 Skill 定义与加载

**关键源码：**

- `src/skill/skill.ts` — Skill 加载逻辑
- `**/SKILL.md` — Skill 定义格式

**Skill 搜索路径：**

- `.claude/skills/`
- `.agents/skills/`
- `.opencode/skills/`
- 配置文件指定的路径

### 6.2 实践任务

1. 查看现有 Skill 的定义格式
2. 分析 Skill 如何注入到上下文中

---

## 阶段七：进阶主题

完成基础学习后，可以深入以下高级主题：

### 7.1 Plan 模式工作流

`prompt.ts:1321-1451` 实现了完整的 Plan 模式五阶段工作流：

1. Phase 1: 初始理解（启动 explore 子代理）
2. Phase 2: 设计（启动规划子代理）
3. Phase 3: 审查
4. Phase 4: 编写最终计划
5. Phase 5: 调用 plan_exit

### 7.2 结构化输出

系统支持 JSON Schema 格式的结构化输出，通过 `StructuredOutput` 工具实现。

### 7.3 插件系统

- `src/plugin/index.ts` — 插件加载与事件触发
- 支持在工具执行前后插入钩子

---

## 建议学习顺序

```
第一周
├── 理解整体架构
├── 阅读核心循环代码
└── 分析提示词分层

第二周
├── 深入 Agent 系统
├── 理解权限机制
└── 分析子代理调用

第三周
├── 上下文压缩机制
├── 工具执行流程
└── 技能系统

第四周
├── Plan 模式进阶
├── 自定义 Agent 实践
└── 项目贡献
```

---

## 关键源码索引

| 主题       | 源码位置                     |
| ---------- | ---------------------------- |
| 提示词处理 | `src/session/prompt.ts`      |
| 环境信息   | `src/session/system.ts`      |
| 指令加载   | `src/session/instruction.ts` |
| Agent 定义 | `src/agent/agent.ts`         |
| 消息结构   | `src/session/message-v2.ts`  |
| 上下文压缩 | `src/session/compaction.ts`  |
| 工具注册   | `src/tool/registry.ts`       |
| Task 工具  | `src/tool/task.ts`           |
| 权限系统   | `src/permission/next.ts`     |
| 技能系统   | `src/skill/skill.ts`         |
| 配置加载   | `src/config/config.ts`       |

---

## 相关文档

- [AGENTS.md](../AGENTS.md) — 项目开发规范
- [packages/opencode/README.md](./README.md) — 包说明
