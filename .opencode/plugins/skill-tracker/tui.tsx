/** @jsxImportSource @opentui/solid */
import { createMemo, For, Show, createSignal } from "solid-js"

const id = "skill-tracker"

function launch(url: string) {
  try {
    const cmd = process.platform === "win32" ? "cmd" : "open"
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url]
    Bun.spawn(cmd, args)
  } catch {}
}

type SkillEntry = { name: string; count: number; trigger: string }

function getSkills(api: any, session_id: string): SkillEntry[] {
  const map = new Map<string, { count: number; trigger: string }>()
  try {
    const msgs = api.state.session.messages(session_id) ?? []
    for (let i = 0; i < msgs.length; i++) {
      try {
        const parts = api.state.part(msgs[i].id)
        for (const part of parts) {
          if (part.type === "tool" && part.tool === "skill") {
            const name = part.state?.input?.name
            if (!name) continue
            const prev = map.get(name)
            let trigger = ""
            for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
              if (msgs[j].role === "user") {
                const pp = api.state.part(msgs[j].id)
                for (const p of pp) {
                  if (p.type === "text" && p.text) {
                    trigger = p.text.slice(0, 60)
                    break
                  }
                }
                if (trigger) break
              }
            }
            map.set(name, prev ? { count: prev.count + 1, trigger: prev.trigger || trigger } : { count: 1, trigger })
          }
        }
      } catch {}
    }
  } catch {}
  return [...map].map(([name, v]) => ({ name, ...v })).reverse()
}

function View(props: { api: any; session_id: string; port: number }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current

  const skills = createMemo(() => getSkills(props.api, props.session_id))
  const url = `http://localhost:${props.port}/s/${props.session_id}`

  return (
    <Show when={skills().length > 0}>
      <box>
        <text fg={theme().info} onMouseUp={() => launch(url)}>
          {"  "}
          {url}
        </text>
        <box flexDirection="row" gap={1} onMouseDown={() => skills().length > 2 && setOpen((x) => !x)}>
          <Show when={skills().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Skills ({skills().length})</b>
          </text>
        </box>
        <Show when={skills().length <= 2 || open()}>
          <For each={skills()}>
            {(item) => (
              <box>
                <box flexDirection="row" gap={1}>
                  <text fg={theme().textMuted}>{"  "}</text>
                  <text
                    fg={theme().info}
                    onMouseUp={() => launch(`http://localhost:${props.port}/s/${props.session_id}/${item.name}`)}
                  >
                    {item.name}
                  </text>
                  <Show when={item.count > 1}>
                    <text fg={theme().textMuted}>x{item.count}</text>
                  </Show>
                </box>
                <text fg={theme().textMuted}>
                  {"    "}
                  {item.trigger.slice(0, 50)}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui = async (api: any, options: any) => {
  const port = options?.port ?? 3210

  api.slots.register({
    order: 450,
    slots: {
      sidebar_content(_ctx: any, props: any) {
        return <View api={api} session_id={props.session_id} port={port} />
      },
    },
  })
}

const plugin = { id, tui }

export default plugin
