'use strict';

// Normalized agent registry. Adapters push raw updates via update();
// status is derived here from event kind + age + process liveness.

const { isSourceAlive } = require('./procs');

const WORKING_WINDOW_MS = 20_000;   // any event this recent => working
const WAITING_AFTER_MS = 30_000;    // trailing tool_use older than this => waiting (permission?)
const IDLE_AFTER_MS = 2 * 60_000;   // no events => idle
const GONE_AFTER_MS = 10 * 60_000;  // stale => gone
const REMOVE_AFTER_MS = 40 * 60_000; // drop from registry entirely

const agents = new Map();
const listeners = new Set();

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function broadcast(msg) {
  for (const fn of listeners) fn(msg);
}

function deriveStatus(agent, now) {
  const age = now - agent.lastEventAt;
  if (age > GONE_AFTER_MS || !isSourceAlive(agent.source)) return 'gone';
  if (agent.lastEventKind === 'tool_use' && age > WAITING_AFTER_MS) return 'waiting';
  if (age > IDLE_AFTER_MS) return 'idle';
  if (agent.lastEventKind === 'prompt') return 'thinking';
  if (age <= WORKING_WINDOW_MS) return 'working';
  return 'idle';
}

// Merge a partial update from an adapter. `partial` must include `id` and
// `source`; everything else is optional and overwrites the stored agent.
function update(partial) {
  const now = Date.now();
  const prev = agents.get(partial.id) || {
    id: partial.id,
    source: partial.source,
    project: null,
    title: null,
    activity: null,
    isSubagent: false,
    lastEventKind: null,
    lastEventAt: now,
    firstSeenAt: now,
    tokens: { in: 0, out: 0 },
  };
  const agent = { ...prev, ...partial };
  agent.status = deriveStatus(agent, now);
  agents.set(agent.id, agent);
  broadcast({ type: 'agent', agent });
}

// Re-derive time-based statuses; called on a timer from index.js.
function tick() {
  const now = Date.now();
  for (const agent of agents.values()) {
    if (now - agent.lastEventAt > REMOVE_AFTER_MS) {
      agents.delete(agent.id);
      broadcast({ type: 'remove', id: agent.id });
      continue;
    }
    const status = deriveStatus(agent, now);
    if (status !== agent.status) {
      agent.status = status;
      broadcast({ type: 'agent', agent });
    }
  }
}

function snapshot() {
  return [...agents.values()];
}

module.exports = { update, tick, snapshot, subscribe };
