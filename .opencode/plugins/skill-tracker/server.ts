import type { PluginInput } from "@opencode-ai/plugin"
import { createServer, type IncomingMessage, type ServerResponse } from "http"
import fs from "fs/promises"
import path from "path"

type SkillRecord = {
  skillName: string
  description: string
  agent: string
  isSubagent: boolean
  sessionID: string
  parentSessionID: string | null
  triggerMessage: string
  triggerMessageID: string
  timestamp: string
}

type SessionCtx = {
  agent: string
  msg: { id: string; text: string }
}

export const PORT_SYMBOL = Symbol("skill-tracker-port")

const sessionCtx = new Map<string, SessionCtx>()
const records: SkillRecord[] = []
const sseClients: Set<ServerResponse> = []
let logRoot = ""
let loaded = false

function logPath(sessionID: string): string {
  return path.join(logRoot, "skill-tracker-log", sessionID, "skill-tracker.jsonl")
}

async function loadHistory() {
  if (loaded) return
  loaded = true
  try {
    const logDir = path.join(logRoot, "skill-tracker-log")
    await fs.access(logDir)
    const sessions = await fs.readdir(logDir)
    for (const sid of sessions) {
      const file = path.join(logDir, sid, "skill-tracker.jsonl")
      try {
        const content = await fs.readFile(file, "utf-8")
        for (const line of content.split("\n")) {
          if (!line.trim()) continue
          try {
            records.push(JSON.parse(line))
          } catch {}
        }
      } catch {}
    }
  } catch {}
}

async function append(rec: SkillRecord) {
  const file = logPath(rec.sessionID)
  const dir = path.dirname(file)
  await fs.mkdir(dir, { recursive: true }).catch(() => {})
  const line = JSON.stringify(rec) + "\n"
  await fs.appendFile(file, line, "utf-8").catch((err) => {
    console.warn("[skill-tracker] failed to write log:", err)
  })
}

function broadcast(rec: SkillRecord) {
  const data = `data: ${JSON.stringify(rec)}\n\n`
  for (const res of sseClients) {
    res.write(data)
  }
}

function extractText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join(" ")
    .slice(0, 500)
}

function extractDescription(out: { output?: string } | null): string {
  const text = out?.output ?? ""
  const m = text.match(/description:\s*(?:"([^"]*)"|'([^']*)'|([^\n"']+))/)
  if (m) return (m[1] || m[2] || m[3] || "").trim().slice(0, 300)
  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/^#+\s*/, "").trim()
    if (l && !l.startsWith("<") && !l.startsWith("*") && !l.startsWith("Base dir")) return l.slice(0, 300)
  }
  return ""
}

async function resolveParent(
  sessionID: string,
  client: PluginInput["client"],
): Promise<{ parentID: string | null; parentCtx: SessionCtx | null }> {
  try {
    const res = await client.session.get({ path: { id: sessionID } })
    const parentID = res.data?.parentID ?? null
    if (!parentID) return { parentID: null, parentCtx: null }
    return { parentID, parentCtx: sessionCtx.get(parentID) ?? null }
  } catch {
    return { parentID: null, parentCtx: null }
  }
}

function htmlPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Tracker</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a0a;color:#c9d1d9;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px;line-height:1.5}
  .header{position:sticky;top:0;z-index:10;background:#161b22;border-bottom:1px solid #30363d;padding:10px 20px;display:flex;align-items:center;justify-content:space-between}
  .header h1{font-size:13px;font-weight:600;color:#c9d1d9}
  .header .live{display:flex;align-items:center;gap:6px;font-size:11px;color:#8b949e}
  .header .dot{width:6px;height:6px;border-radius:50%;background:#3fb950;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .stats{background:#161b22;border-bottom:1px solid #30363d;padding:6px 20px;font-size:11px;color:#8b949e;display:flex;gap:16px}
  .stats span{color:#c9d1d9}
  .container{padding:0;max-width:100%}
  .empty{text-align:center;color:#484f58;padding:60px 0;font-size:13px}
  table{width:100%;border-collapse:collapse}
  thead{position:sticky;top:53px;z-index:9;background:#161b22}
  th{text-align:left;padding:6px 12px;font-size:11px;color:#8b949e;font-weight:500;border-bottom:1px solid #30363d;white-space:nowrap}
  td{padding:6px 12px;border-bottom:1px solid #21262d;vertical-align:top}
  tr:hover td{background:#161b22}
  tr.highlight td{background:#1c2333}
  .c-time{color:#8b949e;white-space:nowrap;font-size:11px}
  .c-skill{color:#79c0ff;font-weight:500}
  .c-desc{color:#8b949e;font-style:italic;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .c-agent{color:#c9d1d9;font-size:11px}
  .c-tag{display:inline-block;padding:0 5px;border-radius:3px;font-size:10px;font-weight:500;line-height:1.6}
  .tag-primary{background:#1b3a2a;color:#3fb950}
  .tag-sub{background:#3b2e1a;color:#d29922}
  .c-trigger{color:#8b949e;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
  .c-session{color:#484f58;font-size:10px}
  .session-group{margin-bottom:0}
  .session-header{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#161b22;border-bottom:1px solid #30363d;cursor:pointer;font-size:12px}
  .session-header:hover{background:#1c2128}
  .session-header .toggle{color:#8b949e;width:12px;font-size:10px}
  .session-header .sid{color:#79c0ff;font-weight:500}
  .session-header .agent-badge{display:inline-block;padding:0 5px;border-radius:3px;font-size:10px;font-weight:500}
  .badge-primary{background:#1b3a2a;color:#3fb950}
  .badge-sub{background:#3b2e1a;color:#d29922}
  .session-header .skill-count{color:#8b949e;font-size:11px}
  .session-header .time-label{color:#484f58;font-size:11px;margin-left:auto}
  html{scroll-behavior:smooth}
</style>
</head>
<body>
<div class="header">
  <h1>Skill Tracker<span id="filter-label"></span></h1>
  <div class="live"><div class="dot"></div> Live</div>
</div>
<div class="stats">
  <div>Total: <span id="st-total">0</span></div>
  <div>Sessions: <span id="st-sessions">0</span></div>
</div>
<div class="container" id="cards">
  <div class="empty" id="empty">Waiting for skill triggers...</div>
</div>
<!--FILTER_INJECT-->
<script>
const el = document.getElementById("cards");
const emptyEl = document.getElementById("empty");
const stTotal = document.getElementById("st-total");
const stSessions = document.getElementById("st-sessions");
const seen = new Set();
const grouped = new Map();

const filterSession = window.__FILTER_SESSION || null;
const highlightSkill = window.__HIGHLIGHT_SKILL || null;

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

function shortSid(s) {
  return s.length > 20 ? s.slice(0, 8) + ".." + s.slice(-6) : s;
}

function addRecord(r) {
  if (!grouped.has(r.sessionID)) {
    grouped.set(r.sessionID, { records: [], isSubagent: r.isSubagent, agent: r.agent, parentSessionID: r.parentSessionID });
  }
  grouped.get(r.sessionID).records.push(r);
}

function renderSingleSession(sid) {
  if (emptyEl) emptyEl.remove();
  el.innerHTML = "";
  const grp = grouped.get(sid);
  if (!grp) return;
  stTotal.textContent = grp.records.length;
  stSessions.textContent = 1;
  const rows = grp.records.slice().reverse();
  let tbody = "";
  for (const r of rows) {
    const tag = r.isSubagent ? '<span class="c-tag tag-sub">sub</span>' : '<span class="c-tag tag-primary">pri</span>';
    const desc = r.description ? esc(r.description) : '';
    tbody += '<tr data-skill="' + esc(r.skillName) + '">' +
      '<td class="c-time">' + fmtTime(r.timestamp) + '</td>' +
      '<td class="c-skill">' + esc(r.skillName) + '</td>' +
      '<td class="c-desc" title="' + esc(r.description || '') + '">' + desc + '</td>' +
      '<td class="c-agent">' + tag + ' ' + esc(r.agent) + '</td>' +
      '<td class="c-trigger" title="' + esc(r.triggerMessage || '') + '">' + esc(r.triggerMessage || "-") + '</td>' +
    '</tr>';
  }
  el.innerHTML = '<table><thead><tr><th>Time</th><th>Skill</th><th>Description</th><th>Agent</th><th>Trigger</th></tr></thead><tbody>' + tbody + '</tbody></table>';
}

function renderAll() {
  if (emptyEl) emptyEl.remove();
  el.innerHTML = "";
  let total = 0;
  const sessions = [...grouped.entries()].reverse();
  for (const [sid, grp] of sessions) {
    total += grp.records.length;
    const badge = grp.isSubagent
      ? '<span class="agent-badge badge-sub">sub</span>'
      : '<span class="agent-badge badge-primary">pri</span>';
    const latest = grp.records[grp.records.length - 1];
    const parentLine = grp.parentSessionID
      ? '<span style="color:#484f58;font-size:10px"> parent: ' + esc(shortSid(grp.parentSessionID)) + '</span>'
      : '';
    const rows = grp.records.slice().reverse();
    let tbody = "";
    for (const r of rows) {
      const tag = r.isSubagent ? '<span class="c-tag tag-sub">sub</span>' : '<span class="c-tag tag-primary">pri</span>';
      const desc = r.description ? esc(r.description) : '';
      tbody += '<tr data-skill="' + esc(r.skillName) + '">' +
        '<td class="c-time">' + fmtTime(r.timestamp) + '</td>' +
        '<td class="c-skill">' + esc(r.skillName) + '</td>' +
        '<td class="c-desc" title="' + esc(r.description || '') + '">' + desc + '</td>' +
        '<td class="c-agent">' + tag + ' ' + esc(r.agent) + '</td>' +
        '<td class="c-trigger" title="' + esc(r.triggerMessage || '') + '">' + esc(r.triggerMessage || "-") + '</td>' +
      '</tr>';
    }
    const html =
      '<div class="session-group" data-session="' + esc(sid) + '">' +
        '<div class="session-header" onclick="toggleSession(this)">' +
          '<span class="toggle">▼</span>' +
          '<span class="sid">' + esc(shortSid(sid)) + '</span>' +
          badge +
          '<span class="skill-count">' + grp.records.length + ' skill' + (grp.records.length > 1 ? 's' : '') + '</span>' +
          parentLine +
          '<span class="time-label">' + fmtTime(latest.timestamp) + '</span>' +
        '</div>' +
        '<div class="session-cards">' +
          '<table><thead><tr><th>Time</th><th>Skill</th><th>Description</th><th>Agent</th><th>Trigger</th></tr></thead><tbody>' + tbody + '</tbody></table>' +
        '</div>' +
      '</div>';
    el.insertAdjacentHTML("beforeend", html);
  }
  stTotal.textContent = total;
  stSessions.textContent = sessions.length;
}

function render() {
  if (filterSession) renderSingleSession(filterSession);
  else renderAll();
}

function toggleSession(header) {
  const cards = header.nextElementSibling;
  const toggle = header.querySelector(".toggle");
  if (cards.style.display === "none") {
    cards.style.display = "";
    toggle.textContent = "▼";
  } else {
    cards.style.display = "none";
    toggle.textContent = "▶";
  }
}

async function init() {
  const filterLabel = document.getElementById("filter-label");
  if (filterSession) {
    filterLabel.textContent = " \\u2014 session " + shortSid(filterSession);
  }
  function poll() {
    const api = filterSession ? "/api/records?session=" + encodeURIComponent(filterSession) : "/api/records";
    fetch(api).then(r => r.json()).then(data => {
      let changed = false;
      for (const r of data) {
        const key = r.sessionID + r.skillName + r.timestamp;
        if (!seen.has(key)) {
          seen.add(key);
          addRecord(r);
          changed = true;
        }
      }
      if (changed) render();
      if (highlightSkill) {
        const target = el.querySelector('[data-skill="' + CSS.escape(highlightSkill) + '"]');
        if (target) {
          document.querySelectorAll('tr.highlight').forEach(c => c.classList.remove('highlight'));
          target.classList.add('highlight');
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }).catch(() => {});
  }
  poll();
  setInterval(poll, 2000);
}
init();
</script>
</body>
</html>`
}

function startServer(port: number) {
  const srv = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`)

    if (url.pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      })
      res.flushHeaders()
      res.write(":\n\n")
      sseClients.add(res)
      const hb = setInterval(() => {
        res.write(": heartbeat\n\n")
      }, 15000)
      req.on("close", () => {
        clearInterval(hb)
        sseClients.delete(res)
      })
      return
    }

    if (url.pathname === "/api/records") {
      const sessionParam = url.searchParams.get("session")
      const filtered = sessionParam ? records.filter((r) => r.sessionID === sessionParam) : records
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(filtered))
      return
    }

    if (url.pathname === "/api/sessions") {
      const grouped = new Map<string, { records: SkillRecord[]; agent: string; parentSessionID: string | null }>()
      for (const r of records) {
        if (!grouped.has(r.sessionID)) {
          grouped.set(r.sessionID, {
            records: [],
            agent: r.agent,
            parentSessionID: r.parentSessionID,
          })
        }
        grouped.get(r.sessionID)!.records.push(r)
      }
      const sessions = [...grouped.entries()]
        .map(([id, v]) => ({
          id,
          agent: v.agent,
          parentSessionID: v.parentSessionID,
          skills: v.records.length,
          latest: v.records[v.records.length - 1].timestamp,
        }))
        .sort((a, b) => b.latest.localeCompare(a.latest))
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(sessions))
      return
    }

    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(htmlPage())
      return
    }

    const sessionMatch = url.pathname.match(/^\/s\/([^/]+)(?:\/(.+))?$/)
    if (sessionMatch) {
      const sid = sessionMatch[1]
      const skillName = sessionMatch[2] || null
      const html = htmlPage()
      const inject = `<script>window.__FILTER_SESSION="${sid}";window.__HIGHLIGHT_SKILL=${skillName ? `"${skillName}"` : "null"};</script>`
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(html.replace("<!--FILTER_INJECT-->", inject))
      return
    }

    res.writeHead(404)
    res.end("not found")
  })

  srv.listen(port, () => {
    console.log(`[skill-tracker] web UI at http://localhost:${port}`)
  })

  srv.on("error", (err) => {
    console.warn("[skill-tracker] server error:", err)
  })
}

async function server(pluginInput: PluginInput, options: Record<string, unknown> | undefined) {
  const port = (options as { port?: number } | undefined)?.port ?? 3210
  logRoot = pluginInput.directory
  const client = pluginInput.client

  await loadHistory()
  startServer(port)
  ;(globalThis as Record<symbol, unknown>)[PORT_SYMBOL] = port

  return {
    async "chat.message"(msg: any, output: any) {
      const sid = msg.sessionID
      const text = extractText(output.parts as Array<{ type: string; text?: string }>)
      sessionCtx.set(sid, {
        agent: msg.agent ?? "unknown",
        msg: { id: output.message.id ?? "", text },
      })
    },

    async "tool.execute.after"(hook: any, output: any) {
      if (hook.tool !== "skill") return

      const sid = hook.sessionID
      const ctx = sessionCtx.get(sid)
      const args = hook.args as { name?: string } | undefined
      const skillName = args?.name ?? "unknown"

      const { parentID, parentCtx } = await resolveParent(sid, client)
      const isSubagent = parentID !== null

      const agent = ctx?.agent ?? "unknown"
      const triggerMessage = isSubagent ? (parentCtx?.msg.text ?? ctx?.msg.text ?? "") : (ctx?.msg.text ?? "")
      const triggerMessageID = isSubagent ? (parentCtx?.msg.id ?? ctx?.msg.id ?? "") : (ctx?.msg.id ?? "")

      const rec: SkillRecord = {
        skillName,
        description: extractDescription(output),
        agent,
        isSubagent,
        sessionID: sid,
        parentSessionID: parentID,
        triggerMessage,
        triggerMessageID,
        timestamp: new Date().toISOString(),
      }

      records.push(rec)
      await append(rec)
      broadcast(rec)
    },
  }
}

export default {
  id: "skill-tracker",
  server,
}
