export function htmlPage(): string {
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
  <a href="/admin" style="color:#8b949e;text-decoration:none;font-size:11px;margin-left:12px">Manage</a>
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

export function adminPage(stats: { total: number; sessions: number; first: string | null; last: string | null }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill Tracker — Admin</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0a0a0a;color:#c9d1d9;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px;line-height:1.5;padding:40px}
  h1{font-size:18px;font-weight:600;margin-bottom:24px;color:#c9d1d9}
  .card{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:20px;margin-bottom:16px;max-width:500px}
  .card h2{font-size:14px;font-weight:500;margin-bottom:12px;color:#c9d1d9}
  .stat-row{display:flex;gap:24px;margin-bottom:8px}
  .stat-label{color:#8b949e;font-size:11px;text-transform:uppercase}
  .stat-value{color:#c9d1d9;font-size:16px;font-weight:600}
  .btn{display:inline-block;padding:8px 16px;border-radius:6px;border:none;cursor:pointer;font-size:13px;color:#fff;text-decoration:none}
  .btn-danger{background:#da3633}
  .btn-danger:hover{background:#b62324}
  .btn-primary{background:#238636}
  .btn-primary:hover{background:#2ea043}
  .btn-outline{background:transparent;border:1px solid #30363d;color:#c9d1d9}
  .btn-outline:hover{background:#161b22}
  .back{color:#8b949e;text-decoration:none;font-size:12px;margin-bottom:16px;display:inline-block}
  .back:hover{color:#c9d1d9}
  hr{border:none;border-top:1px solid #21262d;margin:16px 0}
  select,button{font-family:inherit;font-size:13px}
</style>
</head>
<body>
<a href="/" class="back">&larr; Back to dashboard</a>
<h1>Skill Tracker — Data Management</h1>
<div class="card">
  <h2>Overview</h2>
  <div class="stat-row"><div class="stat-label">Total Records</div><div class="stat-value">${stats.total}</div></div>
  <div class="stat-row"><div class="stat-label">Sessions</div><div class="stat-value">${stats.sessions}</div></div>
  <div class="stat-row"><div class="stat-label">First Record</div><div class="stat-value">${stats.first ? new Date(stats.first).toLocaleString() : "—"}</div></div>
  <div class="stat-row"><div class="stat-label">Last Record</div><div class="stat-value">${stats.last ? new Date(stats.last).toLocaleString() : "—"}</div></div>
</div>
<div class="card">
  <h2>Export</h2>
  <a href="/admin/export" class="btn btn-primary">Download JSON</a>
</div>
<div class="card">
  <h2>Clear All Data</h2>
  <p style="color:#8b949e;font-size:12px;margin-bottom:12px">This will permanently delete all tracked skill records.</p>
  <form method="POST" action="/admin/clear" onsubmit="return confirm('Delete ALL skill records? This cannot be undone.')">
    <button type="submit" class="btn btn-danger">Clear All Records</button>
  </form>
</div>
<div class="card" id="session-clear">
  <h2>Clear by Session</h2>
  <p style="color:#8b949e;font-size:12px;margin-bottom:12px">Select a session to delete its records.</p>
  <select id="session-select" style="width:100%;padding:6px 8px;background:#0a0a0a;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;margin-bottom:8px">
    <option value="">— loading sessions —</option>
  </select>
  <button class="btn btn-danger" onclick="clearSession()">Delete Selected Session</button>
</div>
<script>
async function loadSessions() {
  try {
    const r = await fetch("/api/sessions")
    const sessions = await r.json()
    const sel = document.getElementById("session-select")
    sel.innerHTML = '<option value="">— select session —</option>'
    for (const s of sessions) {
      const opt = document.createElement("option")
      opt.value = s.id
      opt.textContent = s.id.slice(0,8) + ".." + " (" + s.skills + " skills, " + s.agent + ")"
      sel.appendChild(opt)
    }
  } catch {}
}
async function clearSession() {
  const sel = document.getElementById("session-select")
  if (!sel.value) return
  if (!confirm("Delete records for session " + sel.value.slice(0,8) + "..?")) return
  await fetch("/admin/clear-session", { method: "POST", body: JSON.stringify({ sid: sel.value }) })
  location.reload()
}
loadSessions()
</script>
</body>
</html>`
}
