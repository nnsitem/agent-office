'use strict';

// Pixel art defined as data: each frame is 16 rows of 16 chars, one char per
// pixel. '.' = transparent; other chars index into a palette. Body colors
// ('B' main, 'D' shade) are swapped per agent source so one template yields
// all characters. Frames are pre-rendered to offscreen canvases.

(function () {
const SOURCE_COLORS = {
  claude: { B: '#ff9d5c', D: '#c9662a' },
  kiro:   { B: '#c792ea', D: '#8e54bf' },
  gemini: { B: '#6cb2ff', D: '#3872c4' },
  codex:  { B: '#7ee08a', D: '#3f9e51' },
};

const BASE_PALETTE = {
  O: '#14141c', // outline
  V: '#dff0ff', // visor glass
  E: '#20242e', // eyes
  L: '#3c4254', // antenna / limbs metal
};

// Little robot worker, 16x16. Frames: stand, walk1, walk2, sleep.
const FRAMES = {
  stand: [
    '.......L........',
    '......LL........',
    '....OOOOOO......',
    '...OBBBBBBO.....',
    '..OBVVVVVVBO....',
    '..OBVEVVEVBO....',
    '..OBVVVVVVBO....',
    '...OBBBBBBO.....',
    '..OBBBBBBBBO....',
    '.ODBBBBBBBBDO...',
    '.ODBBBBBBBBDO...',
    '..OBBBBBBBBO....',
    '...ODDDDDDO.....',
    '...ODD..DDO.....',
    '...ODD..DDO.....',
    '...OOO..OOO.....',
  ],
  walk1: [
    '.......L........',
    '......LL........',
    '....OOOOOO......',
    '...OBBBBBBO.....',
    '..OBVVVVVVBO....',
    '..OBVEVVEVBO....',
    '..OBVVVVVVBO....',
    '...OBBBBBBO.....',
    '..OBBBBBBBBO....',
    '.ODBBBBBBBBDO...',
    '.ODBBBBBBBBDO...',
    '..OBBBBBBBBO....',
    '...ODDDDDDO.....',
    '..ODD...DDO.....',
    '..ODD....DDO....',
    '..OOO....OOO....',
  ],
  walk2: [
    '.......L........',
    '......LL........',
    '....OOOOOO......',
    '...OBBBBBBO.....',
    '..OBVVVVVVBO....',
    '..OBVEVVEVBO....',
    '..OBVVVVVVBO....',
    '...OBBBBBBO.....',
    '..OBBBBBBBBO....',
    '.ODBBBBBBBBDO...',
    '.ODBBBBBBBBDO...',
    '..OBBBBBBBBO....',
    '...ODDDDDDO.....',
    '....ODDDDO......',
    '....ODDDDO......',
    '....OOOOOO......',
  ],
  sleep: [
    '................',
    '.......L........',
    '......LL........',
    '....OOOOOO......',
    '...OBBBBBBO.....',
    '..OBVVVVVVBO....',
    '..OBVEEVEEVBO...',
    '..OBVVVVVVBO....',
    '...OBBBBBBO.....',
    '..OBBBBBBBBO....',
    '.ODBBBBBBBBDO...',
    '..OBBBBBBBBO....',
    '...ODDDDDDO.....',
    '...ODD..DDO.....',
    '...ODD..DDO.....',
    '...OOO..OOO.....',
  ],
  typing1: [
    '.......L........',
    '......LL........',
    '....OOOOOO......',
    '...OBBBBBBO.....',
    '..OBVVVVVVBO....',
    '..OBVEVVEVBO....',
    '..OBVVVVVVBO....',
    '...OBBBBBBO.....',
    '..OBBBBBBBBO....',
    '.ODBBBBBBBBDO...',
    '.ODBBBBBBBBDO...',
    '..OLBBBBBBLO....',
    '...ODDDDDDO.....',
    '...ODDODDDO.....',
    '...ODDODDDO.....',
    '...OOOOOOOO.....',
  ],
  typing2: [
    '.......L........',
    '......LL........',
    '....OOOOOO......',
    '...OBBBBBBO.....',
    '..OBVVVVVVBO....',
    '..OBVEVVEVBO....',
    '..OBVVVVVVBO....',
    '...OBBBBBBO.....',
    '..OBBBBBBBBO....',
    '.ODBBBBBBBBDO...',
    '..ODBBBBBBBBDO..',
    '..OLBBBBBBLO....',
    '...ODDDDDDO.....',
    '...ODDODDDO.....',
    '...ODDODDDO.....',
    '...OOOOOOOO.....',
  ],
  lean: [
    '........L.......',
    '.......LL.......',
    '.....OOOOOO.....',
    '....OBBBBBBO....',
    '...OBVVVVVVBO...',
    '...OBVEVVEVBO...',
    '...OBVVVVVVBO...',
    '....OBBBBBBO....',
    '..OBBBBBBBBO....',
    '.ODBBBBBBBBDO...',
    '.ODBBBBBBBBDO...',
    '..OLBBBBBBLO....',
    '...ODDDDDDO.....',
    '...ODDODDDO.....',
    '...ODDODDDO.....',
    '...OOOOOOOO.....',
  ],
};

// mini variant for subagents: 8x8
const MINI_FRAME = [
  '..OOOO..',
  '.OBVVBO.',
  '.OBVVBO.',
  '..OBBO..',
  '.OBBBBO.',
  '.OBBBBO.',
  '..ODDO..',
  '..O..O..',
];

function renderFrame(rows, palette) {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (!ch || ch === '.') continue;
      ctx.fillStyle = palette[ch] || '#f0f';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// -> { claude: {stand, walk1, walk2, sleep, mini}, kiro: {...}, ... }
function buildSprites() {
  const out = {};
  for (const [source, colors] of Object.entries(SOURCE_COLORS)) {
    const palette = { ...BASE_PALETTE, ...colors };
    out[source] = {};
    for (const [name, rows] of Object.entries(FRAMES)) {
      out[source][name] = renderFrame(rows, palette);
    }
    out[source].mini = renderFrame(MINI_FRAME, palette);
  }
  return out;
}

window.Sprites = { buildSprites, SOURCE_COLORS };
})();
