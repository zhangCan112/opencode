# 阶段八：MCP 集成 — Model Context Protocol

本阶段目标是深入理解 OpenCode 的 MCP (Model Context Protocol) 集成，掌握 MCP 服务器的配置、连接和工具调用。

---

## 一、MCP 概述

MCP (Model Context Protocol) 是一个开放协议，允许 AI 模型与外部工具和数据源进行标准化交互。

### 1.1 MCP 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP 集成架构                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                      ┌─────────────┐      │
│  │  Local MCP  │   stdio transport    │  Remote MCP │      │
│  │  本地进程    │◄──────────────────► │  HTTP/SSE   │      │
│  └─────────────┘                      └─────────────┘      │
│         │                                    │              │
│         └──────────────────┬─────────────────┘              │
│                            ▼                                │
│                   ┌─────────────┐                          │
│                   │ MCP Client  │                          │
│                   │ (OpenCode)  │                          │
│                   └─────────────┘                          │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              工具/Prompt/Resource                   │   │
│  │  • listTools() → 转换为 AI SDK Tool                 │   │
│  │  • listPrompts() → 斜杠命令                         │   │
│  │  • listResources() → 文件附件                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 MCP 提供的能力

| 能力         | 说明                   | OpenCode 中的使用  |
| ------------ | ---------------------- | ------------------ |
| Tools        | 可调用的函数           | 注册为工具         |
| Prompts      | 预定义的提示模板       | 斜杠命令           |
| Resources    | 可读取的资源           | 文件附件           |

---

## 二、核心文件位置

| 功能           | 文件路径               | 说明             |
| -------------- | ---------------------- | ---------------- |
| MCP 核心       | mcp/index.ts           | MCP 客户端管理   |
| OAuth 认证     | mcp/oauth-provider.ts  | OAuth 流程       |
| OAuth 回调     | mcp/oauth-callback.ts  | 认证回调处理     |
| 认证存储       | mcp/auth.ts            | Token 存储       |
| API 路由       | server/routes/mcp.ts   | HTTP API         |
| 配置定义       | config/config.ts       | MCP 配置 Schema  |

---

## 三、MCP 服务器类型

### 3.1 Local MCP (本地)

通过命令行启动的本地进程，使用 stdio 传输。

```json
{
  "mcp": {
    "my-local": {
      "type": "local",
      "command": ["node", "mcp-server.js"],
      "environment": {
        "API_KEY": "xxx"
      },
      "timeout": 30000
    }
  }
}
```

### 3.2 Remote MCP (远程)

通过 HTTP/SSE 连接的远程服务器。

```json
{
  "mcp": {
    "my-remote": {
      "type": "remote",
      "url": "https://mcp.example.com",
      "headers": {
        "Authorization": "Bearer xxx"
      },
      "oauth": true,
      "timeout": 30000
    }
  }
}
```

---

## 四、MCP 状态管理

### 4.1 状态类型

文件：`mcp/index.ts`

```typescript
export const Status = z.discriminatedUnion("status", [
  z.object({ status: z.literal("connected") }),
  z.object({ status: z.literal("disabled") }),
  z.object({ status: z.literal("failed"), error: z.string() }),
  z.object({ status: z.literal("needs-auth") }),
  z.object({ status: z.literal("needs-client-registration") }),
])
```

### 4.2 状态说明

| 状态                      | 说明                       |
| ------------------------- | -------------------------- |
| `connected`               | 已连接，可用               |
| `disabled`                | 已禁用                     |
| `failed`                  | 连接失败                   |
| `needs-auth`              | 需要 OAuth 认证            |
| `needs-client-registration` | 需要预注册的 client ID   |

---

## 五、工具转换

### 5.1 MCP 工具转换为 AI SDK Tool

文件：`mcp/index.ts`

```typescript
async function convertMcpTool(mcpTool: MCPToolDef, client: MCPClient, timeout?: number): Promise<Tool> {
  const inputSchema = mcpTool.inputSchema

  return dynamicTool({
    description: mcpTool.description ?? "",
    inputSchema: jsonSchema(schema),
    execute: async (args, options) => {
      const result = await client.callTool(
        {
          name: mcpTool.name,
          arguments: (args || {}) as Record<string, unknown>,
        },
        undefined,
        { timeout },
      )
      return result
    },
  })
}
```

### 5.2 工具命名规则

MCP 工具在 OpenCode 中的名称格式：`{clientName}_{toolName}`

```typescript
const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
const sanitizedToolName = mcpTool.name.replace(/[^a-zA-Z0-9_-]/g, "_")
result[sanitizedClientName + "_" + sanitizedToolName] = await convertMcpTool(...)
```

---

## 六、OAuth 认证流程

### 6.1 流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    OAuth 认证流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. startAuth(mcpName)                                     │
│     ├── 创建 OAuth Provider                                │
│     ├── 生成 state 和 code_verifier                        │
│     └── 返回 authorizationUrl                              │
│                                                             │
│  2. 用户打开 URL 授权                                      │
│     └── 浏览器重定向到回调 URL                             │
│                                                             │
│  3. finishAuth(mcpName, code)                              │
│     ├── 交换 code 获取 token                               │
│     ├── 保存 token 到 mcp-auth.json                        │
│     └── 重新连接 MCP 服务器                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 McpOAuthProvider

文件：`mcp/oauth-provider.ts`

```typescript
class McpOAuthProvider implements OAuthClientProvider {
  constructor(
    private mcpName: string,
    private serverUrl: string,
    private callbacks: {
      onRedirect: (url: URL) => Promise<void>
    }
  ) {}

  // 获取已保存的 client 信息
  async clientInformation() {
    const entry = await McpAuth.getForUrl(this.mcpName, this.serverUrl)
    return entry?.clientInfo
  }

  // 保存 client 信息
  async saveClientInformation(info: ClientInformation) {
    await McpAuth.updateClientInfo(this.mcpName, info)
  }

  // 获取 token
  async tokens() {
    const entry = await McpAuth.getForUrl(this.mcpName, this.serverUrl)
    return entry?.tokens
  }

  // 保存 token
  async saveTokens(tokens: OAuthTokens) {
    await McpAuth.updateTokens(this.mcpName, tokens)
  }

  // 重定向到授权页面
  async redirectToAuthorization(authorizationUrl: URL) {
    await this.callbacks.onRedirect(authorizationUrl)
  }
}
```

### 6.3 Token 存储

文件：`mcp/auth.ts`

```typescript
// Token 存储在 ~/.local/share/opencode/mcp-auth.json

export async function get(mcpName: string): Promise<Entry | undefined>
export async function set(mcpName: string, entry: Entry, serverUrl?: string): Promise<void>
export async function remove(mcpName: string): Promise<void>
export async function updateTokens(mcpName: string, tokens: Tokens, serverUrl?: string): Promise<void>
```

---

## 七、资源读取

### 7.1 Resource 概念

MCP Resource 是可以读取的外部资源，如文件、数据库记录等。

### 7.2 Resource 读取流程

文件：`session/prompt.ts`

```typescript
// 处理 MCP resource 类型的文件附件
if (part.source?.type === "resource") {
  const { clientName, uri } = part.source

  try {
    const resourceContent = await MCP.readResource(clientName, uri)
    // 处理资源内容...
  } catch (error) {
    // 错误处理...
  }
}
```

---

## 八、Prompt 模板

### 8.1 MCP Prompts 作为斜杠命令

文件：`command/index.ts`

```typescript
// 加载 MCP prompts 作为斜杠命令
for (const [name, prompt] of Object.entries(await MCP.prompts())) {
  result[name] = {
    name,
    source: "mcp",
    description: prompt.description,
    template: async (args) => {
      return await MCP.getPrompt(prompt.client, prompt.name, args)
    },
  }
}
```

---

## 九、API 路由

### 9.1 MCP 相关 API

文件：`server/routes/mcp.ts`

| 路由               | 方法   | 说明               |
| ------------------ | ------ | ------------------ |
| `/mcp`             | GET    | 获取所有 MCP 状态  |
| `/mcp`             | POST   | 添加新 MCP 服务器  |
| `/mcp/:name/auth`  | POST   | 启动 OAuth 流程    |
| `/mcp/:name/callback` | POST | 完成 OAuth 认证  |
| `/mcp/:name/connect` | POST | 连接 MCP 服务器  |
| `/mcp/:name/disconnect` | POST | 断开连接      |

---

## 十、配置示例

### 10.1 完整配置示例

```json
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
      "enabled": true,
      "timeout": 30000
    },
    "github": {
      "type": "remote",
      "url": "https://api.github.com/mcp",
      "oauth": true,
      "enabled": true
    },
    "postgres": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-postgres"],
      "environment": {
        "DATABASE_URL": "postgresql://user:pass@localhost/db"
      },
      "enabled": false
    }
  }
}
```

---

## 十一、阶段八学习任务

### 任务 1：理解 MCP 架构

- [ ] 阅读 `mcp/index.ts` 中的 `state` 函数
- [ ] 理解 Local 和 Remote MCP 的区别

### 任务 2：理解工具转换

- [ ] 分析 `convertMcpTool` 函数
- [ ] 理解工具命名规则

### 任务 3：理解 OAuth 流程

- [ ] 阅读 `mcp/oauth-provider.ts`
- [ ] 理解 token 存储机制

### 任务 4：配置 MCP 服务器

- [ ] 配置一个本地 MCP 服务器
- [ ] 测试工具调用

---

## 十二、阶段八总结

通过本阶段学习，你应该理解：

1. **MCP 协议** — 标准化的工具集成协议
2. **服务器类型** — Local 和 Remote 两种连接方式
3. **工具转换** — MCP 工具如何转换为 AI SDK Tool
4. **OAuth 认证** — 远程服务器的认证流程
5. **资源与 Prompt** — MCP 的其他能力

---

## 十三、参考资源

| 资源                    | 说明             |
| ----------------------- | ---------------- |
| mcp/index.ts            | MCP 核心实现     |
| mcp/oauth-provider.ts   | OAuth Provider   |
| mcp/auth.ts             | Token 存储       |
| server/routes/mcp.ts    | API 路由         |
| config/config.ts        | 配置 Schema      |
| https://modelcontextprotocol.io | MCP 官方文档 |