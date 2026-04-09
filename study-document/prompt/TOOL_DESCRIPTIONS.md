# 工具提示词文档

本文档列出 OpenCode 所有内置工具的提示词说明。

---

## 目录

| 编号 | 工具        | 文件            | 行数 |
| ---- | ----------- | --------------- | ---- |
| 01   | todowrite   | todowrite.txt   | 167  |
| 02   | todoread    | todoread.txt    | 14   |
| 03   | task        | task.txt        | ~120 |
| 04   | read        | read.txt        | ~30  |
| 05   | edit        | edit.txt        | ~35  |
| 06   | write       | write.txt       | ~20  |
| 07   | multiedit   | multiedit.txt   | ~60  |
| 08   | apply_patch | apply_patch.txt | ~30  |
| 09   | bash        | bash.txt        | ~300 |
| 10   | glob        | glob.txt        | ~20  |
| 11   | grep        | grep.txt        | ~20  |
| 12   | ls          | ls.txt          | ~10  |
| 13   | webfetch    | webfetch.txt    | ~25  |
| 14   | websearch   | websearch.txt   | ~25  |
| 15   | codesearch  | codesearch.txt  | ~25  |
| 16   | skill       | skill.txt       | ~30  |
| 17   | lsp         | lsp.txt         | ~20  |
| 18   | question    | question.txt    | ~20  |
| 19   | plan-enter  | plan-enter.txt  | ~20  |
| 20   | plan-exit   | plan-exit.txt   | ~20  |
| 21   | batch       | batch.txt       | ~30  |

---

## 01. todowrite - 写待办事项

**文件**: `packages/opencode/src/tool/todowrite.txt`

**行数**: 167 行 (最大)

### 描述摘要

Use this tool to write your todo list. Your todo list helps you track and manage your progress on tasks.

### 中文说明

用于写入待办事项列表。帮助跟踪和管理任务进度。

---

## 02. todoread - 读待办事项

**文件**: `packages/opencode/src/tool/todoread.txt`

**行数**: 14 行

### 描述摘要

Use this tool to read your todo list.

### 中文说明

用于读取待办事项列表。

---

## 03. task - 任务/子 Agent

**文件**: `packages/opencode/src/tool/task.txt`

**行数**: ~120 行

### 描述摘要

Launch a new agent to handle complex, multistep tasks autonomously. When using this tool, send a message to the new agent containing all relevant context and instructions.

### 中文说明

启动新的 agent 来自主处理复杂的多步骤任务。

---

## 04. read - 读文件

**文件**: `packages/opencode/src/tool/read.txt`

**行数**: ~30 行

### 描述摘要

Read a file from the filesystem. Returns the contents of the file.

### 中文说明

从文件系统读取文件，返回文件内容。

---

## 05. edit - 编辑文件

**文件**: `packages/opencode/src/tool/edit.txt`

**行数**: ~35 行

### 描述摘要

Edit a file by applying a patch. The edit will fail if the file has been modified since you last read it.

### 中文说明

通过应用补丁编辑文件。如果文件自上次读取后已被修改，编辑将失败。

---

## 06. write - 写文件

**文件**: `packages/opencode/src/tool/write.txt`

**行数**: ~20 行

### 描述摘要

Write a file to the filesystem. This will create a new file or overwrite an existing file.

### 中文说明

将文件写入文件系统。创建新文件或覆盖现有文件。

---

## 07. multiedit - 多处编辑

**文件**: `packages/opencode/src/tool/multiedit.txt`

**行数**: ~60 行

### 描述摘要

Edit multiple files or apply multiple edits to a single file in a single tool call.

### 中文说明

在单次工具调用中编辑多个文件或对单个文件应用多个编辑。

---

## 08. apply_patch - 应用补丁

**文件**: `packages/opencode/src/tool/apply_patch.txt`

**行数**: ~30 行

### 描述摘要

Apply a unified diff (diff -U) patch to a file. Alternative to the edit tool for more complex changes.

### 中文说明

应用统一 diff 补丁到文件。适用于更复杂的更改。

---

## 09. bash - 终端命令

**文件**: `packages/opencode/src/tool/bash.txt`

**行数**: ~300 行 (第二长)

### 描述摘要

Execute a bash command. Use this to run any command-line programs.

### 中文说明

执行 bash 命令。用于运行任何命令行程序。

---

## 10. glob - 文件搜索

**文件**: `packages/opencode/src/tool/glob.txt`

**行数**: ~20 行

### 描述摘要

Find files by name pattern. Similar to the find command.

### 中文说明

按名称模式查找文件。类似于 find 命令。

---

## 11. grep - 代码搜索

**文件**: `packages/opencode/src/tool/grep.txt`

**行数**: ~20 行

### 描述摘要

Search for a pattern in files. Uses regular expression pattern matching.

### 中文说明

在文件中搜索模式。使用正则表达式模式匹配。

---

## 12. ls - 列出目录

**文件**: `packages/opencode/src/tool/ls.txt`

**行数**: ~10 行

### 描述摘要

List files in a directory.

### 中文说明

列出目录中的文件。

---

## 13. webfetch - 网页抓取

**文件**: `packages/opencode/src/tool/webfetch.txt`

**行数**: ~25 行

### 描述摘要

Fetch content from a URL. Extracts the main content from web pages.

### 中文说明

从 URL 获取内容。提取网页的主要内容。

---

## 14. websearch - 网络搜索

**文件**: `packages/opencode/src/tool/websearch.txt`

**行数**: ~25 行

### 描述摘要

Search the web using Exa AI. Performs real-time web searches.

### 中文说明

使用 Exa AI 搜索网络。执行实时网络搜索。

---

## 15. codesearch - 代码搜索

**文件**: `packages/opencode/src/tool/codesearch.txt`

**行数**: ~25 行

### 描述摘要

Search and get relevant context for any programming task using Exa Code API.

### 中文说明

使用 Exa Code API 搜索和获取任何编程任务的相关上下文。

---

## 16. skill - 技能加载

**文件**: `packages/opencode/src/tool/skill.txt`

**行数**: ~30 行

### 描述摘要

Load a specialized skill that provides domain-specific instructions and workflows.

### 中文说明

加载提供领域特定指令和工作流程的专用技能。

---

## 17. lsp - LSP 操作

**文件**: `packages/opencode/src/tool/lsp.txt`

**行数**: ~20 行

### 描述摘要

Interact with Language Server Protocol (LSP) servers to get code intelligence features.

### 中文说明

与语言服务器协议 (LSP) 服务器交互，获取代码智能功能。

---

## 18. question - 提问用户

**文件**: `packages/opencode/src/tool/question.txt`

**行数**: ~20 行

### 描述摘要

Ask the user a question. Use when you need clarification or additional information.

### 中文说明

向用户提问。需要澄清或额外信息时使用。

---

## 19. plan-enter - 进入计划模式

**文件**: `packages/opencode/src/tool/plan-enter.txt`

**行数**: ~20 行

### 描述摘要

Switch to plan mode. Allows planning without making changes.

### 中文说明

切换到计划模式。允许在不进行更改的情况下进行规划。

---

## 20. plan-exit - 退出计划模式

**文件**: `packages/opencode/src/tool/plan-exit.txt`

**行数**: ~20 行

### 描述摘要

Exit plan mode and return to build mode.

### 中文说明

退出计划模式并返回构建模式。

---

## 21. batch - 批量操作

**文件**: `packages/opencode/src/tool/batch.txt`

**行数**: ~30 行

### 描述摘要

Run multiple tool calls in parallel or sequence. Use to batch multiple independent operations.

### 中文说明

并行或顺序运行多个工具调用。用于批处理多个独立操作。

---

## 工具分类汇总

| 分类     | 工具                                               |
| -------- | -------------------------------------------------- |
| 文件操作 | read, write, edit, multiedit, apply_patch          |
| 搜索     | glob, grep, ls, codesearch                         |
| 命令执行 | bash                                               |
| 任务管理 | task, todowrite, todoread                          |
| 网络     | webfetch, websearch                                |
| 特殊功能 | skill, lsp, question, plan-enter, plan-exit, batch |

---

## 提示词大小排名

| 排名 | 工具      | 行数 | 大小 |
| ---- | --------- | ---- | ---- |
| 1    | todowrite | 167  | 9KB  |
| 2    | bash      | ~300 | 10KB |
| 3    | task      | ~120 | 4KB  |
| 4    | multiedit | ~60  | 2KB  |
| 5    | 其他      | <40  | <1KB |

---

## 文件位置索引

```
packages/opencode/src/tool/
├── todowrite.txt      # 01
├── todoread.txt       # 02
├── task.txt           # 03
├── read.txt           # 04
├── edit.txt           # 05
├── write.txt          # 06
├── multiedit.txt      # 07
├── apply_patch.txt    # 08
├── bash.txt           # 09
├── glob.txt           # 10
├── grep.txt           # 11
├── ls.txt             # 12
├── webfetch.txt       # 13
├── websearch.txt      # 14
├── codesearch.txt     # 15
├── skill.txt          # 16
├── lsp.txt            # 17
├── question.txt       # 18
├── plan-enter.txt     # 19
├── plan-exit.txt      # 20
└── batch.txt          # 21
```

---

## 工具启用条件与 Agent 权限

### 一、工具加载条件

#### 1.1 默认加载的工具

以下工具始终启用，不受任何条件限制：

| 工具        | 说明         |
| ----------- | ------------ |
| invalid     | 无效工具     |
| read        | 读取文件     |
| write       | 写入文件     |
| edit        | 编辑文件     |
| glob        | 文件搜索     |
| grep        | 代码搜索     |
| bash        | 终端命令     |
| task        | 启动子 Agent |
| webfetch    | 网页抓取     |
| todowrite   | 写待办事项   |
| apply_patch | 应用补丁     |
| skill       | 技能加载     |
| codesearch  | 代码搜索     |

#### 1.2 条件加载的工具

以下工具需要满足特定条件才会加载：

| 工具      | 条件                                                                                | 说明                   |
| --------- | ----------------------------------------------------------------------------------- | ---------------------- |
| question  | `OPENCODE_CLIENT in ["app", "cli", "desktop"]` 或 `OPENCODE_ENABLE_QUESTION_TOOL=1` | 提问工具               |
| lsp       | `OPENCODE_EXPERIMENTAL_LSP_TOOL=1`                                                  | LSP 工具（实验性）     |
| batch     | `config.experimental.batch_tool === true`                                           | 批量工具（实验性）     |
| plan-exit | `OPENCODE_EXPERIMENTAL_PLAN_MODE=1` 且 `OPENCODE_CLIENT === "cli"`                  | 退出计划模式（实验性） |

#### 1.3 特殊处理

| 工具      | 处理方式                                                         |
| --------- | ---------------------------------------------------------------- |
| todoread  | 被注释，默认不加载                                               |
| websearch | 仅 `providerID === "opencode"` 或 `OPENCODE_ENABLE_EXA=1` 时启用 |

#### 1.4 apply_patch vs edit 选择

```
模型匹配 gpt-* (非 oss, 非 gpt-4) → 使用 apply_patch
其他情况 → 使用 edit
```

### 二、Agent 工具权限

#### 2.1 build (默认主 Agent)

完整工具权限，基于配置的 permission 规则。

```typescript
permission: {
  question: "allow",      // 允许提问
  plan_enter: "allow",   // 允许进入计划模式
}
```

#### 2.2 plan (计划模式)

只读权限，禁止编辑工具。

```typescript
permission: {
  "*": "deny",           // 默认禁止所有
  edit: "deny",          // 禁止编辑
  question: "allow",     // 允许提问
  plan_exit: "allow",    // 允许退出计划模式
  // 仅允许编辑计划文件
  ".opencode/plans/*.md": "allow"
}
```

#### 2.3 general (通用子 Agent)

```typescript
permission: {
  todoread: "deny",      // 禁止读 Todo
  todowrite: "deny",     // 禁止写 Todo
}
```

#### 2.4 explore (探索子 Agent)

仅允许探索相关工具：

```typescript
permission: {
  "*": "deny",           // 默认禁止所有
  grep: "allow",        // 允许搜索
  glob: "allow",        // 允许文件搜索
  list: "allow",        // 允许列目录
  bash: "allow",        // 允许命令
  webfetch: "allow",   // 允许网页抓取
  websearch: "allow",  // 允许网络搜索
  codesearch: "allow",// 允许代码搜索
  read: "allow",       // 允许读取
}
```

#### 2.5 compaction / title / summary (隐藏 Agent)

```typescript
permission: {
  "*": "deny",          // 禁止所有工具
}
```

### 三、默认权限规则 (defaults)

所有 Agent 继承的默认权限：

```typescript
const defaults = {
  "*": "allow",                    // 默认允许所有
  doom_loop: "ask",               // 死循环检测询问
  external_directory: {
    "*": "ask",                   // 外部目录默认询问
    ...whitelistedDirs: "allow"  // Skill 目录白名单
  },
  question: "deny",               // 禁止提问
  plan_enter: "deny",           // 禁止进入计划模式
  plan_exit: "deny",            // 禁止退出计划模式
  read: {
    "*": "allow",                // 允许读取
    "*.env": "ask",              // .env 询问
    "*.env.*": "ask",            // .env.xxx 询问
    "*.env.example": "allow"     // .env.example 允许
  }
}
```

### 四、权限动作

| Action  | 行为               |
| ------- | ------------------ |
| `allow` | 允许执行，无需询问 |
| `deny`  | 禁止执行，抛出错误 |
| `ask`   | 需要用户确认       |

### 五、环境变量参考

| 环境变量                            | 作用                      |
| ----------------------------------- | ------------------------- |
| `OPENCODE_EXPERIMENTAL_LSP_TOOL=1`  | 启用 LSP 工具             |
| `OPENCODE_ENABLE_QUESTION_TOOL=1`   | 启用提问工具              |
| `OPENCODE_ENABLE_EXA=1`             | 启用 websearch/codesearch |
| `OPENCODE_EXPERIMENTAL_PLAN_MODE=1` | 启用计划模式              |
