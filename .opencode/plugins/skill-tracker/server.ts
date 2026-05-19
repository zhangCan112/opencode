import type { PluginInput } from "@opencode-ai/plugin"
import { createServer, type IncomingMessage, type ServerResponse } from "http"
import fs from "fs/promises"
import { mkdirSync } from "fs"
import path from "path"
import { Database } from "bun:sqlite"
import { htmlPage, adminPage } from "./server.ui"

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

const sseClients: Set<ServerResponse> = []
let logRoot = ""
let db: Database

const CTX_TTL = 3_600_000
const ctxCache = new Map<string, { ctx: SessionCtx; ttl: number }>()
const parentCache = new Map<string, { pid: string | null; ttl: number }>()
const MAX_CACHE_SIZE = 500

function getCtx(sid: string): SessionCtx | undefined {
  const e = ctxCache.get(sid)
  if (!e) return
  if (Date.now() > e.ttl) { ctxCache.delete(sid); return }
  return e.ctx
}

function setCtx(sid: string, ctx: SessionCtx) {
  if (ctxCache.size >= MAX_CACHE_SIZE) ctxCache.delete(ctxCache.keys().next().value)
  ctxCache.set(sid, { ctx, ttl: Date.now() + CTX_TTL })
}

function initDB(): Database {
  const p = path.join(logRoot, "skill-tracker-log", "skill-tracker.db")
  const dir = path.dirname(p)
  try { mkdirSync(dir, { recursive: true }) } catch {}
  const d = new Database(p)
  d.run("PRAGMA journal_mode=WAL")
  d.run(`CREATE TABLE IF NOT EXISTS records(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill TEXT NOT NULL,
    desc TEXT,
    agent TEXT NOT NULL,
    sub INTEGER NOT NULL DEFAULT 0,
    sid TEXT NOT NULL,
    pid TEXT,
    msg TEXT,
    mid TEXT,
    ts TEXT NOT NULL
  )`)
  d.run("CREATE INDEX IF NOT EXISTS idx_sid ON records(sid)")
  d.run("CREATE INDEX IF NOT EXISTS idx_ts ON records(ts)")
  d.run("CREATE INDEX IF NOT EXISTS idx_skill ON records(skill)")
  return d
}

async function migrateJSONL() {
  const dir = path.join(logRoot, "skill-tracker-log")
  try {
    await fs.access(dir)
  } catch { return }
  const sessions = await fs.readdir(dir)
  const insert = db.prepare(`INSERT INTO records(skill,desc,agent,sub,sid,pid,msg,mid,ts) VALUES($skill,$desc,$agent,$sub,$sid,$pid,$msg,$mid,$ts)`)
  for (const sid of sessions) {
    const p = path.join(dir, sid, "skill-tracker.jsonl")
    const done = path.join(dir, sid, "skill-tracker.jsonl.imported")
    try { await fs.access(done); continue } catch {}
    try {
      const content = await fs.readFile(p, "utf-8")
      const tx = db.transaction(() => {
        for (const line of content.split("\n")) {
          if (!line.trim()) continue
          try {
            const r = JSON.parse(line)
            insert.run({
              $skill: r.skillName, $desc: r.description ?? null,
              $agent: r.agent, $sub: r.isSubagent ? 1 : 0,
              $sid: r.sessionID, $pid: r.parentSessionID ?? null,
              $msg: r.triggerMessage ?? null, $mid: r.triggerMessageID ?? null,
              $ts: r.timestamp,
            })
          } catch (e) {
            console.warn("[skill-tracker] jsonl parse error:", e)
          }
        }
      })
      tx()
      await fs.rename(p, done)
    } catch (e) {
      console.warn("[skill-tracker] migrate session error:", e)
    }
  }
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
  const cached = parentCache.get(sessionID)
  if (cached && Date.now() < cached.ttl) {
    const pid = cached.pid
    if (!pid) return { parentID: null, parentCtx: null }
    return { parentID: pid, parentCtx: getCtx(pid) ?? null }
  }
  try {
    const res = await client.session.get({ path: { id: sessionID } })
    const pid = res.data?.parentID ?? null
    if (parentCache.size >= MAX_CACHE_SIZE) parentCache.delete(parentCache.keys().next().value)
    parentCache.set(sessionID, { pid, ttl: Date.now() + CTX_TTL })
    if (!pid) return { parentID: null, parentCtx: null }
    return { parentID: pid, parentCtx: getCtx(pid) ?? null }
  } catch (e) {
    console.warn("[skill-tracker] resolveParent error:", e)
    return { parentID: null, parentCtx: null }
  }
}

function mapRow(r: any): SkillRecord {
  return {
    skillName: r.skill,
    description: r.desc ?? "",
    agent: r.agent,
    isSubagent: r.sub === 1,
    sessionID: r.sid,
    parentSessionID: r.pid,
    triggerMessage: r.msg ?? "",
    triggerMessageID: r.mid ?? "",
    timestamp: r.ts,
  }
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
      const rows = sessionParam
        ? db.prepare("SELECT * FROM records WHERE sid = ? ORDER BY ts").all(sessionParam)
        : db.prepare("SELECT * FROM records ORDER BY ts").all()
      const result = (rows as any[]).map(mapRow)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(result))
      return
    }

    if (url.pathname === "/api/sessions") {
      const rows = db.prepare("SELECT sid, agent, pid, COUNT(*) as cnt, MAX(ts) as latest FROM records GROUP BY sid ORDER BY latest DESC").all() as any[]
      const sessions = rows.map((r: any) => ({
        id: r.sid,
        agent: r.agent,
        parentSessionID: r.pid,
        skills: r.cnt,
        latest: r.latest,
      }))
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(sessions))
      return
    }

    if (url.pathname === "/api/skills") {
      const rows = db.prepare("SELECT skill, COUNT(*) as cnt, MAX(ts) as last_used FROM records GROUP BY skill ORDER BY cnt DESC").all() as any[]
      const skills = rows.map((r: any) => ({
        name: r.skill,
        count: r.cnt,
        lastUsed: r.last_used,
      }))
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(skills))
      return
    }

    if (url.pathname === "/admin") {
      const stats = db.prepare("SELECT COUNT(*) as total, COUNT(DISTINCT sid) as sessions, MIN(ts) as first, MAX(ts) as last FROM records").get() as any
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(adminPage(stats))
      return
    }

    if (url.pathname === "/admin/clear" && req.method === "POST") {
      db.run("DELETE FROM records")
      res.writeHead(302, { Location: "/admin" })
      res.end()
      return
    }

    if (url.pathname === "/admin/clear-session" && req.method === "POST") {
      let body = ""
      req.on("data", (c) => body += c)
      req.on("end", () => {
        const { sid } = JSON.parse(body)
        db.prepare("DELETE FROM records WHERE sid = ?").run(sid)
        res.writeHead(302, { Location: "/admin" })
        res.end()
      })
      return
    }

    if (url.pathname === "/admin/export") {
      const rows = db.prepare("SELECT * FROM records ORDER BY ts").all() as any[]
      const result = rows.map(mapRow)
      res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=skill-records.json" })
      res.end(JSON.stringify(result, null, 2))
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
  const maxAgeDays = (options as { maxAgeDays?: number } | undefined)?.maxAgeDays
  logRoot = pluginInput.directory
  const client = pluginInput.client

  db = initDB()
  await migrateJSONL()
  if (maxAgeDays) {
    const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString()
    const { changes } = db.run("DELETE FROM records WHERE ts < ?", cutoff)
    if (changes > 0) console.log(`[skill-tracker] cleaned ${changes} records older than ${maxAgeDays} days`)
  }
  const insert = db.prepare(`INSERT INTO records(skill,desc,agent,sub,sid,pid,msg,mid,ts) VALUES($skill,$desc,$agent,$sub,$sid,$pid,$msg,$mid,$ts)`)
  startServer(port)
  ;(globalThis as Record<symbol, unknown>)[PORT_SYMBOL] = port

  return {
    async "chat.message"(msg: any, output: any) {
      const sid = msg.sessionID
      const text = extractText(output.parts as Array<{ type: string; text?: string }>)
      setCtx(sid, {
        agent: msg.agent ?? "unknown",
        msg: { id: output.message.id ?? "", text },
      })
    },

    async "tool.execute.after"(hook: any, output: any) {
      if (hook.tool !== "skill") return

      const sid = hook.sessionID
      const ctx = getCtx(sid)
      const args = hook.args as { name?: string } | undefined
      const skillName = args?.name ?? "unknown"

      const { parentID, parentCtx } = await resolveParent(sid, client)
      const isSubagent = parentID !== null

      const agent = ctx?.agent ?? "unknown"
      const triggerMessage = isSubagent ? (parentCtx?.msg.text ?? ctx?.msg.text ?? "") : (ctx?.msg.text ?? "")
      const triggerMessageID = isSubagent ? (parentCtx?.msg.id ?? ctx?.msg.id ?? "") : (ctx?.msg.id ?? "")

      const desc = extractDescription(output)
      const ts = new Date().toISOString()

      insert.run({
        $skill: skillName, $desc: desc || null,
        $agent: agent, $sub: isSubagent ? 1 : 0,
        $sid: sid, $pid: parentID,
        $msg: triggerMessage || null, $mid: triggerMessageID || null,
        $ts: ts,
      })

      broadcast({
        skillName,
        description: desc,
        agent,
        isSubagent,
        sessionID: sid,
        parentSessionID: parentID,
        triggerMessage,
        triggerMessageID,
        timestamp: ts,
      })
    },
  }
}

export default {
  id: "skill-tracker",
  server,
}
