'use strict';

// Kiro CLI adapter: ~/.kiro/sessions/cli/<uuid>.jsonl (event stream) with a
// sibling <uuid>.json (metadata: cwd, title, session_created_reason).
// Event kinds: Prompt, AssistantMessage (may contain toolUse content
// blocks), ToolResults.

const os = require('os');
const path = require('path');
const fs = require('fs');
const { watchTree, tailRead } = require('../watchutil');
const { summarizeInput, truncate, staleSkipper, normPath } = require('./common');

const DIR = process.env.KIRO_DIR || path.join(os.homedir(), '.kiro', 'sessions', 'cli');

function readMeta(jsonlFile) {
  try {
    const raw = fs.readFileSync(jsonlFile.replace(/\.jsonl$/, '.json'), 'utf8');
    const d = JSON.parse(raw);
    return {
      project: normPath(d.cwd) || null,
      title: d.title || null,
      // Kiro CLI stamps session_created_reason:"subagent" on ALL CLI
      // sessions (verified 2026-07-06 across interactive top-level runs),
      // so it is NOT a subagent signal. Treat every CLI session as
      // top-level until a real discriminator is observed.
      isSubagent: false,
    };
  } catch {
    return {};
  }
}

function start(emit) {
  const shouldSkip = staleSkipper();

  watchTree(DIR, (f) => f.endsWith('.jsonl'), (file, stat) => {
    if (shouldSkip(file, stat)) return;
    const id = 'kiro:' + path.basename(file, '.jsonl');
    let last = null;

    tailRead(file, (line) => {
      let d;
      try {
        d = JSON.parse(line);
      } catch {
        return;
      }
      const data = d.data || {};
      const at = data.meta && data.meta.timestamp ? data.meta.timestamp * 1000 : stat.mtimeMs;
      if (d.kind === 'Prompt') {
        const text = (data.content || []).find((b) => b.kind === 'text');
        last = { kind: 'prompt', at, activity: truncate(text ? text.data : '', 80) };
      } else if (d.kind === 'AssistantMessage') {
        const tool = (data.content || []).find((b) => b.kind === 'toolUse');
        if (tool) {
          const label = /skill/i.test(tool.data.name)
            ? '⚡ ' + (summarizeInput(tool.data.input) || tool.data.name)
            : tool.data.name + ': ' + summarizeInput(tool.data.input);
          last = { kind: 'tool_use', at, activity: label, tool: tool.data.name };
        } else {
          last = { kind: 'assistant', at, activity: last && last.activity };
        }
      } else if (d.kind === 'ToolResults') {
        last = { kind: 'tool_result', at, activity: last && last.activity };
      }
    });

    if (!last) return;
    emit({
      id,
      source: 'kiro',
      ...readMeta(file),
      lastEventKind: last.kind,
      lastEventAt: last.at,
      ...(last.activity ? { activity: last.activity } : {}),
      ...(last.tool ? { lastTool: last.tool } : {}),
    });
  });
}

module.exports = { start };
