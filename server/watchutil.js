'use strict';

// File watching that works both natively and inside Docker. fs.watch events
// don't propagate reliably across macOS bind mounts (VirtioFS), so we always
// pair it with a periodic mtime/size rescan; fs.watch just makes native runs
// snappier. Tail-reading tracks a byte offset per file and hands complete
// new lines to the callback.

const fs = require('fs');
const path = require('path');

const POLL_MS = 2000;

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

  function scan() {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
    } catch {
      return; // dir may not exist yet (CLI never run) — keep polling
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const file = path.join(e.parentPath ?? e.path, e.name);
      if (!filter(file)) continue;
      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      const prev = known.get(file);
      if (!prev || prev.size !== stat.size || prev.mtimeMs !== stat.mtimeMs) {
        known.set(file, { size: stat.size, mtimeMs: stat.mtimeMs });
        onChange(file, stat);
      }
    }
  }

  scan();
  const interval = setInterval(scan, POLL_MS);
  interval.unref();

  let watcher = null;
  try {
    watcher = fs.watch(dir, { recursive: true }, () => scan());
  } catch {
    // recursive fs.watch unavailable — polling covers it
  }

  return () => {
    clearInterval(interval);
    if (watcher) watcher.close();
  };
}

module.exports = { tailRead, watchTree };
