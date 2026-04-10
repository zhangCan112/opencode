# Skill Tracker

An OpenCode plugin that monitors, logs, and visualizes every invocation of the `skill` tool in real time.

## What It Does

- **Tracks** every skill invocation across all sessions and subagents
- **Persists** records as JSONL files so history survives restarts
- **Serves** a real-time web dashboard with REST API and SSE streaming
- **Shows** a live sidebar in the terminal UI with clickable links to the dashboard

## Installation

Place the plugin directory under your project's `.opencode/plugins/` folder:

```
.opencode/plugins/skill-tracker/
├── package.json
├── server.ts
├── tui.tsx
└── README.md
```

Then register it in your OpenCode config files.

### For the server (headless) mode

In `.opencode/opencode.jsonc`:

```jsonc
{
  "plugin": [["./plugins/skill-tracker", { "port": 3210 }]],
}
```

### For the TUI mode

In `.opencode/tui.json`:

```json
{
  "plugin": [["./plugins/skill-tracker", { "port": 3210 }]]
}
```

## Configuration

| Option | Type   | Default | Description                     |
| ------ | ------ | ------- | ------------------------------- |
| `port` | number | `3210`  | Port for the HTTP web UI server |

That's the only option. Pass it as the second element of the plugin tuple.

## Web Dashboard

Once OpenCode is running, open `http://localhost:3210` in your browser.

### Routes

| Route                          | Description                                           |
| ------------------------------ | ----------------------------------------------------- |
| `GET /`                        | All skill invocations across all sessions             |
| `GET /s/:sessionId`            | Filtered view for a single session                    |
| `GET /s/:sessionId/:skillName` | Highlights a specific skill within a session          |
| `GET /api/records`             | JSON array of all records (`?session=<id>` to filter) |
| `GET /api/sessions`            | JSON summary of all sessions with skill counts        |
| `GET /events`                  | SSE stream — pushes new records in real time          |

The dashboard auto-refreshes every 2 seconds and supports SSE for instant live updates.

### Dashboard Features

- Dark-themed, GitHub-style UI
- Skills grouped by session with collapsible sections
- Agent badges: **pri** (primary, green) and **sub** (subagent, yellow)
- Stats bar showing total invocations and session count
- Per-session filtering and skill highlighting via URL

## Terminal Sidebar

When using OpenCode's TUI mode, a sidebar section appears showing:

- A clickable URL to the web dashboard for the current session
- A list of skills invoked in the current session with invocation counts
- A preview of the trigger message for each skill
- Click any skill name to open its highlighted view in the browser

The sidebar auto-collapses when more than 2 skills are present (click to expand).

## Data

Each tracked invocation is stored as a JSON record:

```json
{
  "skillName": "brainstorming",
  "description": "Explores user intent and design before implementation",
  "agent": "build",
  "isSubagent": false,
  "sessionID": "ses_abc123",
  "parentSessionID": null,
  "triggerMessage": "Add a new login page",
  "triggerMessageID": "msg_xyz789",
  "timestamp": "2026-04-10T12:00:00.000Z"
}
```

Log files are stored at `<project-root>/skill-tracker-log/<sessionID>/skill-tracker.jsonl`.

## How It Works

1. The **server plugin** hooks into `chat.message` to capture session context and `tool.execute.after` to intercept every `skill` tool call
2. Each invocation is recorded to an in-memory array and appended to a JSONL log file
3. The record is broadcast to all connected SSE clients
4. The **TUI plugin** scans session messages to display skills in the sidebar and links to the web dashboard
5. On restart, historical JSONL logs are loaded back into memory

## Requirements

- [OpenCode](https://opencode.ai) with plugin support
- Bun runtime (for TUI JSX transforms)
