# 提示词文档索引

本文档包含 OpenCode 系统中的提示词中文翻译版本。

---

## 目录

### 主系统提示词 (Provider)

这些提示词根据使用的模型自动选择。

| 文件                                             | 模型      | 说明                       |
| ------------------------------------------------ | --------- | -------------------------- |
| [01-system-anthropic.md](01-system-anthropic.md) | Claude    | 完整的编程 agent 指南      |
| [02-system-beast.md](02-system-beast.md)         | GPT/O1/O3 | 强调自主完成、迭代解决问题 |
| [03-system-codex.md](03-system-codex.md)         | GPT-5     | Codex 专用，强调代码编辑   |
| [04-system-gemini.md](04-system-gemini.md)       | Gemini    | 强调安全、高效、遵循惯例   |
| [05-system-trinity.md](05-system-trinity.md)     | Trinity   | 简洁风格，每次一个工具     |
| [06-system-qwen.md](06-system-qwen.md)           | Qwen/其他 | 简洁风格，强调效率         |

### Agent 专用提示词

| 文件                                             | Agent      | 说明               |
| ------------------------------------------------ | ---------- | ------------------ |
| [07-agent-explore.md](07-agent-explore.md)       | explore    | 代码库探索专家     |
| [08-agent-compaction.md](08-agent-compaction.md) | compaction | 对话压缩摘要       |
| [09-agent-summary.md](09-agent-summary.md)       | summary    | PR 风格摘要        |
| [10-agent-title.md](10-agent-title.md)           | title      | 会话标题生成       |
| [11-plan-mode.md](11-plan-mode.md)               | plan       | 计划模式提醒       |
| [12-build-switch.md](12-build-switch.md)         | -          | 计划切换到构建提醒 |

---

## 提示词选择流程

```
┌─────────────────────────────────────────────────────────────┐
│                    提示词选择流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. 根据模型 ID 选择主系统提示词：                          │
│      - gpt-5 → codex_header.txt                           │
│      - gpt-* / o1 / o3 → beast.txt                        │
│      - claude → anthropic.txt                              │
│      - gemini-* → gemini.txt                               │
│      - trinity → trinity.txt                               │
│      - 其他 → qwen.txt                                     │
│                                                             │
│   2. 如果 agent 有专用提示词（如 explore），则叠加           │
│                                                             │
│   3. 动态注入（根据会话状态）：                               │
│      - plan 模式 → plan.txt                                │
│      - 最大步数 → max-steps.txt                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 完整提示词构成

```
[System Message]
├── SystemPrompt.provider(model)      ← 主系统提示词
├── SystemPrompt.environment(model)   ← 环境信息
├── InstructionPrompt.system()        ← AGENTS.md 等
└── agent.prompt (如果有)             ← Agent 专用提示词

[User Message]
├── 用户输入
└── synthetic parts (动态注入)
    ├── PROMPT_PLAN (plan 模式)
    └── BUILD_SWITCH (切换到 build)
```

---

## 关键概念

### Synthetic Parts

动态注入到用户消息中的内容，不是传统意义上的系统提示词，但会被传递给模型作为上下文。

### 优先级

1. agent.prompt (最高)
2. SystemPrompt.provider(model)
3. InstructionPrompt.system()
4. 动态注入 (synthetic parts)
