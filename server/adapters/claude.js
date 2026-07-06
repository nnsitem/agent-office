'use strict';

// Claude Code adapter: ~/.claude/projects/<flattened-cwd>/<session>.jsonl
// Event lines of interest: type user/assistant (message content blocks),
// ai-title (session title). Everything else (mode, snapshots, attachments,
// system) is noise for monitoring purposes.

const os = require('os');
const path = require('path');
const fs = require('fs');
const { watchTree, tailRead } = require('../watchutil');
const { summarizeInput, truncate, staleSkipper, normPath } = require('./common');

const DIR = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude', 'projects');

// The transcript's cwd is where Claude Code was LAUNCHED, but the agent may
// be working in a subdirectory (e.g. launched in ~/Projects, editing
// ~/Projects/agent-office/*). Refine the project to that first-level subdir
// so agents in the same workspace share a room regardless of launch dir.
function refineWorkdir(cwd, toolInput) {
  const p = toolInput && (toolInput.file_path || toolInput.path || toolInput.notebook_path);
  if (!p || !cwd || !p.startsWith(cwd + '/')) return null;
  const rel = p.slice(cwd.length + 1);
  const seg = rel.split('/');
  return seg.length > 1 ? cwd + '/' + seg[0] : cwd;
}

function start(emit) {
  const shouldSkip = staleSkipper();
  // per-session sticky fields that individual lines only set sometimes
  const meta = new Map(); // id -> { title, project, isSubagent, tokens }

  watchTree(DIR, (f) => f.endsWith('.jsonl'), (file, stat) => {
    if (shouldSkip(file, stat)) return;
    // subagent transcripts live at <session-uuid>/subagents/agent-<id>.jsonl
    const sub = file.match(/\/([0-9a-f-]{36})\/subagents\/(agent-[\w]+)\.jsonl$/);
    const id = 'claude:' + (sub ? sub[2] : path.basename(file, '.jsonl'));
    if (!meta.has(id)) meta.set(id, { tokens: { in: 0, out: 0 } });
    const m = meta.get(id);
    let last = null; // { kind, at, activity }

    tailRead(file, (line) => {
      let d;
      try {
        d = JSON.parse(line);
      } catch {
        return;
      }
      const at = d.timestamp ? Date.parse(d.timestamp) : stat.mtimeMs;
      // pin to the FIRST cwd (the launch dir): later lines drift with the
      // shell, which would double-apply the workdir refinement below
      if (d.cwd && !m.project) m.project = normPath(d.cwd);
      if (d.type === 'ai-title') {
        m.title = d.aiTitle;
        return;
      }
      const prefix = d.isSidechain ? '⑂ ' : '';
      if (d.type === 'user' && !d.isMeta && d.message) {
        const c = d.message.content;
        if (typeof c === 'string') {
          // slash-command / skill invocations arrive as <command-name> tags
          const cmd = c.match(/<command-name>\/?([\w:-]+)<\/command-name>/);
          if (!m.title) m.title = truncate(c, 60);
          last = cmd
            ? { kind: 'prompt', at, activity: prefix + '⚡ /' + cmd[1] }
            : { kind: 'prompt', at, activity: prefix + truncate(c, 80) };
        } else if (Array.isArray(c)) {
          if (c.some((b) => b.type === 'tool_result')) {
            last = { kind: 'tool_result', at, activity: last && last.activity };
          } else {
            const text = c.find((b) => b.type === 'text');
            if (text) {
              if (!m.title) m.title = truncate(text.text, 60);
              last = { kind: 'prompt', at, activity: prefix + truncate(text.text, 80) };
            }
          }
        }
      } else if (d.type === 'assistant' && d.message) {
        const usage = d.message.usage;
        if (usage) {
          m.tokens.in += usage.input_tokens || 0;
          m.tokens.out += usage.output_tokens || 0;
        }
        const tool = (d.message.content || []).find((b) => b.type === 'tool_use');
        if (tool) {
          const mcp = tool.name.match(/^mcp__(.+?)__(.+)$/); // mcp__<server>__<tool>
          const label = tool.name === 'Skill'
            ? '⚡ /' + (tool.input && tool.input.skill || '?') +
              (tool.input && tool.input.args ? ' ' + truncate(tool.input.args, 30) : '')
            : mcp
            ? '🔌 ' + mcp[1] + ': ' + mcp[2] + ' ' + summarizeInput(tool.input)
            : tool.name + ': ' + summarizeInput(tool.input);
          last = { kind: 'tool_use', at, activity: prefix + label };
          const wd = refineWorkdir(m.project, tool.input);
          if (wd) m.workdir = wd;
        } else {
          last = { kind: 'assistant', at, activity: last && last.activity };
        }
      }
    });

    if (!last && !meta.get(id).emitted) return; // nothing monitorable yet
    m.emitted = true;
    // subagents inherit the parent session's (refined) project so they
    // perch next to their parent in the office
    const parent = sub && meta.get('claude:' + sub[1]);
    emit({
      id,
      source: 'claude',
      project: (parent && (parent.workdir || parent.project)) || m.workdir || m.project || null,
      title: m.title || null,
      isSubagent: !!sub,
      tokens: m.tokens,
      ...(last && {
        lastEventKind: last.kind,
        lastEventAt: last.at,
        // omit when unknown so a tool_result-only batch keeps the last activity
        ...(last.activity ? { activity: last.activity } : {}),
      }),
    });
  });
}

module.exports = { start };
