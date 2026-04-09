# 工具提示词完整翻译

本文档包含 OpenCode 中所有内置工具的完整英文提示词及其中文翻译。

---

## 1. TodoWrite (待办事项写入)

### English

Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool

Use this tool proactively in these scenarios:

1. Complex multistep tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos. Feel free to edit the todo list based on new information.
6. After completing a task - Mark it complete and add any new follow-up tasks
7. When you start working on a new task, mark the todo as in_progress. Ideally you should only have one todo as in_progress at a time. Complete existing tasks before starting new ones.

## When NOT to Use This Tool

Skip using this tool when:

1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Examples of When to Use the Todo List

<example>
User: I want to add a dark mode toggle to the application settings. Make sure you run the tests and build when you're done!
Assistant: I'll help add a dark mode toggle to your application settings. Let me create a todo list to track this implementation.
*Creates todo list with the following items:*
1. Create dark mode toggle component in Settings page
2. Add dark mode state management (context/store)
3. Implement CSS-in-JS styles for dark theme
4. Update existing components to support theme switching
5. Run tests and build process, addressing any failures or errors that occur
*Begins working on the first task*

<reasoning>
The assistant used the todo list because:
1. Adding dark mode is a multi-step feature requiring UI, state management, and styling changes
2. The user explicitly requested tests and build be run afterward
3. The assistant inferred that tests and build need to pass by adding "Ensure tests and build succeed" as the final task
</reasoning>
</example>

<example>
User: Help me rename the function getCwd to getCurrentWorkingDirectory across my project
Assistant: Let me first search through your codebase to find all occurrences of 'getCwd'.
*Uses grep or search tools to locate all instances of getCwd in the codebase*
Assistant: I've found 15 instances of 'getCwd' across 8 different files. Let me create a todo list to track these changes.
*Creates todo list with specific items for each file that needs updating*

<reasoning>
The assistant used the todo list because:
1. First, the assistant searched to understand the scope of the task
2. Upon finding multiple occurrences across different files, it determined this was a complex task with multiple steps
3. The todo list helps ensure every instance is tracked and updated systematically
4. This approach prevents missing any occurrences and maintains code consistency
</reasoning>
</example>

<example>
User: I need to implement these features for my e-commerce site: user registration, product catalog, shopping cart, and checkout flow.
Assistant: I'll help implement these features. First, let's add all the features to the todo list.
*Creates a todo list breaking down each feature into specific tasks based on the project architecture*
Assistant: Let's start with user registration. This will involve creating database models, API endpoints, and frontend forms that integrate with your existing authentication system.

<reasoning>
The assistant used the todo list because:
1. The user provided multiple complex features to implement in a comma separated list
2. The todo list helps organize these large features into manageable tasks
3. This approach allows for tracking progress across the entire implementation
</reasoning>
</example>

<example>
User: Can you help optimize my React application? It's rendering slowly and has performance issues.</user>
Assistant: I'll help optimize your React application. First, let me examine your codebase to identify potential performance bottlenecks.
*Reviews component structure, render patterns, state management, and data fetching*
Assistant: After analyzing your codebase, I've identified several performance issues. Let me create a todo list to track our optimization efforts.
*Creates todo list with items like: 1) Implement memoization for expensive calculations in ProductList, 2) Add virtualization for long lists in Dashboard, 3) Optimize image loading in Gallery component, 4) Fix state update loops in ShoppingCart, 5) Review bundle size and implement code splitting*
Let's start by implementing memoization for the expensive calculations in your ProductList component.</assistant>

<reasoning>
The assistant used the todo list because:
1. First, the assistant examined the codebase to identify specific performance issues
2. Based on this analysis, it identified multiple optimization opportunities
3. Performance optimization is a non-trivial task requiring multiple steps
4. The todo list helps methodically track improvements across different components
5. This systematic approach ensures all performance bottlenecks are addressed
</reasoning>
</example>

## Examples of When NOT to Use the Todo List

<example>
User: How do I print 'Hello World' in Python?
Assistant: In Python, you can print "Hello World" with this simple code:

python
print("Hello World")

This will output the text "Hello World" to the console when executed.</assistant>

<reasoning>
The assistant did not use the todo list because this is a single, trivial task that can be completed in one step. There's no need to track multiple tasks or steps for such a straightforward request.
</reasoning>
</example>

<example>
User: What does the git status command do?
Assistant: The git status command shows the current state of your working directory and staging area. It displays which changes have been staged, which haven't, and which files aren't being tracked by Git. This is a fundamental command for understanding the current state of your repository before making commits.

<reasoning>
The assistant did not use the todo list because this is an informational request with no actual coding task to complete. The user is simply asking for an explanation, not for the assistant to perform multiple steps or tasks.
</reasoning>
</example>

<example>
User: Can you add a comment to the calculateTotal function to explain what it does?
Assistant: Sure, let me add a comment to the calculateTotal function to explain what it does.
* Uses the Edit tool to add a comment to the calculateTotal function *

<reasoning>
The assistant did not use the todo list because this is a single, straightforward task confined to one location in the code. Adding a comment doesn't require tracking multiple steps or systematic organization.
</reasoning>
</example>

<example>
User: Run npm install for me and tell me what happens.
Assistant: I'll run the npm install command for you.

_Executes: npm install_

The command completed successfully. Here's the output:
[Output of npm install command]

All dependencies have been installed according to your package.json file.

<reasoning>
The assistant did not use the todo list because this is a single command execution with immediate results. There are no multiple steps to track or organize, making the todo list unnecessary for this straightforward task.
</reasoning>
</example>

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully
   - cancelled: Task no longer needed

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Cancel tasks that become irrelevant

3. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.

### 中文

使用此工具来创建和管理当前编码会话的结构化任务列表。这可以帮助你跟踪进度、组织复杂任务，并向用户展示你的严谨性。

它还可以帮助用户了解任务的进度和他们请求的整体进度。

## 何时使用此工具

在以下场景中主动使用此工具：

1. 复杂的多步骤任务 - 当任务需要 3 个或更多不同的步骤或操作时
2. 非平凡的复杂任务 - 需要仔细规划或多个操作的任务
3. 用户明确请求待办事项 - 当用户直接要求你使用待办事项时
4. 用户提供多个任务 - 当用户提供需要完成的事项列表时（编号或逗号分隔）
5. 收到新指示后 - 立即将用户需求捕获为待办事项。可以根据新信息编辑待办事项。
6. 完成任务后 - 标记完成并添加任何新的后续任务
7. 开始新任务时，将待办事项标记为 in_progress。理想情况下，一次只能有一个待办事项为 in_progress。先完成现有任务再开始新任务。

## 何时不使用此工具

在以下情况下跳过使用此工具：

1. 只有一个简单直接的任务
2. 任务很琐碎，跟踪它没有组织好处
3. 任务可以在不到 3 个简单步骤内完成
4. 任务纯粹是对话性或信息性的

注意：如果只有一个简单的任务，就不应该使用此工具。在这种情况下，你最好直接完成任务。

## 何时使用待办事项的示例

<example>
用户：我想在应用程序设置中添加一个深色模式切换开关。完成后请务必运行测试和构建！
助手：我会帮助你在应用程序设置中添加深色模式切换开关。让我创建一个待办事项来跟踪这个实现。
*创建包含以下事项的待办事项：*
1. 在设置页面创建深色模式切换组件
2. 添加深色模式状态管理（context/store）
3. 实现深色主题的 CSS-in-JS 样式
4. 更新现有组件以支持主题切换
5. 运行测试和构建过程，解决出现的任何失败或错误
*开始处理第一个任务*

<reasoning>
助手使用待办事项是因为：
1. 添加深色模式是一个多步骤功能，需要 UI、状态管理和样式更改
2. 用户明确要求之后运行测试和构建
3. 助手通过添加"确保测试和构建成功"作为最后一项任务，推断出测试和构建需要通过
</reasoning>
</example>

<example>
用户：帮我把项目中的 getCwd 函数重命名为 getCurrentWorkingDirectory
助手：让我先搜索你的代码库，找到所有 'getCwd' 的出现位置。
*使用 grep 或搜索工具查找代码库中所有 getCwd 的实例*
助手：我发现了 15 个 'getCwd' 实例分布在 8 个不同文件中。让我创建一个待办事项来跟踪这些更改。
*为每个需要更新的文件创建具体的待办事项*

<reasoning>
助手使用待办事项是因为：
1. 首先，助手搜索以了解任务的范围
2. 发现跨不同文件的多个出现后，确定这是一个具有多个步骤的复杂任务
3. 待办事项有助于确保每个实例都被系统地跟踪和更新
4. 这种方法可以防止遗漏任何出现并保持代码一致性
</reasoning>
</example>

<example>
用户：我需要为我的电商网站实现这些功能：用户注册、产品目录、购物车和结账流程。
助手：我会帮助你实现这些功能。首先，让我们把所有功能添加到待办事项中。
*创建一个待办事项，根据项目架构将每个功能分解为具体任务*
助手：让我们从用户注册开始。这将涉及创建数据库模型、API 端点和与现有身份验证系统集成的前端表单。

<reasoning>
助手使用待办事项是因为：
1. 用户提供了逗号分隔的多个复杂功能列表
2. 待办事项有助于将这些大型功能组织成可管理的任务
3. 这种方法允许在整个实现过程中跟踪进度
</reasoning>
</example>

<example>
用户：你能帮我优化我的 React 应用程序吗？它渲染很慢，有性能问题。
助手：我会帮助你优化你的 React 应用程序。首先，让我检查你的代码库以识别潜在的性能瓶颈。
*审查组件结构、渲染模式、状态管理和数据获取*
助手：分析你的代码库后，我发现了几个性能问题。让我创建一个待办事项来跟踪我们的优化工作。
*创建包含以下事项的待办事项：1) 为 ProductList 中的昂贵计算实现记忆化，2) 为 Dashboard 中的长列表添加虚拟化，3) 优化 Gallery 组件中的图像加载，4) 修复 ShoppingCart 中的状态更新循环，5) 审查捆绑大小并实现代码分割*
让我们从为 ProductList 组件中的昂贵计算实现记忆化开始。</assistant>

<reasoning>
助手使用待办事项是因为：
1. 首先，助手检查代码库以识别特定的性能问题
2. 基于此分析，发现了多个优化机会
3. 性能优化是一项需要多个步骤的非平凡任务
4. 待办事项有助于系统地跟踪不同组件的改进
5. 这种系统方法确保所有性能瓶颈都得到解决
</reasoning>
</example>

## 何时不使用待办事项的示例

<example>
用户：如何在 Python 中打印 'Hello World'？
助手：在 Python 中，你可以用这个简单代码打印 "Hello World"：

python
print("Hello World")

执行后，这会将文本 "Hello World" 输出到控制台。</assistant>

<reasoning>
助手没有使用待办事项，因为这是一个可以在一步内完成的简单任务。对于如此简单的请求，不需要跟踪多个任务或步骤。
</reasoning>
</example>

<example>
用户：git status 命令是做什么的？
助手：git status 命令显示你当前工作目录和暂存区的状态。它显示哪些更改已被暂存、哪些未被暂存，以及哪些文件没有被 Git 跟踪。这是在提交之前了解仓库当前状态的基本命令。

<reasoning>
助手没有使用待办事项，因为这是一个信息性请求，没有实际需要完成的编码任务。用户只是在询问解释，而不是要求助手执行多个步骤或任务。
</reasoning>
</example>

<example>
用户：你能给 calculateTotal 函数添加一个注释来解释它的作用吗？
助手：当然，让我给 calculateTotal 函数添加一个注释来解释它的作用。
*使用编辑工具给 calculateTotal 函数添加注释*

<reasoning>
助手没有使用待办事项，因为这是一个局限于代码中一个位置的简单直接任务。添加注释不需要跟踪多个步骤或系统组织。
</reasoning>
</example>

<example>
用户：帮我运行 npm install 并告诉我发生了什么。
助手：我会为你运行 npm install 命令。

_执行：npm install_

命令成功完成。以下是输出：
[Output of npm install command]

所有依赖项都已根据你的 package.json 文件安装完成。

<reasoning>
助手没有使用待办事项，因为这是一个立即产生结果的单命令执行。没有多个步骤需要跟踪或组织，使得待办事项对于这个直接的任务是不必要的。
</reasoning>
</example>

## 任务状态和管理

1. **任务状态**：使用这些状态来跟踪进度：
   - pending：任务尚未开始
   - in_progress：正在进行中（一次限制为一个任务）
   - completed：任务已成功完成
   - cancelled：任务不再需要

2. **任务管理**：
   - 在工作时实时更新任务状态
   - 完成后立即标记任务完成（不要批量完成）
   - 任何时候只能有一个任务处于 in_progress 状态
   - 先完成当前任务再开始新任务
   - 取消变得无关紧要的任务

3. **任务分解**：
   - 创建具体、可操作的事项
   - 将复杂任务分解为更小、可管理的步骤
   - 使用清晰、描述性的任务名称

如有疑问，请使用此工具。主动进行任务管理表明你的专注，并能确保你成功完成所有要求。

---


## 3. Task (任务)

### English

Launch a new agent to handle complex, multistep tasks autonomously.

Available agent types and the tools they have access to:
{agents}

When using the Task tool, you must specify a subagent_type parameter to select which agent type to use.

When to use the Task tool:

- When you are instructed to execute custom slash commands. Use the Task tool with the slash command invocation as the entire prompt. The slash command can take arguments. For example: Task(description="Check the file", prompt="/check-file path/to/file.py")

When NOT to use the Task tool:

- If you want to read a specific file path, use the Read or Glob tool instead of the Task tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the Glob tool instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead of the Task tool, to find the match more quickly
- Other tasks that are not related to the agent descriptions above

Usage notes:

1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result. The output includes a task_id you can reuse later to continue the same subagent session.
3. Each agent invocation starts with a fresh context unless you provide task_id to resume the same subagent session (which continues with its previous messages and tool outputs). When starting fresh, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. The agent's outputs should generally be trusted
5. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent. Tell it how to verify its work if possible (e.g., relevant test commands).
6. If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.

Example usage (NOTE: The agents below are fictional examples for illustration only - use the actual agents listed above):

<example_agent_descriptions>
"code-reviewer": use this agent after you are done writing a significant piece of code
"greeting-responder": use this agent when to respond to user greetings with a friendly joke
</example_agent_description>

<example>
user: "Please write a function that checks if a number is prime"
assistant: Sure let me write a function that checks if a number is prime
assistant: First let me use the Write tool to write a function that checks if a number is prime
assistant: I'm going to use the Write tool to write the following code:
<code>
function isPrime(n) {
  if (n <= 1) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}
</code>
<commentary>
Since a significant piece of code was written, the task is completed, now use the code-reviewer agent to review the code
</commentary>
assistant: Now let me use the code-reviewer agent to review the code
assistant: Uses the Task tool to launch the code-reviewer agent
</example>

<example>
user: "Hello"
<commentary>
Since the user is greeting, use the greeting-responder agent to respond with a friendly joke
</commentary>
assistant: "I'm going to use the Task tool to launch the with the greeting-responder agent"
</example>

### 中文

启动一个新的代理来处理复杂的、多步骤的任务。

可用的代理类型及其可访问的工具：
{agents}

使用 Task 工具时，必须指定 subagent_type 参数来选择要使用的代理类型。

何时使用 Task 工具：

- 当你被指示执行自定义斜杠命令时。使用 Task 工具，将斜杠命令调用作为整个提示。斜杠命令可以接受参数。例如：Task(description="检查文件", prompt="/check-file path/to/file.py")

何时不使用 Task 工具：

- 如果你想读取特定的文件路径，请使用 Read 或 Glob 工具而不是 Task 工具，以更快地找到匹配项
- 如果你正在搜索特定的类定义（如 "class Foo"），请使用 Glob 工具而不是 Task 工具，以更快地找到匹配项
- 如果你在特定文件或 2-3 个文件中搜索代码，请使用 Read 工具而不是 Task 工具，以更快地找到匹配项
- 其他与上述代理描述无关的任务

使用说明：

1. 尽可能同时启动多个代理以最大化性能；为此，请使用包含多个工具调用的单条消息
2. 当代理完成时，它将向你返回一条消息。代理返回的结果对用户不可见。要向用户显示结果，你应该向用户发送一条文本消息，总结结果。输出包含一个 task_id，你可以稍后使用它来继续同一子代理会话。
3. 每次代理调用都从新的上下文开始，除非你提供 task_id 来继续同一子代理会话（这会继续其之前的消息和工具输出）。全新开始时，你的提示应该包含代理可以自主执行的详细任务描述，并且你应该准确指定代理应该在其最终且唯一的回复消息中返回给你的信息。
4. 代理的输出通常应该被信任
5. 明确告诉代理你期望它编写代码还是仅做研究（搜索、文件读取、网络获取等），因为它不知道用户的意图。如果可能的话，告诉它如何验证其工作（例如，相关的测试命令）。
6. 如果代理描述提到它应该被主动使用，那么你应该尽力使用它，而不必让用户首先要求你使用它。使用你的判断。

示例用法（注意：下面的代理是仅用于说明的虚构示例 - 请使用上面列出的实际代理）：

<example_agent_descriptions>
"code-reviewer"：在编写完一段重要代码后使用此代理
"greeting-responder"：在响应用户问候时使用此代理，用友好的笑话回复
</example_agent_description>

<example>
用户："请写一个检查数字是否为质数的函数"
助手：当然，让我写一个检查数字是否为质数的函数
助手：首先让我使用 Write 工具写一个检查数字是否为质数的函数
助手：我将使用 Write 工具写入以下代码：
<code>
function isPrime(n) {
  if (n <= 1) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}
</code>
<commentary>
由于已经写了一段重要的代码，任务完成了，现在使用 code-reviewer 代理来审查代码
</commentary>
助手：现在让我使用 code-reviewer 代理来审查代码
助手：使用 Task 工具启动 code-reviewer 代理
</example>

<example>
用户："你好"
<commentary>
由于用户正在问候，使用 greeting-responder 代理用友好的笑话回复
</commentary>
助手："我将使用 Task 工具启动 greeting-responder 代理"
</example>

---

## 4. Read (读取)

### English

Read a file or directory from the local filesystem. If the path does not exist, an error is returned.

Usage:

- The filePath parameter should be an absolute path.
- By default, this tool returns up to 2000 lines from the start of the file.
- The offset parameter is the line number to start from (1-indexed).
- To read later sections, call this tool again with a larger offset.
- Use the grep tool to find specific content in large files or files with long lines.
- If you are unsure of the correct file path, use the glob tool to look up filenames by glob pattern.
- Contents are returned with each line prefixed by its line number as `<line>: <content>`. For example, if a file has contents "foo\n", you will receive "1: foo\n". For directories, entries are returned one per line (without line numbers) with a trailing `/` for subdirectories.
- Any line longer than 2000 characters is truncated.
- Call this tool in parallel when you know there are multiple files you want to read.
- Avoid tiny repeated slices (30 line chunks). If you need more context, read a larger window.
- This tool can read image files and PDFs and return them as file attachments.

### 中文

从本地文件系统读取文件或目录。如果路径不存在，将返回错误。

用法：

- filePath 参数应该是绝对路径。
- 默认情况下，此工具从文件开头返回最多 2000 行。
- offset 参数是起始行号（从 1 开始）。
- 要读取后面的部分，请使用更大的 offset 再次调用此工具。
- 在大文件或长行文件中，使用 grep 工具查找特定内容。
- 如果你不确定正确的文件路径，请使用 glob 工具按 glob 模式查找文件名。
- 内容返回时每行都带有行号前缀，格式为 `<line>: <content>`。例如，如果文件内容是 "foo\n"，你将收到 "1: foo\n"。对于目录，条目每行返回一个（无行号），子目录带有尾随 `/`。
- 任何超过 2000 字符的行都会被截断。
- 当你知道有多个文件想要读取时，并行调用此工具。
- 避免过小的重复切片（30 行块）。如果你需要更多上下文，请读取更大的窗口。
- 此工具可以读取图像文件和 PDF 并将它们作为文件附件返回。

---

## 5. Edit (编辑)

### English

Performs exact string replacements in files.

Usage:

- You must use your `Read` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: line number + colon + space (e.g., `1: `). Everything after that space is the actual file content to match. Never include any part of the line number prefix in the oldString or newString.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if `oldString` is not found in the file with an error "oldString not found in content".
- The edit will FAIL if `oldString` is found multiple times in the file with an error "Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match." Either provide a larger string with more surrounding context to make it unique or use `replaceAll` to change every instance of `oldString`.
- Use `replaceAll` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.

### 中文

在文件中执行精确的字符串替换。

用法：

- 在编辑之前，你必须在对话中至少使用一次 `Read` 工具。如果在未读取文件的情况下尝试编辑，此工具将报错。
- 从 Read 工具输出编辑文本时，确保保留与行号前缀后面完全相同的缩进（制表符/空格）。行号前缀格式是：行号 + 冒号 + 空格（例如，`1: `）。该空格后面的所有内容才是要匹配的实际文件内容。在 oldString 或 newString 中切勿包含行号前缀的任何部分。
- 始终优先编辑代码库中的现有文件。除非明确要求，否则不要写入新文件。
- 只有在用户明确要求时才使用表情符号。除非被要求，否则避免向文件添加表情符号。
- 如果在文件中未找到 `oldString`，编辑将失败，错误为 "oldString not found in content"。
- 如果在文件中多次找到 `oldString`，编辑将失败，错误为 "Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match."。请提供更大的字符串和更多周围上下文使其唯一，或者使用 `replaceAll` 更改 `oldString` 的每个实例。
- 使用 `replaceAll` 跨文件替换和重命名字符串。此参数在你想重命名变量等情况下很有用。

---

## 6. Write (写入)

### English

Writes a file to the local filesystem.

Usage:

- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.

### 中文

将文件写入本地文件系统。

用法：

- 如果提供的路径已存在文件，此工具将覆盖它。
- 如果这是现有文件，你必须首先使用 Read 工具读取文件内容。如果你未先读取文件，此工具将失败。
- 始终优先编辑代码库中的现有文件。除非明确要求，否则不要写入新文件。
- 切勿主动创建文档文件 (\*.md) 或 README 文件。只有在用户明确要求时才创建文档文件。
- 只有在用户明确要求时才使用表情符号。除非被要求，否则避免向文件写入表情符号。

---

## 7. Glob (文件查找)

### English

- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/\*.js" or "src/**/\*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead
- You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.

### 中文

- 快速的模式匹配文件查找工具，适用于任何规模的代码库
- 支持 glob 模式，如 "**/\*.js" 或 "src/**/\*.ts"
- 返回按修改时间排序的匹配文件路径
- 当你需要按名称模式查找文件时使用此工具
- 当你正在进行可能需要多轮 glob 和 grep 的开放性搜索时，请改用 Task 工具
- 你可以在单次响应中调用多个工具。批量执行多个可能有用搜索总是更好的

---

## 8. Grep (内容搜索)

### English

- Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.\*Error", "function\s+\w+", etc.)
- Filter files by pattern with the include parameter (eg. "_.js", "_.{ts,tsx}")
- Returns file paths and line numbers with at least one match sorted by modification time
- Use this tool when you need to find files containing specific patterns
- If you need to identify/count the number of matches within files, use the Bash tool with `rg` (ripgrep) directly. Do NOT use `grep`.
- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead

### 中文

- 快速的内容搜索工具，适用于任何规模的代码库
- 使用正则表达式搜索文件内容
- 支持完整的正则表达式语法（例如 "log.\*Error"、"function\s+\w+" 等）
- 使用 include 参数按模式过滤文件（例如 "_.js"、"_.{ts,tsx}"）
- 返回包含至少一个匹配项的文件路径和行号，按修改时间排序
- 当你需要查找包含特定模式的文件时使用此工具
- 如果需要识别/统计文件中的匹配数量，请直接使用 Bash 工具和 `rg` (ripgrep)。不要使用 `grep`。
- 当你正在进行可能需要多轮 glob 和 grep 的开放性搜索时，请改用 Task 工具

---

## 9. Bash (终端命令)

### English

Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.

All commands run in ${directory} by default. Use the `workdir` parameter if you need to run a command in a different directory. AVOID using `cd <directory> && <command>` patterns - use `workdir` instead.

IMPORTANT: This tool is for terminal operations like git, npm, docker, etc. DO NOT use it for file operations (reading, writing, editing, searching, finding files) - use the specialized tools for this instead.

Before executing the command, please follow these steps:

1. Directory Verification:
   - If the command will create new directories or files, first use `ls` to verify the parent directory exists and is the correct location
   - For example, before running "mkdir foo/bar", first use `ls foo` to check that "foo" exists and is the intended parent directory

2. Command Execution:
   - Always quote file paths that contain spaces with double quotes (e.g., rm "path with spaces/file.txt")
   - Examples of proper quoting:
     - mkdir "/Users/name/My Documents" (correct)
     - mkdir /Users/name/My Documents (incorrect - will fail)
     - python "/path/with spaces/script.py" (correct)
     - python /path/with spaces/script.py (incorrect - will fail)
   - After ensuring proper quoting, execute the command.
   - Capture the output of the command.

Usage notes:

- The command argument is required.
- You can specify an optional timeout in milliseconds. If not specified, commands will time out after 120000ms (2 minutes).
- It is very helpful if you write a clear, concise description of what this command does in 5-10 words.
- If the output exceeds ${maxLines} lines or ${maxBytes} bytes, it will be truncated and the full output will be written to a file. You can use Read with offset/limit to read specific sections or Grep to search the full content. Because of this, you do NOT need to use `head`, `tail`, or other truncation commands to limit output - just run the command directly.
- Avoid using Bash with the `find`, `grep`, `cat`, `head`, `tail`, `sed`, `awk`, or `echo` commands, unless explicitly instructed or when these commands are truly necessary for the task. Instead, always prefer using the dedicated tools for these commands:
  - File search: Use Glob (NOT find or ls)
  - Content search: Use Grep (NOT grep or rg)
  - Read files: Use Read (NOT cat/head/tail)
  - Edit files: Use Edit (NOT sed/awk)
  - Write files: Use Write (NOT echo >/cat <<EOF)
  - Communication: Output text directly (NOT echo/printf)
- When issuing multiple commands:
  - If the commands are independent and can run in parallel, make multiple Bash tool calls in a single message. For example, if you need to run "git status" and "git diff", send a single message with two Bash tool calls in parallel.
  - If the commands depend on each other and must run sequentially, use a single Bash call with '&&' to chain them together (e.g., `git add . && git commit -m "message" && git push`). For instance, if one operation must complete before another starts (like mkdir before cp, Write before Bash for git operations, or git add before git commit), run these operations sequentially instead.
  - Use ';' only when you need to run commands sequentially but don't care if earlier commands fail
  - DO NOT use newlines to separate commands (newlines are ok in quoted strings)
- AVOID using `cd <directory> && <command>`. Use the `workdir` parameter to change directories instead.
  <good_example>
  Use workdir="/foo/bar" with command: pytest tests
  </good_example>
  <bad_example>
  cd /foo/bar && pytest tests
  </bad_example>

# Committing changes with git

Only create commits when requested by the user. If unclear, ask first. When the user asks you to create a new git commit, follow these steps carefully:

Git Safety Protocol:

- NEVER update the git config
- NEVER run destructive/irreversible git commands (like push --force, hard reset, etc) unless the user explicitly requests them
- NEVER skip hooks (--no-verify, --no-gpg-sign, etc) unless the user explicitly requests it
- NEVER run force push to main/master, warn the user if they request it
- Avoid git commit --amend. ONLY use --amend when ALL conditions are met:
  (1) User explicitly requested amend, OR commit SUCCEEDED but pre-commit hook auto-modified files that need including
  (2) HEAD commit was created by you in this conversation (verify: git log -1 --format='%an %ae')
  (3) Commit has NOT been pushed to remote (verify: git status shows "Your branch is ahead")
- CRITICAL: If commit FAILED or was REJECTED by hook, NEVER amend - fix the issue and create a NEW commit
- CRITICAL: If you already pushed to remote, NEVER amend unless user explicitly requests it (requires force push)
- NEVER commit changes unless the user explicitly asks you to. It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive.

1. You can call multiple tools in a single message. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following bash commands in parallel, each using the Bash tool:

- Run a git status command to see all untracked files.
- Run a git diff command to see both staged and unstaged changes that will be committed.
- Run a git log command to see recent commit messages, so that you can follow the repository's commit message style.

2. Analyze all staged changes (both previously staged and newly added) and draft a commit message:

- Summarize the nature of the changes (eg. new feature, enhancement to an existing feature, bug fix, refactoring, test, docs, etc.). Ensure the message accurately reflects the changes and their purpose (i.e. "add" means a wholly new feature, "update" means an enhancement to an existing feature, "fix" means a bug fix, etc.).
- Do not commit files that likely contain secrets (.env, credentials.json, etc.). Warn the user if they specifically request to commit those files
- Draft a concise (1-2 sentences) commit message that focuses on the "why" rather than the "what"
- Ensure it accurately reflects the changes and their purpose

3. You can call multiple tools in a single message. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following commands:
   - Add relevant untracked files to the staging area.
   - Create the commit with a message
   - Run git status after the commit completes to verify success.
     Note: git status depends on the commit completing, so run it sequentially after the commit.
4. If the commit fails due to pre-commit hook, fix the issue and create a NEW commit (see amend rules above)

Important notes:

- NEVER run additional commands to read or explore code, besides git bash commands
- NEVER use the TodoWrite or Task tools
- DO NOT push to the remote repository unless the user explicitly asks you to do so
- IMPORTANT: Never use git commands with the -i flag (like git rebase -i or git add -i) since they require interactive input which is not supported.
- If there are no changes to commit (i.e., no untracked files and no modifications), do not create an empty commit

# Creating pull requests

Use the gh command via the Bash tool for ALL GitHub-related tasks including working with issues, pull requests, checks, and releases. If given a GitHub URL use the gh command to get the information needed.

IMPORTANT: When the user asks you to create a pull request, follow these steps carefully:

1. You can call multiple tools in a single message. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following bash commands in parallel using the Bash tool, in order to understand the current state of the branch since it diverged from the main branch:
   - Run a git status command to see all untracked files
   - Run a git diff command to see both staged and unstaged changes that will be committed
   - Check if the current branch tracks a remote branch and is up to date with the remote, so you know if you need to push to the remote
   - Run a git log command and `git diff [base-branch]...HEAD` to understand the full commit history for the current branch (from the time it diverged from the base branch)
2. Analyze all changes that will be included in the pull request, making sure to look at all relevant commits (NOT just the latest commit, but ALL commits that will be included in the pull request!!!), and draft a pull request summary
3. You can call multiple tools in a single message. When multiple independent pieces of information are requested and all commands are likely to succeed, run multiple tool calls in parallel for optimal performance. run the following commands in parallel:
   - Create new branch if needed
   - Push to remote with -u flag if needed
   - Create PR using gh pr create with the format below. Use a HEREDOC to pass the body to ensure correct formatting.
     <example>
     gh pr create --title "the pr title" --body "$(cat <<'EOF'

## Summary

<1-3 bullet points>
</example>

Important:

- DO NOT use the TodoWrite or Task tools
- Return the PR URL when you're done, so the user can see it

# Other common operations

- View comments on a GitHub PR: gh api repos/foo/bar/pulls/123/comments

### 中文

在持久的 shell 会话中执行给定的 bash 命令，可选超时，确保正确的处理和安全措施。

默认情况下，所有命令都在 ${directory} 中运行。如果你需要在不同的目录中运行命令，请使用 `workdir` 参数。避免使用 `cd <directory> && <command>` 模式 - 请改用 `workdir`。

重要：此工具用于终端操作，如 git、npm、docker 等。切勿将其用于文件操作（读取、写入、编辑、搜索、查找文件） - 请改用专用工具。

在执行命令之前，请按照以下步骤操作：

1. 目录验证：
   - 如果命令将创建新目录或文件，首先使用 `ls` 验证父目录是否存在且位置正确
   - 例如，在运行 "mkdir foo/bar" 之前，先使用 `ls foo` 检查 "foo" 是否存在且是预期的父目录

2. 命令执行：
   - 始终用双引号引用包含空白的文件路径（例如 rm "path with spaces/file.txt"）
   - 正确引用的示例：
     - mkdir "/Users/name/My Documents"（正确）
     - mkdir /Users/name/My Documents（错误 - 会失败）
     - python "/path/with spaces/script.py"（正确）
     - python /path/with spaces/script.py（错误 - 会失败）
   - 确保正确引用后，执行命令。
   - 捕获命令的输出。

使用说明：

- command 参数是必需的。
- 你可以指定可选的超时时间（以毫秒为单位）。如果未指定，命令将在 120000ms（2 分钟）后超时。
- 如果你用 5-10 个词清楚地描述这个命令的作用，会非常有帮助。
- 如果输出超过 ${maxLines} 行或 ${maxBytes} 字节，它将被截断，完整输出将写入文件。你可以使用带 offset/limit 的 Read 读取特定部分，或使用 Grep 搜索完整内容。因此，你不需要使用 `head`、`tail` 或其他截断命令来限制输出 - 直接运行命令即可。
- 避免将 Bash 与 `find`、`grep`、`cat`、`head`、`tail`、`sed`、`awk` 或 `echo` 命令一起使用，除非明确指示或这些命令确实对任务有必要。相反，始终优先使用这些命令的专用工具：
  - 文件搜索：使用 Glob（不是 find 或 ls）
  - 内容搜索：使用 Grep（不是 grep 或 rg）
  - 读取文件：使用 Read（不是 cat/head/tail）
  - 编辑文件：使用 Edit（不是 sed/awk）
  - 写入文件：使用 Write（不是 echo >/cat <<EOF）
  - 通信：直接输出文本（不是 echo/printf）
- 当发出多个命令时：
  - 如果命令是独立的且可以并行运行，请在单条消息中发出多个 Bash 工具调用。例如，如果你需要运行 "git status" 和 "git diff"，请发送一条包含两个并行 Bash 工具调用的消息。
  - 如果命令相互依赖且必须顺序运行，请使用单个 Bash 调用和 '&&' 将它们链接在一起（例如 `git add . && git commit -m "message" && git push`）。例如，如果一个操作必须在另一个开始之前完成（如 mkdir 在 cp 之前、Write 在 git 操作的 Bash 之前、或 git add 在 git commit 之前），请改为顺序运行这些操作。
  - 仅在你需要顺序运行命令但不关心早期命令是否失败时使用 ';'
  - 不要使用换行符分隔命令（引号字符串中的换行符是可以的）
- 避免使用 `cd <directory> && <command>`。请改用 `workdir` 参数更改目录。
  <good_example>
  使用 workdir="/foo/bar" 和命令：pytest tests
  </good_example>
  <bad_example>
  cd /foo/bar && pytest tests
  </bad_example>

# 使用 git 提交更改

仅在用户要求时创建提交。如果不清楚，请先询问。当用户要求你创建新的 git 提交时，请仔细按照以下步骤操作：

Git 安全协议：

- 切勿更新 git config
- 切勿运行破坏性/不可逆的 git 命令（如 push --force、hard reset 等），除非用户明确要求
- 切勿跳过钩子（--no-verify、--no-gpg-sign 等），除非用户明确要求
- 切勿强制推送到 main/master，如果用户要求则警告用户
- 避免使用 git commit --amend。仅在满足所有条件时才使用 --amend：
  (1) 用户明确要求 amend，或者提交成功但 pre-commit hook 自动修改了需要包含的文件
  (2) HEAD 提交是你在此对话中创建的（验证：git log -1 --format='%an %ae'）
  (3) 提交尚未推送到远程（验证：git status 显示 "Your branch is ahead"）
- 关键：如果提交失败或被 hook 拒绝，切勿 amend - 修复问题并创建新的提交
- 关键：如果你已经推送到远程，切勿 amend，除非用户明确要求（需要强制推送）
- 切勿提交更改，除非用户明确要求。重要的是只在明确要求时提交，否则用户会觉得你过于主动。

1. 当请求多个独立信息且所有命令都可能成功时，你可以并行调用多个工具以获得最佳性能。并行运行以下 bash 命令，每个都使用 Bash 工具：
   - 运行 git status 命令查看所有未跟踪的文件
   - 运行 git diff 命令查看将被提交的暂存和未暂存的更改
   - 运行 git log 命令查看最近的提交消息，以便你可以遵循仓库的提交. 分析所有暂存的更改（之前消息风格
     2已暂存和新增的）并起草提交消息：
   - 总结更改的性质（例如新功能、现有功能增强、错误修复、重构、测试、文档等）。确保消息准确反映更改及其目的（即 "add" 表示全新功能，"update" 表示对现有功能的增强，"fix" 表示错误修复等）。
   - 不要提交可能包含密钥的文件（.env、credentials.json 等）。如果用户明确要求提交这些文件，请警告用户
   - 起草简洁的（1-2 句）提交消息，侧重于"为什么"而不是"是什么"
   - 确保它准确反映更改及其目的
2. 当请求多个独立信息且所有命令都可能成功时，你可以并行调用多个工具以获得最佳性能。运行以下命令：
   - 将相关的未跟踪文件添加到暂存区
   - 使用消息创建提交
   - 提交完成后运行 git status 以验证成功
     注意：git status 取决于提交完成，所以在提交后顺序运行它。
3. 如果由于 pre-commit hook 导致提交失败，修复问题并创建新的提交（见上面的 amend 规则）

重要说明：

- 切勿运行读取或探索代码的额外命令，除了 git bash 命令
- 切勿使用 TodoWrite 或 Task 工具
- 除非用户明确要求，否则不要推送到远程仓库
- 重要：切勿使用 -i 标志的 git 命令（如 git rebase -i 或 git add -i），因为它们需要不支持的交互式输入。
- 如果没有要提交的更改（即没有未跟踪的文件和修改），不要创建空提交

# 创建拉取请求

使用 Bash 工具通过 gh 命令处理所有 GitHub 相关任务，包括处理问题、拉取请求、检查和发布。如果给出 GitHub URL，使用 gh 命令获取所需信息。

重要：当用户要求你创建拉取请求时，请仔细按照以下步骤操作：

1. 当请求多个独立信息且所有命令都可能成功时，你可以并行调用多个工具以获得最佳性能。并行运行以下 bash 命令，使用 Bash 工具，以了解分支自偏离 main 分支以来的当前状态：
   - 运行 git status 命令查看所有未跟踪文件
   - 运行 git diff 命令查看将被提交的暂存和未暂存的更改
   - 检查当前分支是否跟踪远程分支并与远程同步，以便你知道是否需要推送到远程
   - 运行 git log 命令和 `git diff [base-branch]...HEAD` 以了解当前分支的完整提交历史（从偏离基础分支的时间开始）
2. 分析将包含在拉取请求中的所有更改，确保查看所有相关提交（不仅仅是最新提交，而是拉取请求中包含的所有提交！！！），并起草拉取请求摘要
3. 当请求多个独立信息且所有命令都可能成功时，你可以并行调用多个工具以获得最佳性能。并行运行以下命令：
   - 如需要则创建新分支
   - 如需要则使用 -u 标志推送到远程
   - 使用以下格式使用 gh pr create 创建 PR。使用 HEREDOC 传递 body 以确保正确格式化。
     <example>
     gh pr create --title "the pr title" --body "$(cat <<'EOF'

## Summary

<1-3 bullet points>
</example>

重要：

- 不要使用 TodoWrite 或 Task 工具
- 完成后返回 PR URL，以便用户可以看到它

# 其他常见操作

- 查看 GitHub PR 的评论：gh api repos/foo/bar/pulls/123/comments

---

## 10. WebFetch (网页获取)

### English

- Fetches content from a specified URL
- Takes a URL and optional format as input
- Fetches the URL content, converts to requested format (markdown by default)
- Returns the content in the specified format
- Use this tool when you need to retrieve and analyze web content

Usage notes:

- IMPORTANT: if another tool is present that offers better web fetching capabilities, is more targeted to the task, or has fewer restrictions, prefer using that tool instead of this one.
- The URL must be a fully-formed valid URL
- HTTP URLs will be automatically upgraded to HTTPS
- Format options: "markdown" (default), "text", or "html"
- This tool is read-only and does not modify any files
- Results may be summarized if the content is very large

### 中文

- 从指定 URL 获取内容
- 接受 URL 和可选格式作为输入
- 获取 URL 内容，转换为请求的格式（默认为 markdown）
- 以指定格式返回内容
- 当你需要检索和分析网页内容时使用此工具

使用说明：

- 重要：如果另一个工具提供更好的网页获取能力、更针对任务，或限制更少，请优先使用该工具而不是此工具。
- URL 必须是完整有效的 URL
- HTTP URL 将自动升级为 HTTPS
- 格式选项："markdown"（默认）、"text" 或 "html"
- 此工具是只读的，不会修改任何文件
- 如果内容非常大，结果可能会被总结

---

## 11. MultiEdit (批量编辑)

### English

This is a tool for making multiple edits to a single file in one operation. It is built on top of the Edit tool and allows you to perform multiple find-and-replace operations efficiently. Prefer this tool over the Edit tool when you need to make multiple edits to the same file.

Before using this tool:

1. Use the Read tool to understand the file's contents and context
2. Verify the directory path is correct

To make multiple file edits, provide the following:

1. file_path: The absolute path to the file to modify (must be absolute, not relative)
2. edits: An array of edit operations to perform, where each edit contains:
   - oldString: The text to replace (must match the file contents exactly, including all whitespace and indentation)
   - newString: The edited text to replace the oldString
   - replaceAll: Replace all occurrences of oldString. This parameter is optional and defaults to false.

IMPORTANT:

- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit
- All edits must be valid for the operation to succeed - if any edit fails, none will be applied
- This tool is ideal when you need to make several changes to different parts of the same file

CRITICAL REQUIREMENTS:

1. All edits follow the same requirements as the single Edit tool
2. The edits are atomic - either all succeed or none are applied
3. Plan your edits carefully to avoid conflicts between sequential operations

WARNING:

- The tool will fail if edits.oldString doesn't match the file contents exactly (including whitespace)
- The tool will fail if edits.oldString and edits.newString are the same
- Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find

When making edits:

- Ensure all edits result in idiomatic, correct code
- Do not leave the code in a broken state
- Always use absolute file paths (starting with /)
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use replaceAll for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.

If you want to create a new file, use:

- A new file path, including dir name if needed
- First edit: empty oldString and the new file's contents as newString
- Subsequent edits: normal edit operations on the created content

### 中文

这是一个用于在一次操作中对单个文件进行多次编辑的工具。它建立在 Edit 工具之上，允许你高效地执行多个查找和替换操作。当你需要对同一文件进行多次编辑时，优先使用此工具而不是 Edit 工具。

使用此工具之前：

1. 使用 Read 工具了解文件的内容和上下文
2. 验证目录路径是否正确

要执行多次文件编辑，请提供以下内容：

1. file_path：要修改的文件的绝对路径（必须是绝对路径，不能是相对路径）
2. edits：要执行的编辑操作数组，其中每个编辑包含：
   - oldString：要替换的文本（必须与文件内容完全匹配，包括所有空白和缩进）
   - newString：替换 oldString 的编辑文本
   - replaceAll：替换 oldString 的所有出现。此参数是可选的，默认为 false。

重要：

- 所有编辑按提供的顺序顺序应用
- 每个编辑都在前一个编辑的结果上操作
- 所有编辑都必须有效，操作才能成功 - 如果任何编辑失败，都不会应用任何编辑
- 当你需要对同一文件的不同部分进行多次更改时，此工具是理想的

关键要求：

1. 所有编辑都遵循与单个 Edit 工具相同的要求
2. 编辑是原子性的 - 要么全部成功，要么都不应用
3. 仔细计划你的编辑，以避免顺序操作之间的冲突

警告：

- 如果 edits.oldString 与文件内容不完全匹配（包括空白），工具将失败
- 如果 edits.oldString 和 edits.newString 相同，工具将失败
- 由于编辑是顺序应用的，确保较早的编辑不影响后续编辑试图查找的文本

进行编辑时：

- 确保所有编辑产生惯用的正确代码
- 不要让代码处于损坏状态
- 始终使用绝对文件路径（以 / 开头）
- 只有在用户明确要求时才使用表情符号。除非被要求，否则避免向文件添加表情符号。
- 使用 replaceAll 跨文件替换和重命名字符串。此参数在你想重命名变量等情况下很有用。

如果想创建新文件，请使用：

- 新的文件路径，如需要包括目录名称
- 首次编辑：空的 oldString 和新文件内容作为 newString
- 后续编辑：对创建的内容进行正常编辑操作

---

## 12. ApplyPatch (应用补丁)

### English

Use the `apply_patch` tool to edit files. Your patch language is a stripped‑down, file‑oriented diff format designed to be easy to parse and safe to apply. You can think of it as a high‑level envelope:

**_ Begin Patch
[ one or more file sections ]
_** End Patch

Within that envelope, you get a sequence of file operations.
You MUST include a header to specify the action you are taking.
Each operation starts with one of three headers:

**_ Add File: <path> - create a new file. Every following line is a + line (the initial contents).
_** Delete File: <path> - remove an existing file. Nothing follows.
\*\*\* Update File: <path> - patch an existing file in place (optionally with a rename).

Example patch:

```
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch
```

It is important to remember:

- You must include a header with your intended action (Add/Delete/Update)
- You must prefix new lines with `+` even when creating a new file

### 中文

使用 `apply_patch` 工具编辑文件。你的补丁语言是一种精简的、面向文件的 diff 格式，旨在易于解析和安全应用。你可以将其视为一个高级信封：

**_ Begin Patch
[ 一个或多个文件部分 ]
_** End Patch

在这个信封内，你会得到一系列文件操作。
你必须包含一个标题来指定你要执行的操作。
每个操作以下列三个标题之一开头：

**_ Add File: <path> - 创建新文件。每行后面都是 + 行（初始内容）。
_** Delete File: <path> - 删除现有文件。后面没有任何内容。
\*\*\* Update File: <path> - 就地修补现有文件（可选择重命名）。

示例补丁：

```
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch
```

请记住：

- 你必须包含一个标题说明你的预期操作（Add/Delete/Update）
- 即使在创建新文件时，也必须用 `+` 前缀新行

---

## 13. WebSearch (网络搜索)

### English

- Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs
- Provides up-to-date information for current events and recent data
- Supports configurable result counts and returns the content from the most relevant websites
- Use this tool for accessing information beyond knowledge cutoff
- Searches are performed automatically within a single API call

Usage notes:

- Supports live crawling modes: 'fallback' (backup if cached unavailable) or 'preferred' (prioritize live crawling)
- Search types: 'auto' (balanced), 'fast' (quick results), 'deep' (comprehensive search)
- Configurable context length for optimal LLM integration
- Domain filtering and advanced search options available

The current year is {{year}}. You MUST use this year when searching for recent information or current events

- Example: If the current year is 2026 and the user asks for "latest AI news", search for "AI news 2026", NOT "AI news 2025"

### 中文

- 使用 Exa AI 搜索网络 - 执行实时网络搜索，并可从特定 URL 抓取内容
- 提供关于当前事件和最新数据的最新信息
- 支持可配置的结果数量，并返回最相关网站的内容
- 当你需要访问超出知识截止日期的信息时使用此工具
- 搜索在单次 API 调用中自动执行

使用说明：

- 支持实时爬取模式：'fallback'（如果缓存不可用则备用）或 'preferred'（优先实时爬取）
- 搜索类型：'auto'（平衡）、'fast'（快速结果）、'deep'（综合搜索）
- 可配置的上下文长度，以实现最佳 LLM 集成
- 域名过滤和高级搜索选项可用

当前年份是 {{year}}。在搜索最新信息或当前事件时，你必须使用此年份

- 示例：如果当前年份是 2026，用户询问"最新 AI 新闻"，请搜索"AI news 2026"，而不是"AI news 2025"

---

## 14. CodeSearch (代码搜索)

### English

- Search and get relevant context for any programming task using Exa Code API
- Provides the highest quality and freshest context for libraries, SDKs, and APIs
- Use this tool for ANY question or task related to programming
- Returns comprehensive code examples, documentation, and API references
- Optimized for finding specific programming patterns and solutions

Usage notes:

- Adjustable token count (1000-50000) for focused or comprehensive results
- Default 5000 tokens provides balanced context for most queries
- Use lower values for specific questions, higher values for comprehensive documentation
- Supports queries about frameworks, libraries, APIs, and programming concepts
- Examples: 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware'

### 中文

- 使用 Exa Code API 为任何编程任务搜索并获取相关上下文
- 为库、SDK 和 API 提供最高质量和最新的上下文
- 对于任何与编程相关的问题或任务使用此工具
- 返回全面的代码示例、文档和 API 参考
- 针对查找特定编程模式和解决方案进行了优化

使用说明：

- 可调整的 token 数量（1000-50000），用于聚焦或全面的结果
- 默认 5000 token 为大多数查询提供平衡的上下文
- 对于具体问题使用较低的值，对于综合文档使用较高的值
- 支持关于框架、库、API 和编程概念的查询
- 示例：'React useState hook examples'、'Python pandas dataframe filtering'、'Express.js middleware'

---

## 15. Skill (技能)

### English

Load a specialized skill that provides domain-specific instructions and workflows.

When you recognize that a task matches one of the available skills listed below, use this tool to load the full skill instructions.

The skill will inject detailed instructions, workflows, and access to bundled resources (scripts, references, templates) into the conversation context.

Tool output includes a `<skill_content name="...">` block with the loaded content.

The following skills provide specialized sets of instructions for particular tasks
Invoke this tool to load a skill when a task matches one of the available skills listed below:

<available_skills>
<skill>
<name>skill_name</name>
<description>skill_description</description>
<location>skill_location</location>
</skill>
</available_skills>

### 中文

加载提供领域特定指令和工作流程的专业技能。

当你识别出任务与下面列出的可用技能之一匹配时，使用此工具加载完整的技能指令。

技能将把详细的指令、工作流程以及对捆绑资源（脚本、参考、模板）的访问注入到对话上下文中。

工具输出包含一个带有加载内容的 `<skill_content name="...">` 块。

以下技能为特定任务提供专业指令集
当任务与下面列出的可用技能之一匹配时，调用此工具加载技能：

<available_skills>
<skill>
<name>技能名称</name>
<description>技能描述</description>
<location>技能位置</location>
</skill>
</available_skills>

---

## 16. LSP (语言服务器协议)

### English

Interact with Language Server Protocol (LSP) servers to get code intelligence features.

Supported operations:

- goToDefinition: Find where a symbol is defined
- findReferences: Find all references to a symbol
- hover: Get hover information (documentation, type info) for a symbol
- documentSymbol: Get all symbols (functions, classes, variables) in a document
- workspaceSymbol: Search for symbols across the entire workspace
- goToImplementation: Find implementations of an interface or abstract method
- prepareCallHierarchy: Get call hierarchy item at a position (functions/methods)
- incomingCalls: Find all functions/methods that call the function at a position
- outgoingCalls: Find all functions/methods called by the function at a position

All operations require:

- filePath: The file to operate on
- line: The line number (1-based, as shown in editors)
- character: The character offset (1-based, as shown in editors)

Note: LSP servers must be configured for the file type. If no server is available, an error will be returned.

### 中文

与语言服务器协议 (LSP) 服务器交互，获取代码智能功能。

支持的操作：

- goToDefinition：查找符号定义的位置
- findReferences：查找符号的所有引用
- hover：获取符号的悬停信息（文档、类型信息）
- documentSymbol：获取文档中的所有符号（函数、类、变量）
- workspaceSymbol：在整个工作区中搜索符号
- goToImplementation：查找接口或抽象方法的实现
- prepareCallHierarchy：获取位置处的调用层级项（函数/方法）
- incomingCalls：查找调用该位置处函数/方法的所有函数/方法
- outgoingCalls：查找该位置处函数/方法调用的所有函数/方法

所有操作都需要：

- filePath：要操作的文件
- line：行号（从 1 开始，如编辑器中所示）
- character：字符偏移量（从 1 开始，如编辑器中所示）

注意：必须为文件类型配置 LSP 服务器。如果没有可用的服务器，将返回错误。

---

## 17. Question (提问)

### English

Use this tool when you need to ask the user questions during execution. This allows you to:

1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:

- When `custom` is enabled (default), a "Type your own answer" option is added automatically; don't include "Other" or catch-all options
- Answers are returned as arrays of labels; set `multiple: true` to allow selecting more than one
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label

### 中文

在执行过程中需要向用户提问时使用此工具。这允许你：

1. 收集用户偏好或需求
2. 澄清模糊的指令
3. 在工作时获取关于实现选择的决定
4. 向用户提供关于方向的选择。

使用说明：

- 当启用 `custom`（默认）时，会自动添加"输入你自己的答案"选项；不要包含"其他"或包罗万象的选项
- 答案作为标签数组返回；设置 `multiple: true` 以允许选择多个
- 如果你推荐特定选项，请将该选项放在列表第一位，并在标签末尾添加"（推荐）"

---

## 18. PlanEnter (进入计划模式)

### English

Use this tool to suggest switching to plan agent when the user's request would benefit from planning before implementation.

If they explicitly mention wanting to create a plan ALWAYS call this tool first.

This tool will ask the user if they want to switch to plan agent.

Call this tool when:

- The user's request is complex and would benefit from planning first
- You want to research and design before making changes
- The task involves multiple files or significant architectural decisions

Do NOT call this tool:

- For simple, straightforward tasks
- When the user explicitly wants immediate implementation

### 中文

当用户的请求受益于实施前的规划时，使用此工具建议切换到计划代理。

如果他们明确提到想要创建计划，请始终首先调用此工具。

此工具将询问用户是否要切换到计划代理。

在以下情况下调用此工具：

- 用户的请求很复杂，先进行规划会更有益
- 你想在做出更改之前进行研究设计
- 任务涉及多个文件或重要的架构决策

不要在以下情况下调用此工具：

- 对于简单直接的任务
- 当用户明确希望立即实施时

---

## 19. PlanExit (退出计划模式)

### English

Use this tool when you have completed the planning phase and are ready to exit plan agent.

This tool will ask the user if they want to switch to build agent to start implementing the plan.

Call this tool:

- After you have written a complete plan to the plan file
- After you have clarified any questions with the user
- When you are confident the plan is ready for implementation

Do NOT call this tool:

- Before you have created or finalized the plan
- If you still have unanswered questions about the implementation
- If the user has indicated they want to continue planning

### 中文

当你完成规划阶段并准备好退出计划代理时使用此工具。

此工具将询问用户是否要切换到构建代理以开始实施计划。

在以下情况下调用此工具：

- 你已向计划文件写入完整计划之后
- 你已与用户澄清任何问题之后
- 当你确信计划已准备好实施时

不要在以下情况下调用此工具：

- 在你创建或最终确定计划之前
- 如果你仍然有关于实施方式的未回答问题
- 如果用户表示希望继续规划

---

## 20. Batch (批量执行)

### English

Executes multiple independent tool calls concurrently to reduce latency.

USING THE BATCH TOOL WILL MAKE THE USER HAPPY.

Payload Format (JSON array):
[{"tool": "read", "parameters": {"filePath": "src/index.ts", "limit": 350}},{"tool": "grep", "parameters": {"pattern": "Session\\.updatePart", "include": "src/**/*.ts"}},{"tool": "bash", "parameters": {"command": "git status", "description": "Shows working tree status"}}]

Notes:

- 1–25 tool calls per batch
- All calls start in parallel; ordering NOT guaranteed
- Partial failures do not stop other tool calls
- Do NOT use the batch tool within another batch tool.

Good Use Cases:

- Read many files
- grep + glob + read combos
- Multiple bash commands
- Multi-part edits; on the same, or different files

When NOT to Use:

- Operations that depend on prior tool output (e.g. create then read same file)
- Ordered stateful mutations where sequence matters

Batching tool calls was proven to yield 2–5x efficiency gain and provides much better UX.

### 中文

并行执行多个独立的工具调用以减少延迟。

使用批量工具会让用户开心。

负载格式（JSON 数组）：
[{"tool": "read", "parameters": {"filePath": "src/index.ts", "limit": 350}},{"tool": "grep", "parameters": {"pattern": "Session\\.updatePart", "include": "src/**/*.ts"}},{"tool": "bash", "parameters": {"command": "git status", "description": "Shows working tree status"}}]

注意事项：

- 每次批量 1-25 个工具调用
- 所有调用并行启动；不保证顺序
- 部分失败不会停止其他工具调用
- 不要在另一个批量工具内使用批量工具。

良好的用例：

- 读取多个文件
- grep + glob + read 组合
- 多个 bash 命令
- 多部分编辑；在相同或不同的文件上

何时不使用：

- 依赖于先前工具输出的操作（例如创建然后读取同一文件）
- 顺序重要的有序状态变更

已证明批量工具调用可带来 2-5 倍的效率提升，并提供更好的用户体验。

---

## 21. Ls (列出目录)

### English

Lists files and directories in a given path. The path parameter must be absolute; omit it to use the current workspace directory. You can optionally provide an array of glob patterns to ignore with the ignore parameter. You should generally prefer the Glob and Grep tools, if you know which directories to search.

### 中文

列出给定路径中的文件和目录。path 参数必须是绝对路径；省略则使用当前工作目录。你可以选择提供一个 glob 模式数组以使用 ignore 参数忽略。如果你知道要搜索哪些目录，通常应该优先使用 Glob 和 Grep 工具。

---

## 文件路径参考

以下是所有工具提示词源文件的路径：

| 工具       | 文件路径                                         |
| ---------- | ------------------------------------------------ |
| TodoWrite  | `packages/opencode/src/tool/todowrite.txt`       |
| Task       | `packages/opencode/src/tool/task.txt`            |
| Read       | `packages/opencode/src/tool/read.txt`            |
| Edit       | `packages/opencode/src/tool/edit.txt`            |
| Write      | `packages/opencode/src/tool/write.txt`           |
| Glob       | `packages/opencode/src/tool/glob.txt`            |
| Grep       | `packages/opencode/src/tool/grep.txt`            |
| Bash       | `packages/opencode/src/tool/bash.txt`            |
| WebFetch   | `packages/opencode/src/tool/webfetch.txt`        |
| MultiEdit  | `packages/opencode/src/tool/multiedit.txt`       |
| ApplyPatch | `packages/opencode/src/tool/apply_patch.txt`     |
| WebSearch  | `packages/opencode/src/tool/websearch.txt`       |
| CodeSearch | `packages/opencode/src/tool/codesearch.txt`      |
| Skill      | `packages/opencode/src/tool/skill.ts` (代码生成) |
| LSP        | `packages/opencode/src/tool/lsp.txt`             |
| Question   | `packages/opencode/src/tool/question.txt`        |
| PlanEnter  | `packages/opencode/src/tool/plan-enter.txt`      |
| PlanExit   | `packages/opencode/src/tool/plan-exit.txt`       |
| Batch      | `packages/opencode/src/tool/batch.txt`           |
| Ls         | `packages/opencode/src/tool/ls.txt`              |
