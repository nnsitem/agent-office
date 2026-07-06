'use strict';

// Coarse per-source liveness: is any process for this CLI running at all?
// Per-session PID mapping isn't derivable from transcripts, so a dead CLI
// marks all of its sessions gone; a live one defers to event staleness.

const fs = require('fs');
const { execFile } = require('child_process');

// Inside Docker, ps only sees the container's own processes, so host CLI
// liveness is unknowable — disable the check and rely on event staleness.
const PROC_CHECK_DISABLED =
  process.env.DISABLE_PROC_CHECK === '1' || fs.existsSync('/.dockerenv');

const PATTERNS = {
  claude: /(^|\/)claude( |$)/,
  kiro: /(^|\/)kiro(-cli)?( |$)/,
  gemini: /(^|\/)gemini( |$)/,
  codex: /(^|\/)codex( |$)/,
};

// Start optimistic so a slow first ps poll doesn't flash everything as gone.
const alive = { claude: true, kiro: true, gemini: true, codex: true };

function poll() {
  execFile('ps', ['-axo', 'command'], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
    if (err) return; // keep last known state
    for (const [source, re] of Object.entries(PATTERNS)) {
      alive[source] = stdout.split('\n').some((line) => re.test(line));
    }
  });
}

function startPolling(intervalMs = 3000) {
  if (PROC_CHECK_DISABLED) {
    console.log('[procs] process liveness check disabled (Docker or DISABLE_PROC_CHECK=1)');
    return;
  }
  poll();
  setInterval(poll, intervalMs).unref();
}

function isSourceAlive(source) {
  if (PROC_CHECK_DISABLED) return true;
  return alive[source] !== false;
}

module.exports = { startPolling, isSourceAlive };
