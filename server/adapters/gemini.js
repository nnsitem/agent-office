'use strict';

// Gemini CLI adapter — STUB. Gemini has not been run on this machine yet, so
// the session format is unverified (expected: ~/.gemini/tmp/<hash>/ with
// logs.json + chats/). This stub watches the directory and logs when data
// appears so the real adapter can be written against it. See PLAN.md.

const os = require('os');
const path = require('path');
const { watchTree } = require('../watchutil');

const DIR = process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini', 'tmp');

function start(_emit) {
  let announced = false;
  watchTree(DIR, () => true, (file) => {
    if (announced) return;
    announced = true;
    console.log(`[gemini] session data appeared (${file}) — format unverified, adapter not yet implemented`);
  });
}

module.exports = { start };
