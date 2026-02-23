# Server 模块分析

本文档分析 OpenCode 项目中 `src/server/` 模块的架构设计与实现。

---

## 一、整体架构

`server.ts` 是整个 OpenCode 的 **HTTP API 服务器**，基于 **Hono** 框架构建。

**核心职责：**

1. 接收前端请求（TUI、Web 等客户端）
2. 路由分发到各个模块
3. 协调核心逻辑（Session、Agent、Tool 等）

**技术栈：**

- **Hono** — Web 框架
- **Bun** — HTTP 服务器
- **WebSocket** — 实时通信
- **SSE** — 服务端事件推送

---

## 二、中间件栈

请求处理流水线：

```
请求进入
    ↓
[1] 错误处理 onError
    ↓
[2] 基础认证 basicAuth (可选)
    ↓
[3] 请求日志 logging
    ↓
[4] CORS 跨域处理
    ↓
[5] 实例注入 Instance.provide
    ↓
[6] 路由匹配
    ↓
[7] 代理到 app.opencode.ai (兜底)
```

### 2.1 认证中间件

```typescript
// server.ts:84-88
const password = Flag.OPENCODE_SERVER_PASSWORD
if (!password) return next()
const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
return basicAuth({ username, password })(c, next)
```

可选的 Basic Auth 认证。

### 2.2 CORS 配置

```typescript
// server.ts:107-131
cors({
  origin(input) {
    if (input.startsWith("http://localhost:")) return input
    if (input.startsWith("http://127.0.0.1:")) return input
    if (/^https:\/\/([a-z0-9-]+\.)*opencode\.ai$/.test(input)) return input
    // ...
  },
})
```

允许本地访问和 opencode.ai 域名。

---

## 三、路由模块一览

通过 `.route()` 注册的路由模块：

| 路由            | 文件                     | 职责                         |
| --------------- | ------------------------ | ---------------------------- |
| `/session`      | `routes/session.ts`      | 会话管理、消息发送、LLM 调用 |
| `/project`      | `routes/project.ts`      | 项目管理                     |
| `/config`       | `routes/config.ts`       | 配置获取/设置                |
| `/provider`     | `routes/provider.ts`     | LLM Provider 管理            |
| `/auth`         | 内联 (server.ts:132-194) | 认证凭证管理                 |
| `/pty`          | `routes/pty.ts`          | 终端管理                     |
| `/mcp`          | `routes/mcp.ts`          | MCP 服务器                   |
| `/file`         | `routes/file.ts`         | 文件操作                     |
| `/permission`   | `routes/permission.ts`   | 权限检查                     |
| `/question`     | `routes/question.ts`     | 用户提问                     |
| `/global`       | `routes/global.ts`       | 全局路由                     |
| `/experimental` | `routes/experimental.ts` | 实验性功能                   |
| `/tui`          | `routes/tui.ts`          | TUI 专用接口                 |
| `/event`        | 内联 (server.ts:485-541) | 事件订阅 (SSE)               |
| `/agent`        | 内联 (server.ts:399-419) | 获取 Agent 列表              |
| `/skill`        | 内联 (server.ts:421-441) | 获取 Skill 列表              |

---

## 四、关键内置端点

| 端点                | 方法   | 作用                           |
| ------------------- | ------ | ------------------------------ |
| `/event`            | GET    | SSE 事件流，客户端订阅实时更新 |
| `/agent`            | GET    | 获取所有可用 Agent             |
| `/skill`            | GET    | 获取所有可用 Skill             |
| `/command`          | GET    | 获取所有命令                   |
| `/path`             | GET    | 获取当前路径信息               |
| `/vcs`              | GET    | 获取 Git 分支信息              |
| `/auth/:providerID` | POST   | 设置认证凭证                   |
| `/auth/:providerID` | DELETE | 删除认证凭证                   |
| `/doc`              | GET    | OpenAPI 文档                   |
| `/instance/dispose` | POST   | 释放当前实例                   |

---

## 五、核心流程：Session 消息处理

### 5.1 请求流程

```
客户端 POST /session/:sessionID/message
    ↓
SessionRoutes (session.ts:694-734)
    ↓
SessionPrompt.prompt()
    ↓
loop() {
    ├── 构建系统提示词
    ├── LLM 调用 (SessionProcessor)
    ├── 工具执行
    └── 返回结果
}
    ↓
SSE 事件推送到 /event
```

### 5.2 关键代码

```typescript
// server/routes/session.ts:724-732
;async (c) => {
  const sessionID = c.req.valid("param").sessionID
  const body = c.req.valid("json")
  const msg = await SessionPrompt.prompt({ ...body, sessionID })
  return stream(c, async (stream) => {
    stream.write(JSON.stringify(msg))
  })
}
```

---

## 六、Server 在项目中的定位

```
┌─────────────────────────────────────────┐
│           前端 (TUI / Web)              │
└─────────────────┬───────────────────────┘
                  │ HTTP / SSE
┌─────────────────▼───────────────────────┐
│         Server (server.ts)              │
│  ┌───────────────────────────────────┐ │
│  │ 中间件: 认证 / 日志 / CORS       │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ 路由: Session / Config / Agent   │ │
│  └───────────────────────────────────┘ │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      核心逻辑 (src/session/ 等)          │
│  - SessionPrompt.prompt()               │
│  - Agent / Tool / Skill                │
│  - Provider (LLM)                      │
└─────────────────────────────────────────┘
```

**Server 模块是前后端交互的枢纽**，所有客户端请求都通过它进入，再分发到对应的核心模块处理。

---

## 七、Server 模块文件清单

```
src/server/
├── server.ts           # 主服务器入口 (623 行)
├── error.ts            # 错误处理
├── event.ts            # 事件系统
├── mdns.ts            # mDNS 发现服务
└── routes/
    ├── session.ts      # 会话/消息 API (936 行)
    ├── project.ts     # 项目 API
    ├── config.ts      # 配置 API
    ├── provider.ts    # LLM Provider API
    ├── permission.ts  # 权限 API
    ├── question.ts    # 提问 API
    ├── global.ts      # 全局 API
    ├── pty.ts         # 终端 API
    ├── file.ts        # 文件 API
    ├── mcp.ts         # MCP 服务器 API
    ├── tui.ts         # TUI 专用 API
    └── experimental.ts # 实验性 API
```

---

## 八、总结

| 维度         | 说明                                          |
| ------------ | --------------------------------------------- |
| **框架**     | Hono + Bun                                    |
| **端口**     | 默认 4096                                     |
| **认证**     | 可选 Basic Auth                               |
| **通信**     | REST + SSE (事件流)                           |
| **职责**     | 接收请求 → 路由分发 → 调用核心逻辑 → 返回结果 |
| **核心端点** | `/session/:id/message` — 发送消息处理对话     |

---

## 九、参考资源

| 资源                           | 说明           |
| ------------------------------ | -------------- |
| `src/server/server.ts`         | 主服务器入口   |
| `src/server/routes/session.ts` | Session API    |
| `src/session/prompt.ts`        | 核心提示词处理 |
