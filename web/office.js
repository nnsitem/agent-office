'use strict';

// Canvas renderer, Gather-town-flavoured: warm wood floors, per-room rugs
// and furniture, white name labels under avatars, selection ring. World is
// pixel art at 480x320 drawn at an integer 3x scale; text is drawn at full
// canvas resolution so it stays sharp.

(function () {
  const TILE = 16;
  const COLS = 30;
  const ROWS = 20;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const S = 3; // world -> canvas scale
  const GAP_HALF = 14;

  const C = {
    // floors
    plank: '#c9b083',
    plankAlt: '#c2a97c',
    plankLine: '#ae9569',
    stone: '#9aa0b2',
    stoneAlt: '#9298ab',
    stoneLine: '#848a9e',
    runner: '#a86a6a',
    runnerEdge: '#8f5757',
    // walls
    wallFace: '#5b6172',
    wallTop: '#3f4452',
    wallDark: '#2f3340',
    // furniture
    deskWood: '#a9743f',
    deskTop: '#c08a4e',
    deskEdge: '#8f5f33',
    laptop: '#2a2d38',
    screen: '#cfe8ff',
    mug: '#c25b4e',
    shelf: '#8a5a35',
    shelfDark: '#6f4628',
    board: '#f2f2ee',
    boardFrame: '#b8b8c0',
    mat: '#98865e',
    plantPot: '#8a5638',
    plantLeaf: '#4aa557',
    plantLeafHi: '#6cc177',
    // ui
    bubbleBg: '#ffffff',
    bubbleText: '#1f2028',
    plaqueBg: 'rgba(28,29,40,0.88)',
    plaqueText: '#e8e8f4',
    zText: '#5d6070',
  };

  // per-room rug accents (muted, gather-ish)
  const RUGS = [
    { fill: '#8fa8cf', edge: '#7690bb' },
    { fill: '#93bd8d', edge: '#7aa876' },
    { fill: '#cf9fb2', edge: '#bb879d' },
    { fill: '#cfb98f', edge: '#bba576' },
  ];

  const BUBBLE_FONT = '600 13px ui-monospace, Menlo, Consolas, monospace';
  const NAME_FONT = '700 11px system-ui, sans-serif';
  const PLAQUE_FONT = '700 12px ui-monospace, Menlo, Consolas, monospace';

  const STATUS_COLORS = {
    working: '#34c759',
    thinking: '#5aa9ff',
    waiting: '#ffb84d',
    idle: '#8e8ea3',
    gone: '#666',
  };

  function wallH(ctx, x1, x2, y, gapX) {
    const seg = (a, b) => {
      if (b <= a) return;
      ctx.fillStyle = C.wallFace;
      ctx.fillRect(a, y - 6, b - a, 10);
      ctx.fillStyle = C.wallTop;
      ctx.fillRect(a, y - 6, b - a, 4);
      ctx.fillStyle = C.wallDark;
      ctx.fillRect(a, y + 3, b - a, 1);
    };
    if (gapX == null) {
      seg(x1, x2);
    } else {
      seg(x1, gapX - GAP_HALF);
      seg(gapX + GAP_HALF, x2);
    }
  }

  function wallV(ctx, x, y1, y2) {
    ctx.fillStyle = C.wallFace;
    ctx.fillRect(x - 2, y1, 5, y2 - y1);
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(x + 2, y1, 1, y2 - y1);
  }

  function drawBookshelf(ctx, x, y) {
    ctx.fillStyle = C.shelf;
    ctx.fillRect(x, y - 10, TILE * 2, TILE + 10);
    ctx.fillStyle = C.shelfDark;
    ctx.fillRect(x, y + TILE - 3, TILE * 2, 3);
    const books = ['#c25b4e', '#5aa9ff', '#93bd8d', '#cfb98f', '#cf9fb2', '#7690bb'];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = books[(i + row * 2) % books.length];
        ctx.fillRect(x + 3 + i * 4, y - 7 + row * 11, 3, 8);
      }
      ctx.fillStyle = C.shelfDark;
      ctx.fillRect(x + 1, y + 2 + row * 11, TILE * 2 - 2, 2);
    }
  }

  function drawWhiteboard(ctx, x, wallY) {
    ctx.fillStyle = C.boardFrame;
    ctx.fillRect(x, wallY - 5, TILE * 2 + 4, 12);
    ctx.fillStyle = C.board;
    ctx.fillRect(x + 2, wallY - 3, TILE * 2, 8);
    ctx.fillStyle = '#c25b4e';
    ctx.fillRect(x + 5, wallY - 1, 8, 1);
    ctx.fillStyle = '#5aa9ff';
    ctx.fillRect(x + 5, wallY + 1, 14, 1);
    ctx.fillStyle = '#3f4452';
    ctx.fillRect(x + 5, wallY + 3, 11, 1);
  }

  function drawPlant(ctx, x, y) {
    ctx.fillStyle = C.plantPot;
    ctx.fillRect(x + 4, y + 8, 8, 6);
    ctx.fillStyle = '#734527';
    ctx.fillRect(x + 4, y + 12, 8, 2);
    ctx.fillStyle = C.plantLeaf;
    ctx.fillRect(x + 2, y, 12, 9);
    ctx.fillStyle = C.plantLeafHi;
    ctx.fillRect(x + 5, y + 2, 6, 4);
  }

  function drawDesk(ctx, d) {
    const x = d.tx * TILE - 8;
    const y = d.ty * TILE;
    ctx.fillStyle = C.deskWood;
    ctx.fillRect(x, y + 4, TILE * 2, TILE - 4);
    ctx.fillStyle = C.deskTop;
    ctx.fillRect(x, y, TILE * 2, 7);
    ctx.fillStyle = C.deskEdge;
    ctx.fillRect(x, y + TILE - 2, TILE * 2, 2);
    // laptop
    ctx.fillStyle = C.laptop;
    ctx.fillRect(x + 10, y - 6, 12, 9);
    ctx.fillStyle = C.screen;
    ctx.fillRect(x + 12, y - 4, 8, 5);
    // mug
    ctx.fillStyle = C.mug;
    ctx.fillRect(x + 26, y, 3, 4);
  }

  function drawMap(ctx, layout) {
    // wood plank floor
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        ctx.fillStyle = (tx * 7 + ty * 13) % 3 ? C.plank : C.plankAlt;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        ctx.fillStyle = C.plankLine;
        ctx.fillRect(tx * TILE, ty * TILE + TILE - 1, TILE, 1); // plank rows
        if ((tx + ty * 3) % 4 === 0) ctx.fillRect(tx * TILE, ty * TILE + 7, 1, 8); // seams
      }
    }

    // corridors: stone tile floor
    const stone = (x, y, w, h) => {
      for (let sy = y; sy < y + h; sy += 8) {
        for (let sx = x; sx < x + w; sx += 8) {
          ctx.fillStyle = ((sx + sy) / 8) % 2 ? C.stone : C.stoneAlt;
          ctx.fillRect(sx, sy, 8, 8);
        }
      }
      ctx.fillStyle = C.stoneLine;
      ctx.fillRect(x, y, w, 1);
    };
    stone(13 * TILE + 8, TILE * 2, TILE * 3, H - TILE * 2);
    stone(0, 9 * TILE + 8, W, TILE * 2 - 8);

    // runner rug down the vertical corridor
    ctx.fillStyle = C.runner;
    ctx.fillRect(14 * TILE - 2, TILE * 2 + 6, TILE + 20, H - TILE * 3);
    ctx.fillStyle = C.runnerEdge;
    ctx.fillRect(14 * TILE - 2, TILE * 2 + 6, 2, H - TILE * 3);
    ctx.fillRect(15 * TILE + 16, TILE * 2 + 6, 2, H - TILE * 3);

    // room rugs under desk clusters
    layout.rooms.forEach((r, i) => {
      const rug = RUGS[i % RUGS.length];
      const xs = r.desks.map((d) => d.tx * TILE);
      const ys = r.desks.map((d) => d.ty * TILE);
      const x = Math.min(...xs) - 20;
      const y = Math.min(...ys) - 6;
      const w = Math.max(...xs) - Math.min(...xs) + TILE + 32;
      const h = Math.max(...ys) - Math.min(...ys) + TILE * 2 + 12;
      ctx.fillStyle = rug.edge;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rug.fill;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = rug.edge;
      for (let px = x + 6; px < x + w - 6; px += 10) ctx.fillRect(px, y + 4, 4, 1); // pattern
    });

    // outer walls
    ctx.fillStyle = C.wallFace;
    ctx.fillRect(0, 0, W, TILE * 2);
    ctx.fillStyle = C.wallTop;
    ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(0, TILE * 2 - 2, W, 2);
    ctx.fillStyle = C.wallTop;
    ctx.fillRect(0, 0, 4, H);
    ctx.fillRect(W - 4, 0, 4, H);
    ctx.fillRect(0, H - 4, W, 4);

    // windows with sky
    for (const wx of [5, 12, 19, 26]) {
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(wx * TILE - 2, 10, TILE * 2, TILE + 2);
      ctx.fillStyle = '#7fb2d9';
      ctx.fillRect(wx * TILE, 12, TILE * 2 - 4, TILE - 2);
      ctx.fillStyle = '#a5cbe8';
      ctx.fillRect(wx * TILE, 12, TILE * 2 - 4, 5);
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(wx * TILE + TILE - 3, 12, 2, TILE - 2);
    }

    // door mat
    ctx.fillStyle = C.mat;
    ctx.fillRect(layout.door.x - 8, H - TILE, TILE * 2, TILE - 2);
    ctx.fillStyle = '#877753';
    ctx.fillRect(layout.door.x - 8, H - TILE, TILE * 2, 2);

    // rooms: free-standing walled boxes with a doorway gap on the
    // corridor-facing edge, plus decorations
    layout.rooms.forEach((r) => {
      const x1 = r.x1 * TILE;
      const x2 = r.x2 * TILE;
      const y1 = r.y1 * TILE;
      const y2 = r.y2 * TILE;
      wallH(ctx, x1 - 2, x2 + 2, y1, r.top ? null : r.gapX);
      wallH(ctx, x1 - 2, x2 + 2, y2, r.top ? r.gapX : null);
      wallV(ctx, x1, y1 - 6, y2 + 4);
      wallV(ctx, x2, y1 - 6, y2 + 4);
      if (r.top) {
        drawBookshelf(ctx, r.gapX - 16, y1 + TILE); // between the desk columns
      } else {
        drawWhiteboard(ctx, x1 + TILE, y1); // on the gapped wall, clear of the gap
      }
      for (const d of r.desks) drawDesk(ctx, d);
    });

    for (const [px, py] of [[0.9, 2.8], [28.2, 2.8], [0.9, 17.7], [28.2, 17.7], [12.4, 18], [16.7, 18]]) {
      drawPlant(ctx, px * TILE, py * TILE);
    }
  }

  // ---- high-res text helpers (canvas coordinates) ----

  function wrapByWidth(ctx, text, maxW, maxLines) {
    const words = String(text).split(' ');
    const lines = [''];
    for (const w of words) {
      const candidate = (lines[lines.length - 1] + ' ' + w).trim();
      if (ctx.measureText(candidate).width <= maxW || !lines[lines.length - 1]) {
        lines[lines.length - 1] = candidate;
      } else if (lines.length < maxLines) {
        lines.push(w);
      } else {
        let cut = lines[maxLines - 1];
        while (cut && ctx.measureText(cut + '…').width > maxW) cut = cut.slice(0, -1);
        lines[maxLines - 1] = cut + '…';
        return lines;
      }
    }
    return lines;
  }

  function drawBubble(ctx, cxW, topW, text) {
    const cx = cxW * S;
    const top = topW * S;
    ctx.font = BUBBLE_FONT;
    const lines = wrapByWidth(ctx, text, 230, 2);
    const lineH = 16;
    const padX = 9;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
    const h = lines.length * lineH + 10;
    let x = Math.round(cx - w / 2);
    x = Math.max(6, Math.min(W * S - w - 6, x));
    const y = Math.max(10, top - h - 12);
    ctx.fillStyle = 'rgba(31,32,40,0.18)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 3, w, h, 8);
    ctx.fill();
    ctx.fillStyle = C.bubbleBg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 5, y + h);
    ctx.lineTo(cx + 5, y + h);
    ctx.lineTo(cx, y + h + 7);
    ctx.fill();
    ctx.fillStyle = C.bubbleText;
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + padX, y + 6 + i * lineH));
    ctx.textBaseline = 'alphabetic';
  }

  function drawPlaque(ctx, room, label) {
    ctx.font = PLAQUE_FONT;
    const text = label.toUpperCase();
    const w = ctx.measureText(text).width + 16;
    const x = (room.x1 * TILE + 4) * S;
    const y = (room.y1 * TILE + (room.top ? 3 : 6)) * S;
    ctx.fillStyle = C.plaqueBg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 20, 5);
    ctx.fill();
    ctx.fillStyle = C.plaqueText;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 8, y + 11);
    ctx.textBaseline = 'alphabetic';
  }

  // Gather-style name label: white with dark outline, centered under avatar.
  function drawName(ctx, cxW, yW, text, statusColor) {
    ctx.font = NAME_FONT;
    const tw = ctx.measureText(text).width;
    const x = Math.round(cxW * S - tw / 2);
    const y = Math.round(yW * S + 12);
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,20,28,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(x - 7, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function spriteBox(c) {
    return c.agent.isSubagent
      ? { x: c.x + 4, y: c.y + 8, w: 8, h: 8 }
      : { x: c.x, y: c.y, w: 16, h: 16 };
  }

  function shortName(agent) {
    const t = (agent.title || agent.source).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      || agent.source;
    return t.length > 16 ? t.slice(0, 15) + '…' : t;
  }

  class Office {
    constructor(canvas, sim) {
      this.canvas = canvas;
      this.sim = sim;
      this.selectedId = null;
      canvas.width = W * S;
      canvas.height = H * S;
      this.ctx = canvas.getContext('2d');
      this.sprites = window.Sprites.buildSprites();
      this.bg = document.createElement('canvas');
      this.bg.width = W;
      this.bg.height = H;
      drawMap(this.bg.getContext('2d'), window.Sim.LAYOUT);
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    hitTest(canvasX, canvasY) {
      const x = canvasX / S;
      const y = canvasY / S;
      const chars = [...this.sim.chars.values()].sort((a, b) => b.y - a.y);
      for (const c of chars) {
        const b = spriteBox(c);
        if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return c;
      }
      return null;
    }

    loop(t) {
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.sim.update(dt);
      this.draw();
      requestAnimationFrame((tt) => this.loop(tt));
    }

    draw() {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.bg, 0, 0, W, H, 0, 0, W * S, H * S);

      const labels = this.sim.roomLabels();
      window.Sim.LAYOUT.rooms.forEach((r, i) => {
        if (labels[i]) drawPlaque(ctx, r, labels[i]);
      });

      const chars = [...this.sim.chars.values()].sort((a, b) => a.y - b.y);
      for (const c of chars) {
        const set = this.sprites[c.agent.source] || this.sprites.claude;
        const y = Math.round(c.y + c.bob());
        const x = Math.round(c.x);
        const b = spriteBox(c);

        // selection ring under feet
        if (c.id === this.selectedId) {
          ctx.save();
          ctx.scale(S, S);
          ctx.fillStyle = 'rgba(255,214,74,0.45)';
          ctx.beginPath();
          ctx.ellipse(b.x + b.w / 2, b.y + b.h - 1, b.w / 2 + 3, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffd64a';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        if (c.agent.isSubagent) {
          ctx.translate((x + 4) * S, (y + 8) * S);
          ctx.scale(S, S);
          ctx.drawImage(set.mini, 0, 0);
        } else {
          const img = set[c.frame()] || set.stand;
          if (c.facing === -1) {
            ctx.translate((x + TILE) * S, y * S);
            ctx.scale(-S, S);
          } else {
            ctx.translate(x * S, y * S);
            ctx.scale(S, S);
          }
          ctx.drawImage(img, 0, 0);
        }
        ctx.restore();

        if (!c.walking && !c.agent.isSubagent) {
          drawName(ctx, x + TILE / 2, y + TILE, shortName(c.agent),
            STATUS_COLORS[c.agent.status] || '#888');
        }
      }

      for (const c of chars) {
        if (c.walking) continue;
        const b = spriteBox(c);
        const cx = b.x + b.w / 2;
        const top = b.y + c.bob();
        const st = c.agent.status;
        const stagger = (Math.floor(c.x / TILE) % 2) * 15;
        if (st === 'working' && c.agent.activity) {
          if (!c.agent.isSubagent) drawBubble(ctx, cx, top - stagger, c.agent.activity);
        } else if (st === 'thinking') {
          drawBubble(ctx, cx, top - stagger, '·'.repeat(1 + (Math.floor(c.animT * 2) % 3)));
        } else if (st === 'waiting') {
          ctx.font = '800 26px ui-monospace, monospace';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#181820';
          ctx.fillStyle = '#ffb84d';
          const ix = Math.round(cx * S - 4);
          const iy = Math.round(top * S - 8);
          ctx.strokeText('!', ix, iy);
          ctx.fillText('!', ix, iy);
        } else if (st === 'idle') {
          ctx.font = '700 13px ui-monospace, monospace';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.fillStyle = C.zText;
          const zz = Math.floor(c.animT) % 2 ? 'z Z' : 'Z z';
          const zx = (cx + 4) * S;
          const zy = (top - 2 - Math.sin(c.animT) * 2) * S;
          ctx.strokeText(zz, zx, zy);
          ctx.fillText(zz, zx, zy);
        }
      }
    }
  }

  window.Office = { Office, STATUS_COLORS };
})();
