'use strict';

// Agent Office server: watches AI-CLI session files, normalizes agent state,
// serves it to the browser over SSE, plus static files for the frontend.

const http = require('http');
const fs = require('fs');
const path = require('path');
const state = require('./state');
const procs = require('./procs');

const PORT = Number(process.env.PORT) || 4321;
const WEB_DIR = path.join(__dirname, '..', 'web');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

const adapters = ['claude', 'kiro', 'gemini'];
for (const name of adapters) {
  try {
    require('./adapters/' + name).start(state.update);
    console.log(`[${name}] adapter started`);
  } catch (err) {
    console.error(`[${name}] adapter failed to start:`, err.message);
  }
}
procs.startPolling();
setInterval(() => state.tick(), 5000).unref();

// DEMO=1 populates the office with fake agents in every state — for
// development and for trying the dashboard without live sessions.
if (process.env.DEMO === '1') {
  const now = () => Date.now();
  const demo = () => {
    state.update({ id: 'demo:c1', source: 'claude', project: '/demo/orders-api', title: 'Fix flaky checkout tests', lastEventKind: 'tool_use', lastEventAt: now() - 5000, activity: 'Bash: npm test -- checkout' });
    state.update({ id: 'demo:c2', source: 'claude', project: '/demo/orders-api', title: 'Refactor cart service', lastEventKind: 'prompt', lastEventAt: now() - 8000, activity: 'refactor the cart service' });
    state.update({ id: 'demo:m1', source: 'claude', project: '/demo/orders-api', title: 'subagent: search codebase', isSubagent: true, lastEventKind: 'tool_use', lastEventAt: now() - 3000, activity: 'Grep: checkoutTotal' });
    state.update({ id: 'demo:k1', source: 'kiro', project: '/demo/farm-iot', title: 'MQTT reconnect logic', lastEventKind: 'tool_use', lastEventAt: now() - 45_000, activity: 'execute_bash: cargo build' });
    state.update({ id: 'demo:g1', source: 'gemini', project: '/demo/webshop', title: 'Add dark mode', lastEventKind: 'assistant', lastEventAt: now() - 4 * 60_000, activity: 'styles.css' });
    state.update({ id: 'demo:x1', source: 'codex', project: '/demo/etl-pipeline', title: 'Speed up ingestion', lastEventKind: 'tool_use', lastEventAt: now() - 6000, activity: 'shell: python bench.py' });
  };
  demo();
  setInterval(demo, 10_000).unref();
}

const sseClients = new Set();
state.subscribe((msg) => {
  const frame = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of sseClients) res.write(frame);
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/agents') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state.snapshot()));
    return;
  }

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'snapshot', agents: state.snapshot() })}\n\n`);
    sseClients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(ping);
      sseClients.delete(res);
    });
    return;
  }

  // static files
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.join(WEB_DIR, path.normalize(rel));
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Agent Office listening on http://localhost:${PORT}`);
});
