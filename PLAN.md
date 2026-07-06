# Agent Office — Pixel-Art Agent Monitoring Dashboard

A Gather-town-style dashboard for watching AI coding agents (Claude Code, Kiro CLI,
Gemini CLI, and later GPT Codex CLI) work on this Mac. Each live agent session is a pixel character in a
top-down office; its activity shows as speech bubbles and status icons.

## Goals

- Everything runs in Docker: `docker compose up -d`, then open
  `http://localhost:4321`. (Also runs natively with `npm start` for dev.)
- Zero runtime dependencies (Node built-ins only, or a single tiny dep at most).
- Read-only: the dashboard observes agent session files; it never touches them.
- New agent types pluggable via small "adapter" modules.

## Data sources (verified on this machine, 2026-07-06)

### Claude Code
- Transcripts: `~/.claude/projects/<flattened-cwd>/<session-uuid>.jsonl`
- JSONL events include user/assistant messages and `tool_use` blocks
  (tool name + input, e.g. file being edited, command being run).
- Liveness: file mtime recency + `claude` processes in `ps`.
- Subagents appear as additional transcript activity — can render as extra
  smaller sprites near the parent.

### Kiro CLI
- Sessions: `~/.kiro/sessions/cli/<uuid>.jsonl` (event stream) +
  `<uuid>.json` (metadata: `cwd`, `title`, `created_at`, `updated_at`,
  `session_created_reason` — distinguishes subagents).
- JSONL event kinds observed: `Prompt`, `AssistantMessage`; tool events to be
  mapped when observed live.
- IDE sessions live in hash-named dirs under `~/.kiro/sessions/` — out of scope
  for v1 (CLI only), revisit later.
- Liveness: `.jsonl` mtime + `kiro-cli` process check.

### Gemini CLI
- Not yet run on this machine (`~/.gemini` exists but has no session data).
- Expected layout (verify on first run): `~/.gemini/tmp/<project-hash>/`
  with `logs.json` and `chats/` session files.
- Adapter stubbed in v1; finalized once a real session exists to inspect.

### GPT Codex CLI (future)
- Not yet installed (`~/.codex` exists with only `hooks.json`).
- Expected layout (verify on first run): session rollout files at
  `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl`, with
  metadata (cwd, model) in the first line and message/tool events following.
- Adapter added once Codex is installed and a real session can be inspected;
  the adapter interface (below) is designed so this is a drop-in module.

## Architecture

```
agent-office/
├── server/
│   ├── index.js          # HTTP server (static files + SSE endpoint)
│   ├── state.js          # normalized agent registry, diffing, event emit
│   ├── procs.js          # ps-based liveness polling (every ~3s)
│   └── adapters/
│       ├── claude.js     # watch ~/.claude/projects/**
│       ├── kiro.js       # watch ~/.kiro/sessions/cli/**
│       ├── gemini.js     # watch ~/.gemini/tmp/** (stub until format verified)
│       └── codex.js      # future: watch ~/.codex/sessions/** (see below)
├── web/
│   ├── index.html
│   ├── office.js         # canvas renderer: tilemap, sprites, camera
│   ├── sprites.js        # pixel art defined as data (palette-indexed arrays)
│   └── sim.js            # character movement/pathing, bubble layout
├── Dockerfile
├── docker-compose.yml    # read-only mounts of ~/.claude, ~/.kiro, ~/.gemini
└── PLAN.md
```

### Docker constraints (shape the design)

- Session dirs are bind-mounted **read-only** into the container at
  `/data/{claude,kiro,gemini,codex}`; adapters take their paths from env vars
  so the same code runs natively too.
- macOS bind mounts don't propagate fs events reliably, so watchers always
  pair `fs.watch` with a 2s mtime/size rescan (`watchutil.js`).
- `ps` inside the container can't see host CLI processes, so the process
  liveness check auto-disables in Docker (detected via `/.dockerenv`) and
  status falls back to event staleness alone.

- **Transport: Server-Sent Events**, not WebSocket — one-way push is all we
  need and SSE works with Node's built-in `http`, keeping zero dependencies.
- **Watching**: `fs.watch` on the session directories, debounced; on change,
  the adapter tail-reads only new bytes of the changed `.jsonl` (track offsets)
  and emits a normalized update.

### Normalized agent state

```js
{
  id: "claude:1c08a342…",        // source-prefixed session id
  source: "claude" | "kiro" | "gemini" | "codex",
  project: "/Users/metisn/Projects/farmfeed-iot",  // cwd → office room
  title: "Fix MQTT reconnect",   // session title / first user prompt
  status: "working" | "thinking" | "waiting" | "idle" | "gone",
  activity: "Bash: npm test",    // current/last tool call, human-readable
  isSubagent: false,
  lastEventAt: 1783317822000,
  tokens: { in: 0, out: 0 }      // when derivable (Claude usage blocks)
}
```

### Adapter contract

Each adapter is a module exporting `start(emit)` — it watches its CLI's session
files and calls `emit(agentState)` with the normalized shape above whenever an
agent appears, changes, or leaves. Adding a new CLI (like Codex) means writing
one adapter file and registering it in `server/index.js`; nothing else changes.

Status heuristics:
- `working` — tool_use event within the last ~20s
- `thinking` — user prompt sent, no assistant/tool event yet
- `waiting` — trailing `tool_use` with no result for >30s (likely a permission
  prompt), or explicit idle-at-prompt; shown with a "❗" over the sprite
- `idle` — no events for 2 min but process alive (sprite sits/sleeps)
- `gone` — process dead or mtime stale >10 min (sprite walks out the door)

## Frontend: the office

- **Canvas 2D**, fixed internal resolution (e.g. 480×320) scaled up with
  `image-rendering: pixelated` for crisp chunky pixels.
- **Tilemap office**: floor, walls, desks, plants, a door. One **room per
  project** (auto-laid-out on a grid as projects appear); room label = folder
  name.
- **Sprites**: 16×16 characters, 3–4 frame walk cycle, defined as
  palette-indexed number arrays in `sprites.js` (no image files, easy to tweak).
  - Claude — orange/coral character
  - Kiro — purple character
  - Gemini — blue character
  - Codex — green character (future)
  - Subagents — 8×8 "mini-me" trailing the parent
- **Behavior**: on spawn, character walks in through the door to a free desk in
  its project's room. Working = typing animation + speech bubble with current
  tool ("🔨 npm test"). Thinking = "…" bubble. Waiting = bounce + ❗. Idle =
  Zzz. Gone = walks out, desk frees up.
- **Interaction**: hover/click a character for a detail card (full title, cwd,
  last activity, session id, uptime, tokens). Click a room to zoom.
- Dark-room aesthetic by default; no external assets, works offline.

## Milestones

1. **M1 — Data layer** (server only): adapters for Claude + Kiro, normalized
   state over SSE, plus a plain-text debug page listing live agents. *Proves
   the monitoring works before any art.*
2. **M2 — Office renderer**: tilemap, one room, walking sprites bound to real
   agent state, speech bubbles, status icons.
3. **M3 — Polish**: rooms per project, subagent minis, detail cards,
   enter/leave animations, Gemini adapter finalized against real session data.
4. **M4 — Codex adapter**: once GPT Codex CLI is installed, verify its session
   format and add `adapters/codex.js` as a drop-in module.

## Status (2026-07-06)

M1–M3 built, verified, and deployed via `docker compose up -d`.
Extras added along the way:
- `DEMO=1` env populates the office with fake agents in every state.
- `?ff=<seconds>` URL param fast-forwards walk-in animations (used by
  headless-screenshot verification, handy after reloads).
Remaining: M4 (Codex adapter), Gemini adapter finalization — both blocked on
those CLIs producing real session data.

## Open questions

- Gemini CLI session format — verify after first real Gemini run.
- Codex CLI session format — expected `~/.codex/sessions/**/rollout-*.jsonl`,
  verify after installation and first run.
- Kiro tool-call event `kind` names — capture during a live Kiro session in M1.
- Kiro subagent detection: `session_created_reason` is stamped "subagent" on
  ALL CLI sessions (verified 2026-07-06), so it can't be used. All Kiro CLI
  sessions render as full agents until a real discriminator is observed.
- Claude "waiting for permission" has no explicit marker in transcripts; the
  trailing-tool_use heuristic needs tuning against real sessions.
- RESOLVED (2026-07-06): Claude subagent transcripts are separate files at
  `<project>/<session-uuid>/subagents/agent-<id>.jsonl` with isSidechain:true
  on every line — detected via path, rendered as minis, project inherited
  from the parent session.
- Claude per-line `cwd` drifts with the shell; the adapter pins the FIRST
  cwd as the launch dir and refines the project to the first-level subdir
  the agent's file edits point into (so same-workspace agents share a room).
