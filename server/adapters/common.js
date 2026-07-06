'use strict';

// Shared helpers for adapters.

function normPath(p) {
  return typeof p === 'string' ? p.replace(/\/+$/, '') : p;
}

function truncate(s, n) {
  if (typeof s !== 'string') return '';
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Human-readable one-liner for a tool call's input.
function summarizeInput(input) {
  if (!input || typeof input !== 'object') return '';
  const pick =
    input.description || input.command || input.file_path || input.path ||
    input.pattern || input.query || input.prompt || input.url ||
    Object.values(input).find((v) => typeof v === 'string');
  return truncate(pick || '', 80);
}

// Sessions that were already stale when the server started are history, not
// live agents — skip them until (unless) they grow again. First sight of a
// stale file records its size so a later resume only replays new events.
function staleSkipper(windowMs = 15 * 60_000) {
  const startedAt = Date.now();
  const seenStale = new Set();
  return function shouldSkip(file, stat) {
    if (seenStale.has(file)) return false; // grew after being seen: live now
    if (stat.mtimeMs < startedAt - windowMs) {
      seenStale.add(file);
      // prime the tail offset so a future resume skips old history
      require('../watchutil').tailRead(file, () => {});
      return true;
    }
    return false;
  };
}

module.exports = { truncate, summarizeInput, staleSkipper, normPath };
