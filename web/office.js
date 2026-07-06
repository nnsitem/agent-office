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
    plankHi: '#d4be92',
    plankLine: '#ae9569',
    plankKnot: '#9e7f54',
    stone: '#9aa0b2',
    stoneAlt: '#9298ab',
    stoneLine: '#848a9e',
    stoneHi: '#a8aec0',
    runner: '#a86a6a',
    runnerEdge: '#8f5757',
    runnerPattern: '#944e4e',
    // walls
    wallFace: '#5b6172',
    wallTop: '#3f4452',
    wallDark: '#2f3340',
    wallBrick: '#525868',
    // furniture
    deskWood: '#a9743f',
    deskTop: '#c08a4e',
    deskEdge: '#8f5f33',
    deskLeg: '#7a5030',
    deskShadow: 'rgba(20,20,30,0.18)',
    laptop: '#2a2d38',
    screen: '#cfe8ff',
    screenGlow: 'rgba(180,220,255,0.15)',
    mug: '#c25b4e',
    mugHi: '#d4756a',
    chair: '#3a3d4a',
    chairSeat: '#4a4d5a',
    shelf: '#8a5a35',
    shelfDark: '#6f4628',
    board: '#f2f2ee',
    boardFrame: '#b8b8c0',
    boardShadow: 'rgba(0,0,0,0.1)',
    mat: '#98865e',
    plantPot: '#8a5638',
    plantPotHi: '#a06840',
    plantLeaf: '#4aa557',
    plantLeafHi: '#6cc177',
    plantLeafDark: '#38874a',
    // decorations
    clock: '#e8e8f0',
    clockFace: '#ffffff',
    clockHand: '#2f3340',
    waterCooler: '#a8d4e8',
    waterCoolerBody: '#d8e8f0',
    corkboard: '#c4956a',
    corkPin: '#e04040',
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
      // Wall shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(a + 1, y + 4, b - a, 3);
      // Main wall body
      ctx.fillStyle = C.wallFace;
      ctx.fillRect(a, y - 7, b - a, 12);
      // Top cap
      ctx.fillStyle = C.wallTop;
      ctx.fillRect(a, y - 7, b - a, 4);
      // Bottom edge
      ctx.fillStyle = C.wallDark;
      ctx.fillRect(a, y + 4, b - a, 1);
      // Brick pattern
      for (let bx = a + 2; bx < b - 2; bx += 10) {
        ctx.fillStyle = C.wallBrick;
        ctx.fillRect(bx, y - 2, 8, 4);
      }
    };
    if (gapX == null) {
      seg(x1, x2);
    } else {
      seg(x1, gapX - GAP_HALF);
      seg(gapX + GAP_HALF, x2);
    }
  }

  function wallV(ctx, x, y1, y2) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x + 3, y1, 3, y2 - y1);
    // Main body
    ctx.fillStyle = C.wallFace;
    ctx.fillRect(x - 2, y1, 6, y2 - y1);
    // Dark edge
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(x + 3, y1, 1, y2 - y1);
    // Highlight
    ctx.fillStyle = C.wallTop;
    ctx.fillRect(x - 2, y1, 1, y2 - y1);
  }

  function drawBookshelf(ctx, x, y) {
    // Shadow
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(x + 2, y + TILE + 8, TILE * 2, 3);
    // Shelf frame
    ctx.fillStyle = C.shelf;
    ctx.fillRect(x, y - 10, TILE * 2, TILE + 10);
    ctx.fillStyle = C.shelfDark;
    ctx.fillRect(x, y + TILE - 3, TILE * 2, 3);
    // Frame edges
    ctx.fillStyle = '#9a6a40';
    ctx.fillRect(x, y - 10, 2, TILE + 10);
    ctx.fillRect(x + TILE * 2 - 2, y - 10, 2, TILE + 10);
    // Books with varied heights and colors
    const books = ['#c25b4e', '#5aa9ff', '#93bd8d', '#cfb98f', '#cf9fb2', '#7690bb', '#e8a84c', '#8b6fc0'];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 7; i++) {
        const bookH = 6 + (i * 3 + row * 5) % 3;
        ctx.fillStyle = books[(i + row * 3) % books.length];
        ctx.fillRect(x + 3 + i * 4, y - 7 + row * 11 + (8 - bookH), 3, bookH);
        // Spine highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 3 + i * 4, y - 7 + row * 11 + (8 - bookH), 1, bookH);
      }
      // Shelf divider
      ctx.fillStyle = C.shelfDark;
      ctx.fillRect(x + 1, y + 2 + row * 11, TILE * 2 - 2, 2);
      ctx.fillStyle = '#9a6a40';
      ctx.fillRect(x + 1, y + 1 + row * 11, TILE * 2 - 2, 1);
    }
  }

  function drawWhiteboard(ctx, x, wallY) {
    // Shadow
    ctx.fillStyle = C.boardShadow;
    ctx.fillRect(x + 2, wallY - 3, TILE * 2 + 4, 14);
    // Frame
    ctx.fillStyle = C.boardFrame;
    ctx.fillRect(x - 1, wallY - 6, TILE * 2 + 6, 15);
    ctx.fillStyle = C.board;
    ctx.fillRect(x + 1, wallY - 4, TILE * 2 + 2, 11);
    // Content - diagrams and text lines
    ctx.fillStyle = '#c25b4e';
    ctx.fillRect(x + 4, wallY - 2, 8, 1);
    ctx.fillRect(x + 4, wallY - 1, 1, 4);
    ctx.fillStyle = '#5aa9ff';
    ctx.fillRect(x + 8, wallY + 1, 14, 1);
    ctx.fillRect(x + 4, wallY + 3, 11, 1);
    ctx.fillStyle = '#4aa557';
    ctx.fillRect(x + 18, wallY - 2, 6, 4);
    // Magnets
    ctx.fillStyle = '#e04040';
    ctx.fillRect(x + 3, wallY - 3, 2, 2);
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(x + TILE * 2, wallY - 3, 2, 2);
    // Marker tray
    ctx.fillStyle = '#8a8a9a';
    ctx.fillRect(x + 4, wallY + 7, TILE + 8, 2);
  }

  function drawPlant(ctx, x, y) {
    // Pot with rim and shadow
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(x + 3, y + 13, 10, 2);
    ctx.fillStyle = C.plantPot;
    ctx.fillRect(x + 4, y + 8, 8, 6);
    ctx.fillStyle = C.plantPotHi;
    ctx.fillRect(x + 4, y + 8, 8, 2);
    ctx.fillStyle = '#734527';
    ctx.fillRect(x + 3, y + 7, 10, 2);
    // Soil
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(x + 5, y + 7, 6, 1);
    // Multi-layered leaves
    ctx.fillStyle = C.plantLeafDark;
    ctx.fillRect(x + 1, y + 1, 14, 7);
    ctx.fillStyle = C.plantLeaf;
    ctx.fillRect(x + 2, y, 12, 7);
    ctx.fillStyle = C.plantLeafHi;
    ctx.fillRect(x + 4, y + 1, 3, 4);
    ctx.fillRect(x + 9, y + 2, 3, 3);
    // Leaf tips
    ctx.fillStyle = C.plantLeaf;
    ctx.fillRect(x + 1, y - 1, 2, 2);
    ctx.fillRect(x + 12, y - 1, 2, 2);
    ctx.fillRect(x + 6, y - 2, 3, 2);
  }

  // ---- per-room furniture: each room gets one distinctive piece ----

  function drawSofa(ctx, x, y, accent) {
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(x + 2, y + 12, 32, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 32, 12); // body
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 2, y + 2, 13, 5); // cushions
    ctx.fillRect(x + 17, y + 2, 13, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + 10, 32, 2); // base shade
    ctx.fillRect(x - 2, y, 3, 12);  // arms
    ctx.fillRect(x + 31, y, 3, 12);
  }

  function drawCabinets(ctx, x, y) {
    for (let k = 0; k < 2; k++) {
      const cx = x + k * 16;
      ctx.fillStyle = C.deskShadow;
      ctx.fillRect(cx + 1, y + 17, 13, 2);
      ctx.fillStyle = '#7a8194';
      ctx.fillRect(cx, y, 13, 18);
      ctx.fillStyle = '#8f96aa';
      ctx.fillRect(cx, y, 13, 3);
      ctx.fillStyle = '#525868';
      for (let dr = 0; dr < 3; dr++) {
        ctx.fillRect(cx + 2, y + 4 + dr * 5, 9, 1);
        ctx.fillRect(cx + 5, y + 6 + dr * 5, 3, 1); // handle
      }
    }
  }

  function drawFloorLamp(ctx, x, y) {
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(x - 3, y + 20, 12, 2);
    ctx.fillStyle = '#3a3d4a';
    ctx.fillRect(x + 2, y, 2, 20);      // pole
    ctx.fillRect(x - 2, y + 19, 10, 2); // base
    ctx.fillStyle = '#ffd98f';
    ctx.fillRect(x - 3, y - 8, 12, 9);  // shade
    ctx.fillStyle = '#e8b96a';
    ctx.fillRect(x - 3, y - 8, 12, 2);
  }

  function drawServerRack(ctx, x, y) {
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(x + 2, y + 26, 18, 3);
    ctx.fillStyle = '#23252f';
    ctx.fillRect(x, y, 18, 27);
    ctx.fillStyle = '#31343f';
    ctx.fillRect(x, y, 18, 3);
    for (let u = 0; u < 5; u++) {
      ctx.fillStyle = '#161821';
      ctx.fillRect(x + 2, y + 5 + u * 4, 14, 3);
      ctx.fillStyle = u % 2 ? '#7ee08a' : '#ffb84d'; // status LEDs
      ctx.fillRect(x + 13, y + 6 + u * 4, 2, 1);
      ctx.fillStyle = '#5aa9ff';
      ctx.fillRect(x + 3, y + 6 + u * 4, 1, 1);
    }
  }

  function drawPoster(ctx, x, y, accent) {
    ctx.fillStyle = C.boardShadow;
    ctx.fillRect(x + 1, y + 1, 12, 15);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(x, y, 12, 15);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 2, y + 2, 8, 7);
    ctx.fillStyle = '#8a8a9a';
    ctx.fillRect(x + 2, y + 11, 8, 1);
    ctx.fillRect(x + 2, y + 13, 5, 1);
  }

  function drawCoffeeStation(ctx, x, y) {
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(x + 2, y + 14, 24, 3);
    ctx.fillStyle = C.deskWood;
    ctx.fillRect(x, y + 6, 24, 9);  // table
    ctx.fillStyle = C.deskTop;
    ctx.fillRect(x, y + 4, 24, 4);
    ctx.fillStyle = '#2a2d38';
    ctx.fillRect(x + 3, y - 6, 10, 11); // machine
    ctx.fillStyle = '#c25b4e';
    ctx.fillRect(x + 5, y - 4, 6, 3);   // button panel
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(x + 16, y, 4, 4);      // cup
    ctx.fillStyle = '#8a5a35';
    ctx.fillRect(x + 17, y + 1, 2, 1);
  }

  function drawDesk(ctx, d) {
    const x = d.tx * TILE - 8;
    const y = d.ty * TILE;
    // Desk shadow
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(x + 2, y + TILE, TILE * 2, 3);
    // Desk legs
    ctx.fillStyle = C.deskLeg;
    ctx.fillRect(x + 2, y + 6, 2, TILE - 6);
    ctx.fillRect(x + TILE * 2 - 4, y + 6, 2, TILE - 6);
    // Desk body
    ctx.fillStyle = C.deskWood;
    ctx.fillRect(x, y + 4, TILE * 2, TILE - 4);
    ctx.fillStyle = C.deskTop;
    ctx.fillRect(x, y, TILE * 2, 6);
    ctx.fillStyle = C.deskEdge;
    ctx.fillRect(x, y + TILE - 2, TILE * 2, 2);
    // Wood grain detail
    ctx.fillStyle = C.plankKnot;
    ctx.fillRect(x + 8, y + 7, 6, 1);
    ctx.fillRect(x + 4, y + 10, 8, 1);
    // Laptop with screen glow
    ctx.fillStyle = C.laptop;
    ctx.fillRect(x + 9, y - 7, 14, 10);
    ctx.fillStyle = '#1e2028';
    ctx.fillRect(x + 9, y + 2, 14, 1); // hinge
    ctx.fillStyle = C.screen;
    ctx.fillRect(x + 11, y - 5, 10, 6);
    // Screen content lines
    ctx.fillStyle = 'rgba(100,180,255,0.4)';
    ctx.fillRect(x + 12, y - 4, 6, 1);
    ctx.fillRect(x + 12, y - 2, 8, 1);
    ctx.fillRect(x + 12, y, 5, 1);
    // Mug with highlight
    ctx.fillStyle = C.mug;
    ctx.fillRect(x + 2, y + 1, 4, 5);
    ctx.fillStyle = C.mugHi;
    ctx.fillRect(x + 2, y + 1, 4, 1);
    // Mug handle
    ctx.fillStyle = C.mug;
    ctx.fillRect(x + 6, y + 2, 1, 3);
    // Chair behind desk
    ctx.fillStyle = C.chair;
    ctx.fillRect(x + 10, y + TILE + 1, 12, 8);
    ctx.fillStyle = C.chairSeat;
    ctx.fillRect(x + 10, y + TILE + 1, 12, 3);
    ctx.fillStyle = C.chair;
    ctx.fillRect(x + 11, y + TILE + 9, 2, 3);
    ctx.fillRect(x + 19, y + TILE + 9, 2, 3);
  }

  function drawMap(ctx, layout) {
    // wood plank floor with grain detail
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        ctx.fillStyle = (tx * 7 + ty * 13) % 3 ? C.plank : C.plankAlt;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        // Plank highlight (top edge)
        if ((tx + ty) % 5 === 0) {
          ctx.fillStyle = C.plankHi;
          ctx.fillRect(tx * TILE, ty * TILE, TILE, 1);
        }
        ctx.fillStyle = C.plankLine;
        ctx.fillRect(tx * TILE, ty * TILE + TILE - 1, TILE, 1); // plank rows
        // Seams with varied spacing
        if ((tx + ty * 3) % 4 === 0) ctx.fillRect(tx * TILE, ty * TILE + 7, 1, 8);
        // Wood knots
        if ((tx * 11 + ty * 7) % 17 === 0) {
          ctx.fillStyle = C.plankKnot;
          ctx.fillRect(tx * TILE + 6, ty * TILE + 5, 3, 3);
          ctx.fillRect(tx * TILE + 7, ty * TILE + 4, 1, 5);
        }
      }
    }

    // corridors: stone tile floor with grout and highlights
    const stone = (x, y, w, h) => {
      for (let sy = y; sy < y + h; sy += 8) {
        for (let sx = x; sx < x + w; sx += 8) {
          const offset = (Math.floor(sy / 8) % 2) * 4; // brick pattern offset
          ctx.fillStyle = ((sx + sy) / 8) % 2 ? C.stone : C.stoneAlt;
          ctx.fillRect(sx, sy, 8, 8);
          // Highlight on top-left of each tile
          ctx.fillStyle = C.stoneHi;
          ctx.fillRect(sx, sy, 8, 1);
          ctx.fillRect(sx, sy, 1, 8);
          // Grout lines
          ctx.fillStyle = C.stoneLine;
          ctx.fillRect(sx + 7, sy, 1, 8);
          ctx.fillRect(sx, sy + 7, 8, 1);
        }
      }
      // Border shadows
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, h);
    };
    stone(13 * TILE + 8, TILE * 2, TILE * 3, H - TILE * 2);
    stone(0, 9 * TILE + 8, W, TILE * 2 - 8);

    // runner rug down the vertical corridor with diamond pattern
    const rx = 14 * TILE - 2;
    const rw = TILE + 20;
    const rh = H - TILE * 3;
    ctx.fillStyle = C.runner;
    ctx.fillRect(rx, TILE * 2 + 6, rw, rh);
    ctx.fillStyle = C.runnerEdge;
    ctx.fillRect(rx, TILE * 2 + 6, 2, rh);
    ctx.fillRect(rx + rw - 2, TILE * 2 + 6, 2, rh);
    // Diamond pattern
    ctx.fillStyle = C.runnerPattern;
    for (let dy = TILE * 2 + 14; dy < H - TILE; dy += 20) {
      const cx = rx + rw / 2;
      ctx.fillRect(cx - 4, dy, 8, 2);
      ctx.fillRect(cx - 6, dy + 2, 12, 2);
      ctx.fillRect(cx - 8, dy + 4, 16, 2);
      ctx.fillRect(cx - 6, dy + 6, 12, 2);
      ctx.fillRect(cx - 4, dy + 8, 8, 2);
    }
    // Fringe at edges
    ctx.fillStyle = '#c47a5a';
    for (let fy = TILE * 2 + 8; fy < H - TILE; fy += 6) {
      ctx.fillRect(rx + 3, fy, 1, 3);
      ctx.fillRect(rx + rw - 4, fy, 1, 3);
    }

    // room rugs under desk clusters with border pattern
    layout.rooms.forEach((r, i) => {
      const rug = RUGS[i % RUGS.length];
      const xs = r.desks.map((d) => d.tx * TILE);
      const ys = r.desks.map((d) => d.ty * TILE);
      const x = Math.min(...xs) - 20;
      const y = Math.min(...ys) - 6;
      const w = Math.max(...xs) - Math.min(...xs) + TILE + 32;
      const h = Math.max(...ys) - Math.min(...ys) + TILE * 2 + 12;
      // Rug shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(x + 2, y + 2, w, h);
      // Main rug
      ctx.fillStyle = rug.edge;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rug.fill;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      // Inner border
      ctx.fillStyle = rug.edge;
      ctx.fillRect(x + 6, y + 6, w - 12, 1);
      ctx.fillRect(x + 6, y + h - 7, w - 12, 1);
      ctx.fillRect(x + 6, y + 6, 1, h - 12);
      ctx.fillRect(x + w - 7, y + 6, 1, h - 12);
      // Per-room rug pattern so each room reads differently at a glance
      if (i === 0) { // diagonal dashes
        for (let py = y + 9; py < y + h - 9; py += 7) {
          for (let px = x + 10 + (py % 14 ? 4 : 0); px < x + w - 10; px += 12) {
            ctx.fillRect(px, py, 4, 1);
          }
        }
      } else if (i === 1) { // horizontal stripes
        for (let py = y + 10; py < y + h - 10; py += 8) {
          ctx.fillRect(x + 8, py, w - 16, 1);
        }
      } else if (i === 2) { // diamond dots
        for (let py = y + 9; py < y + h - 9; py += 8) {
          for (let px = x + 10 + ((py - y) % 16 ? 4 : 0); px < x + w - 10; px += 9) {
            ctx.fillRect(px, py, 2, 2);
          }
        }
      } else { // checker corners
        for (let py = y + 8; py < y + h - 8; py += 10) {
          for (let px = x + 10; px < x + w - 10; px += 14) {
            ctx.fillRect(px, py, 5, 3);
          }
        }
      }
      // Top/bottom decorative dots
      for (let px = x + 10; px < x + w - 10; px += 8) {
        ctx.fillRect(px, y + 4, 3, 1);
        ctx.fillRect(px, y + h - 5, 3, 1);
      }
      // Corner accents
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + w - 6, y + 4, 2, 2);
      ctx.fillRect(x + 4, y + h - 6, 2, 2);
      ctx.fillRect(x + w - 6, y + h - 6, 2, 2);
    });

    // outer walls with brick detail
    ctx.fillStyle = C.wallFace;
    ctx.fillRect(0, 0, W, TILE * 2);
    // Brick pattern on walls
    for (let by = 4; by < TILE * 2 - 4; by += 6) {
      const offset = (Math.floor(by / 6) % 2) * 8;
      for (let bx = offset; bx < W; bx += 16) {
        ctx.fillStyle = C.wallBrick;
        ctx.fillRect(bx, by, 14, 5);
        ctx.fillStyle = C.wallFace;
        ctx.fillRect(bx, by + 4, 14, 1);
      }
    }
    ctx.fillStyle = C.wallTop;
    ctx.fillRect(0, 0, W, 6);
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(0, TILE * 2 - 2, W, 3);
    // Baseboard
    ctx.fillStyle = '#4a4f5e';
    ctx.fillRect(0, TILE * 2 - 5, W, 3);
    // Side and bottom walls
    ctx.fillStyle = C.wallTop;
    ctx.fillRect(0, 0, 5, H);
    ctx.fillRect(W - 5, 0, 5, H);
    ctx.fillRect(0, H - 5, W, 5);
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(4, 0, 1, H);
    ctx.fillRect(W - 5, 0, 1, H);

    // windows with sky, frame detail and curtains
    for (const wx of [5, 12, 19, 26]) {
      const winX = wx * TILE - 2;
      // Window shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(winX + 2, 12, TILE * 2 + 2, TILE);
      // Frame
      ctx.fillStyle = '#d8d8e4';
      ctx.fillRect(winX - 1, 8, TILE * 2 + 4, TILE + 6);
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(winX, 9, TILE * 2 + 2, TILE + 4);
      // Sky gradient
      ctx.fillStyle = '#5a9cc8';
      ctx.fillRect(winX + 2, 11, TILE * 2 - 2, TILE);
      ctx.fillStyle = '#7fb2d9';
      ctx.fillRect(winX + 2, 11, TILE * 2 - 2, 6);
      ctx.fillStyle = '#a5cbe8';
      ctx.fillRect(winX + 2, 11, TILE * 2 - 2, 3);
      // Window divider cross
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(winX + TILE - 1, 11, 3, TILE);
      ctx.fillRect(winX + 2, 11 + TILE / 2 - 1, TILE * 2 - 2, 2);
      // Tiny curtain accents on sides
      ctx.fillStyle = 'rgba(180,160,140,0.6)';
      ctx.fillRect(winX + 1, 11, 2, TILE);
      ctx.fillRect(winX + TILE * 2 - 1, 11, 2, TILE);
      // Window sill
      ctx.fillStyle = '#c8c8d4';
      ctx.fillRect(winX - 1, TILE + 11, TILE * 2 + 4, 3);
    }

    // door mat with welcome pattern
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(layout.door.x - 7, H - TILE + 1, TILE * 2 + 2, TILE - 2);
    ctx.fillStyle = C.mat;
    ctx.fillRect(layout.door.x - 8, H - TILE, TILE * 2, TILE - 2);
    ctx.fillStyle = '#877753';
    ctx.fillRect(layout.door.x - 8, H - TILE, TILE * 2, 2);
    ctx.fillStyle = '#a89868';
    ctx.fillRect(layout.door.x - 4, H - TILE + 4, TILE + 8, TILE - 8);
    // Welcome stripe pattern
    ctx.fillStyle = '#7a6844';
    for (let sx = layout.door.x - 6; sx < layout.door.x + TILE + 6; sx += 4) {
      ctx.fillRect(sx, H - TILE + 3, 2, 1);
      ctx.fillRect(sx, H - 5, 2, 1);
    }

    // rooms: free-standing walled boxes with a doorway gap on the
    // corridor-facing edge, plus decorations
    layout.rooms.forEach((r, i) => {
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
      // a poster on the wall, tinted with the room's rug accent
      const accent = RUGS[i % RUGS.length].fill;
      drawPoster(ctx, i === 1 ? x1 + 10 : x2 - 22, y1 + 8, accent);
      // one distinctive furniture piece per room, on floor the walk paths
      // never cross (top strip for top rooms, bottom strip for bottom rooms)
      if (i === 0) drawSofa(ctx, x1 + 10, y1 + 12, RUGS[0].edge);
      else if (i === 1) drawCabinets(ctx, x2 - 48, y1 + 6);
      else if (i === 2) drawFloorLamp(ctx, x1 + 12, y2 - 30);
      else drawServerRack(ctx, x2 - 26, y2 - 36);
      for (const d of r.desks) drawDesk(ctx, d);
    });

    // coffee corner by the door instead of a second door plant
    drawCoffeeStation(ctx, 17 * TILE, 18 * TILE);
    for (const [px, py] of [[0.9, 2.8], [28.2, 2.8], [0.9, 17.7], [28.2, 17.7], [12.4, 18]]) {
      drawPlant(ctx, px * TILE, py * TILE);
    }

    // Water cooler in corridor
    const wcx = 13 * TILE + 12;
    const wcy = 12 * TILE;
    ctx.fillStyle = C.deskShadow;
    ctx.fillRect(wcx + 1, wcy + 14, 8, 2);
    ctx.fillStyle = '#888';
    ctx.fillRect(wcx + 2, wcy + 10, 6, 5); // base
    ctx.fillStyle = C.waterCoolerBody;
    ctx.fillRect(wcx + 1, wcy + 2, 8, 9); // body
    ctx.fillStyle = C.waterCooler;
    ctx.fillRect(wcx + 2, wcy, 6, 4); // water jug
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(wcx + 3, wcy + 1, 2, 2); // highlight
    ctx.fillStyle = '#e04040';
    ctx.fillRect(wcx, wcy + 5, 2, 2); // hot tap
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(wcx + 8, wcy + 5, 2, 2); // cold tap

    // Wall clocks in rooms
    const clockPositions = [[6 * TILE, TILE * 2 + 4], [22 * TILE, TILE * 2 + 4]];
    for (const [cx, cy] of clockPositions) {
      ctx.fillStyle = C.clock;
      ctx.fillRect(cx, cy, 8, 8);
      ctx.fillStyle = C.clockFace;
      ctx.fillRect(cx + 1, cy + 1, 6, 6);
      ctx.fillStyle = C.clockHand;
      ctx.fillRect(cx + 4, cy + 2, 1, 3); // hour hand
      ctx.fillRect(cx + 4, cy + 4, 2, 1); // minute hand
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

  // ---- weather outside the windows ----

  function timePhaseLocal() {
    const hour = (window.AO_FORCE_HOUR != null)
      ? Number(window.AO_FORCE_HOUR)
      : new Date().getHours() + new Date().getMinutes() / 60;
    if (hour >= 6 && hour < 9) return 'morning';
    if (hour >= 9 && hour < 16) return 'day';
    if (hour >= 16 && hour < 20) return 'evening';
    return 'night';
  }

  // Deterministic fake weather that changes every ~2 hours. ?weather= forces.
  function weatherNow() {
    if (window.AO_FORCE_WEATHER) return window.AO_FORCE_WEATHER;
    const d = new Date();
    const seed = d.getFullYear() * 4000 + (d.getMonth() + 1) * 310 + d.getDate() * 12 + Math.floor(d.getHours() / 2);
    const x = ((seed * 2654435761) >>> 0) % 100;
    return x < 45 ? 'clear' : x < 75 ? 'cloudy' : 'rain';
  }

  const WINDOW_XS = [5 * TILE, 12 * TILE, 19 * TILE, 26 * TILE];
  const STARS = [[3, 3], [9, 2], [15, 5], [22, 3], [25, 7], [6, 8], [18, 9], [12, 6]];

  const SKY = {
    morning: ['#f4b98a', '#a5cbe8'],
    day: ['#7fb2d9', '#a5cbe8'],
    evening: ['#e8895a', '#b06a92'],
    night: ['#0e1830', '#1a2745'],
  };

  function drawWindowScenes(ctx, t) {
    const phase = timePhaseLocal();
    const weather = weatherNow();
    const night = phase === 'night';
    let [top, bottom] = SKY[phase];
    if (!night && weather !== 'clear') { top = '#8a94a8'; bottom = '#a8b0c0'; }
    if (!night && weather === 'rain') { top = '#6e7890'; bottom = '#8a94a8'; }

    WINDOW_XS.forEach((x, idx) => {
      const y = 12, w = 28, h = 14;
      ctx.fillStyle = top;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = bottom;
      ctx.fillRect(x, y + 8, w, h - 8);

      if (night) {
        for (let s = 0; s < STARS.length; s++) {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s * 2 + idx));
          ctx.fillStyle = `rgba(232,238,255,${tw.toFixed(2)})`;
          ctx.fillRect(x + (STARS[s][0] + idx * 5) % (w - 2), y + STARS[s][1], 1, 1);
        }
        if (idx === 1 && weather !== 'rain') { // moon in one window
          ctx.fillStyle = '#e8e8d8';
          ctx.fillRect(x + 19, y + 2, 5, 5);
          ctx.fillStyle = '#c8c8b8';
          ctx.fillRect(x + 20, y + 4, 2, 2);
        }
      } else if (weather === 'clear' && idx === 2 && phase !== 'evening') {
        ctx.fillStyle = '#ffe08a'; // sun in one window
        ctx.fillRect(x + 20, y + 2, 5, 5);
        ctx.fillStyle = '#fff0b8';
        ctx.fillRect(x + 21, y + 3, 3, 3);
      }

      if (weather !== 'clear' || (!night && idx % 2 === 0)) {
        // drifting clouds
        const cc = weather === 'rain' ? 'rgba(90,98,116,0.9)'
          : night ? 'rgba(60,70,100,0.8)' : 'rgba(255,255,255,0.85)';
        ctx.fillStyle = cc;
        for (let k = 0; k < (weather === 'clear' ? 1 : 2); k++) {
          const drift = ((t * (3 + k) + idx * 17 + k * 23) % (w + 14)) - 12;
          ctx.fillRect(x + drift, y + 2 + k * 5, 10, 3);
          ctx.fillRect(x + drift + 2, y + 1 + k * 5, 6, 2);
        }
      }

      if (weather === 'rain') {
        ctx.fillStyle = 'rgba(190,208,230,0.7)';
        for (let r = 0; r < 6; r++) {
          const rx = (r * 5 + Math.floor(t * 26) * 2 + idx * 3) % w;
          const ry = (r * 4 + t * 60) % h;
          ctx.fillRect(x + rx, y + ry, 1, 3);
        }
      }

      // window cross-frame back on top
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(x + 13, y, 2, h);
    });
  }

  function spriteBox(c) {
    return c.agent.isSubagent
      ? { x: c.x + 4, y: c.y + 8, w: 8, h: 8 }
      : { x: c.x, y: c.y, w: 16, h: 16 };
  }

  function shortName(agent) {
    // Show last 8 chars of session ID (e.g. "2212cb23")
    const id = agent.id || '';
    const parts = id.split(':');
    const sessionId = parts.length > 1 ? parts[1] : id;
    return sessionId.slice(0, 8);
  }

  class Office {
    constructor(canvas, sim, options) {
      this.canvas = canvas;
      this.sim = sim;
      this.selectedId = null;
      canvas.width = W * S;
      canvas.height = H * S;
      this.ctx = canvas.getContext('2d');
      this.sprites = window.Sprites.buildSprites();

      // Options: scheduler, effectManager, perfDetector (all optional for backward compat)
      this.scheduler = (options && options.scheduler) || null;
      this.effectManager = (options && options.effectManager) || null;
      this.perfDetector = (options && options.perfDetector) || null;

      // Background layer (redrawn only on init/resize)
      this.bgCanvas = document.createElement('canvas');
      this.bgCanvas.width = W;
      this.bgCanvas.height = H;
      drawMap(this.bgCanvas.getContext('2d'), window.Sim.LAYOUT);

      // Offscreen layers for compositor
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = W;
      this.lightCanvas.height = H;

      this.charCanvas = document.createElement('canvas');
      this.charCanvas.width = W;
      this.charCanvas.height = H;

      this.particleCanvas = document.createElement('canvas');
      this.particleCanvas.width = W;
      this.particleCanvas.height = H;

      // Keep legacy .bg reference for backward compat
      this.bg = this.bgCanvas;

      this.last = performance.now();
      this._startTime = performance.now();
      this._prevBubbles = '';

      if (this.scheduler) {
        this.scheduler.markAllDirty();
        this.scheduler.onFrame((layers) => this.compositeDraw(layers));
      }

      // Initialize effect manager with desk and plant positions
      if (this.effectManager) {
        const desks = [];
        window.Sim.LAYOUT.rooms.forEach(r => {
          r.desks.forEach(d => {
            desks.push({ x: d.tx * TILE, y: d.ty * TILE, screenX: d.tx * TILE + 12, screenY: d.ty * TILE - 4 });
          });
        });
        this.effectManager.initDesks(desks);

        const plants = [[0.9, 2.8], [28.2, 2.8], [0.9, 17.7], [28.2, 17.7], [12.4, 18]];
        this.effectManager.initPlants(plants.map(([px, py]) => ({ x: px * TILE + 2, y: py * TILE })));

        // Sparkle timer tracking
        this._sparkleTimers = new Map();
      }

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
      const frameMs = t - this.last;
      this.last = t;

      // Update simulation
      this.sim.update(dt);

      // Update effects
      if (this.effectManager) {
        this.effectManager.update(dt);
        // Emit typing sparkles for working characters (only at full tier)
        var currentTier = this.perfDetector ? this.perfDetector.currentTier() : 3;
        if (currentTier >= 3) {
          for (const c of this.sim.chars.values()) {
            if (c.agent.status === 'working' && c.phase === 'atDesk' && !c.agent.isSubagent) {
              let timer = this._sparkleTimers.get(c.id) || 0;
              timer -= dt;
              if (timer <= 0) {
                const srcColor = window.Sprites.SOURCE_COLORS[c.agent.source];
                this.effectManager.emit('sparkle', {
                  x: c.x + 8, y: c.y - 2,
                  color: srcColor ? srcColor.B : '#fff'
                });
                timer = 0.5 + Math.random() * 0.3;
              }
              this._sparkleTimers.set(c.id, timer);
            }
          }
          // Ambient dust motes (corridor area)
          if (Math.random() < dt * 0.5) {
            this.effectManager.emit('ambient', {
              x: 14 * 16 + Math.random() * 48,
              y: 10 * 16 + Math.random() * 32
            });
          }
        }
      }

      // Sample frame time for perf detection (skip first 2s to avoid startup/ff noise)
      if (this.perfDetector && frameMs > 0 && t - this._startTime > 2000) {
        this.perfDetector.sample(frameMs);
      }

      // If scheduler is active, use dirty-flag driven rendering
      if (this.scheduler) {
        // Mark chars dirty if any character is active
        var hasWorking = false;
        for (const c of this.sim.chars.values()) {
          if (c.animState && c.animState.isActive()) {
            this.scheduler.markDirty('chars');
            this.scheduler.markDirty('ui');
          }
          if (c.agent.status === 'working') hasWorking = true;
        }
        // Mark lighting dirty when working characters exist (for status glow pulse)
        if (hasWorking && this.effectManager) {
          this.scheduler.markDirty('lighting');
        }
        // Track arrivals/departures for poof effects
        if (this.effectManager) {
          if (!this._knownChars) this._knownChars = new Set();
          for (const c of this.sim.chars.values()) {
            if (!this._knownChars.has(c.id)) {
              this._knownChars.add(c.id);
              // Arrival poof at door
              this.effectManager.emit('poof', { x: window.Sim.LAYOUT.door.x + 8, y: window.Sim.LAYOUT.door.y + 8 });
            }
            if (c.phase === 'done' && this._knownChars.has(c.id)) {
              this._knownChars.delete(c.id);
              // Departure poof
              this.effectManager.emit('poof', { x: c.x + 8, y: c.y + 8 });
            }
          }
        }
        this.scheduler.tick(t);
      } else {
        // Legacy: draw every frame
        this.draw();
      }

      // Schedule next frame (idle throttling handled externally by caller if scheduler present)
      if (this.scheduler && this.scheduler.isIdle()) {
        setTimeout(() => requestAnimationFrame((tt) => this.loop(tt)), 250);
      } else {
        requestAnimationFrame((tt) => this.loop(tt));
      }
    }

    draw() {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.bg, 0, 0, W, H, 0, 0, W * S, H * S);
      ctx.save();
      ctx.scale(S, S);
      drawWindowScenes(ctx, performance.now() / 1000);
      ctx.restore();

      const labels = this.sim.roomLabels();
      window.Sim.LAYOUT.rooms.forEach((r, i) => {
        if (labels[i]) drawPlaque(ctx, r, labels[i]);
      });

      const chars = [...this.sim.chars.values()].sort((a, b) => a.y - b.y);
      for (const c of chars) {
        const set = this.sprites[c.agent.source] || this.sprites.claude;
        const bob = c.animState ? c.animState.currentBob() : c.bob();
        const frameKey = c.animState ? c.animState.currentFrame() : c.frame();
        const y = Math.round(c.y + bob);
        const x = Math.round(c.x);
        const b = spriteBox(c);

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
          const img = set[frameKey] || set.stand;
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
        const bob = c.animState ? c.animState.currentBob() : c.bob();
        const cx = b.x + b.w / 2;
        const top = b.y + bob;
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

    // Layered compositor: only redraws dirty layers
    compositeDraw(dirtyLayers) {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      const dirty = new Set(dirtyLayers);

      // Lighting layer
      if (dirty.has('lighting') && this.effectManager) {
        const lctx = this.lightCanvas.getContext('2d');
        lctx.clearRect(0, 0, W, H);
        const charsList = [...this.sim.chars.values()];
        const charsArr = charsList.map(c => ({
          x: c.x + 8, y: c.y + 8,
          status: c.agent.status,
          sourceColor: window.Sprites.SOURCE_COLORS[c.agent.source]?.B || '#fff',
          desk: c.desk
        }));
        // Build desk array with occupancy
        const desks = [];
        const occupiedDesks = new Set(
          charsList.filter(c => c.desk && c.phase === 'atDesk')
            .map(c => c.desk.tx + ',' + c.desk.ty)
        );
        window.Sim.LAYOUT.rooms.forEach(r => {
          r.desks.forEach(d => {
            desks.push({
              x: d.tx * TILE, y: d.ty * TILE,
              laptopX: d.tx * TILE + 16, laptopY: d.ty * TILE - 2,
              id: d.tx + ',' + d.ty,
              occupied: occupiedDesks.has(d.tx + ',' + d.ty)
            });
          });
        });
        // Pass chars with matching desk info for glow
        const charsForLight = charsList
          .filter(c => c.phase === 'atDesk' && c.agent.status === 'working')
          .map(c => ({
            x: c.x + 8, y: c.y + 8,
            status: c.agent.status,
            sourceColor: window.Sprites.SOURCE_COLORS[c.agent.source]?.B || '#fff',
            deskId: c.desk ? (c.desk.tx + ',' + c.desk.ty) : null
          }));
        this.effectManager.drawLighting(lctx, charsForLight, desks);
      }

      // Character layer (windows animate here too — they sit above bg)
      if (dirty.has('chars')) {
        const cctx = this.charCanvas.getContext('2d');
        cctx.clearRect(0, 0, W, H);
        drawWindowScenes(cctx, performance.now() / 1000);
        const chars = [...this.sim.chars.values()].sort((a, b) => a.y - b.y);
        for (const c of chars) {
          const set = this.sprites[c.agent.source] || this.sprites.claude;
          const bob = c.animState ? c.animState.currentBob() : c.bob();
          const frameKey = c.animState ? c.animState.currentFrame() : c.frame();
          const y = Math.round(c.y + bob);
          const x = Math.round(c.x);

          // grounding shadow — anchored to the floor, not the bobbing sprite
          const sb = spriteBox(c);
          cctx.fillStyle = 'rgba(18,18,30,0.28)';
          cctx.beginPath();
          cctx.ellipse(sb.x + sb.w / 2, c.y + (c.agent.isSubagent ? 16 : sb.h) - 1,
            sb.w / 2 + 1, 2.6, 0, 0, Math.PI * 2);
          cctx.fill();

          if (c.id === this.selectedId) {
            const bx = spriteBox(c);
            cctx.fillStyle = 'rgba(255,214,74,0.45)';
            cctx.beginPath();
            cctx.ellipse(bx.x + bx.w / 2, bx.y + bx.h - 1, bx.w / 2 + 3, 4, 0, 0, Math.PI * 2);
            cctx.fill();
            cctx.strokeStyle = '#ffd64a';
            cctx.lineWidth = 1;
            cctx.stroke();
          }

          cctx.save();
          if (c.agent.isSubagent) {
            cctx.translate(x + 4, y + 8);
            cctx.drawImage(set.mini, 0, 0);
          } else {
            const img = set[frameKey] || set.stand;
            if (c.facing === -1) {
              cctx.translate(x + TILE, y);
              cctx.scale(-1, 1);
            } else {
              cctx.translate(x, y);
            }
            cctx.drawImage(img, 0, 0);
          }
          cctx.restore();
        }
      }

      // Particle layer
      if (dirty.has('particles') && this.effectManager) {
        const pctx = this.particleCanvas.getContext('2d');
        pctx.clearRect(0, 0, W, H);
        this.effectManager.drawParticles(pctx);
      }

      // Composite all layers to main canvas
      ctx.drawImage(this.bgCanvas, 0, 0, W, H, 0, 0, W * S, H * S);
      ctx.drawImage(this.lightCanvas, 0, 0, W, H, 0, 0, W * S, H * S);
      ctx.drawImage(this.charCanvas, 0, 0, W, H, 0, 0, W * S, H * S);
      ctx.drawImage(this.particleCanvas, 0, 0, W, H, 0, 0, W * S, H * S);

      // UI layer (drawn at full res on main canvas)
      if (dirty.has('ui') || dirty.has('chars')) {
        const labels = this.sim.roomLabels();
        window.Sim.LAYOUT.rooms.forEach((r, i) => {
          if (labels[i]) drawPlaque(ctx, r, labels[i]);
        });

        const chars = [...this.sim.chars.values()].sort((a, b) => a.y - b.y);
        for (const c of chars) {
          if (c.walking || c.agent.isSubagent) continue;
          const bob = c.animState ? c.animState.currentBob() : c.bob();
          const x = Math.round(c.x);
          const y = Math.round(c.y + bob);
          drawName(ctx, x + TILE / 2, y + TILE, shortName(c.agent),
            STATUS_COLORS[c.agent.status] || '#888');
        }

        for (const c of chars) {
          if (c.walking) continue;
          const b = spriteBox(c);
          const bob = c.animState ? c.animState.currentBob() : c.bob();
          const cx = b.x + b.w / 2;
          const top = b.y + bob;
          if (c.excursion) {
            // coffee break: a ☕ while sipping, and no Zz at the machine
            if (c.excursion.state === 'sipping') drawBubble(ctx, cx, top, '☕');
            continue;
          }
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

      // Ambient effects (drawn on bg layer area)
      if (this.effectManager && dirty.has('bg')) {
        const bctx = this.bgCanvas.getContext('2d');
        this.effectManager.drawAmbient(bctx, 0);
      }
    }
  }

  window.Office = { Office, STATUS_COLORS };
})();
