'use strict';

// Smart file watching that works both natively and inside Docker.
//
// Native mode: fs.watch(recursive) is the primary event source; a slow
// fallback poll (5s) only re-stats known files. Much lighter than the old
// full-readdirSync every 2s.
//
// Docker mode: fs.watch events don't propagate reliably across macOS bind
// mounts (VirtioFS), so we use a fast poll (2s) that stats known files and
// a slow discovery scan (30s) that does a full readdirSync to pick up new
// session files.
//
// Known-files index is pruned on ENOENT and on stale mtime (>40 min) during
// slow scans.

const fs = require('fs');
const path = require('path');

const DOCKER_MODE = fs.existsSync('/.dockerenv') || process.env.DOCKER_WATCH === '1';

const NATIVE_POLL_MS = 5000;
const DOCKER_FAST_POLL_MS = 2000;
const DOCKER_SLOW_POLL_MS = 30000;
const STALE_MS = 2400000; // 40 minutes

// offsets: file -> { offset, remainder }
const tails = new Map();

// Read bytes appended since the last call and invoke onLine per full line.
function tailRead(file, onLine) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    tails.delete(file);
    return;
  }
  let t = tails.get(file);
  if (!t) {
    t = { offset: 0, remainder: '' };
    tails.set(file, t);
  }
  if (stat.size < t.offset) {
    // truncated/rewritten — start over
    t.offset = 0;
    t.remainder = '';
  }
  if (stat.size === t.offset) return;

  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(stat.size - t.offset);
    fs.readSync(fd, buf, 0, buf.length, t.offset);
    t.offset = stat.size;
    const chunk = t.remainder + buf.toString('utf8');
    const lines = chunk.split('\n');
    t.remainder = lines.pop(); // last element is partial (or '')
    for (const line of lines) {
      if (line.trim()) onLine(line);
    }
  } finally {
    fs.closeSync(fd);
  }
}

// Watch a directory tree for files matching `filter`; call onChange(file)
// whenever one appears or grows. Returns a stop function.
function watchTree(dir, filter, onChange) {
  const known = new Map(); // file -> {size, mtimeMs}

  // --- Helpers ---

  // Check a single file: update known index and call onChange if changed.
  function checkFile(file) {
    if (!filter(file)) return;
    let stat;
    try {
      stat = fs.statSync(file);
    } catch (err) {
      if (err && err.code === 'ENOENT') known.delete(file);
      return;
    }
    const prev = known.get(file);
    if (!prev || prev.size !== stat.size || prev.mtimeMs !== stat.mtimeMs) {
      known.set(file, { size: stat.size, mtimeMs: stat.mtimeMs });
      onChange(file, stat);
    }
  }

  // Full directory scan — populates the known-files index and calls onChange
  // for every matching file found (or changed since last seen).
  function fullScan() {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
    } catch {
      return; // dir may not exist yet (CLI never run) — keep polling
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const file = path.join(e.parentPath ?? e.path, e.name);
      checkFile(file);
    }
  }

  // Poll only files already in the known index (no readdirSync).
  function pollKnown() {
    for (const file of known.keys()) {
      checkFile(file);
    }
  }

  // Prune entries older than STALE_MS from the known-files index.
  function pruneStale() {
    const now = Date.now();
    for (const [file, info] of known) {
      if (now - info.mtimeMs > STALE_MS) {
        known.delete(file);
      }
    }
  }

  // --- Initial scan (same behavior as before) ---
  fullScan();

  // --- Mode-specific watchers and timers ---
  const timers = [];
  let watcher = null;

  if (DOCKER_MODE) {
    // Docker mode: fast poll known files + slow discovery scan
    const fast = setInterval(pollKnown, DOCKER_FAST_POLL_MS);
    fast.unref();
    timers.push(fast);

    const slow = setInterval(() => {
      pruneStale();
      fullScan();
    }, DOCKER_SLOW_POLL_MS);
    slow.unref();
    timers.push(slow);

    // Still attempt fs.watch — it sometimes works and gives faster signals
    try {
      watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
        if (filename) {
          checkFile(path.join(dir, filename));
        }
      });
    } catch {
      // fine — polling covers it
    }
  } else {
    // Native mode: fs.watch is primary, slow poll as fallback
    try {
      watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
        if (filename) {
          checkFile(path.join(dir, filename));
        }
      });
    } catch {
      // recursive fs.watch unavailable — polling covers it
    }

    const fallback = setInterval(pollKnown, NATIVE_POLL_MS);
    fallback.unref();
    timers.push(fallback);
  }

  // --- Stop function ---
  return () => {
    for (const t of timers) clearInterval(t);
    if (watcher) watcher.close();
  };
}

module.exports = { tailRead, watchTree };
