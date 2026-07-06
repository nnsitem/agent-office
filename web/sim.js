'use strict';

// Character simulation: room assignment per project, waypoint pathing along
// corridors, desk assignment, subagent minis perched next to their parent.
// Coordinates are pixels within the office's internal resolution (480x320).

const TILE = 16;
const WALK_SPEED = 42; // px/s

// Office floor plan: 4 rooms around a central + corridor. Each room opens
// onto the middle corridor through a gap at gapX (a clear column between
// desk columns, so vertical paths never cross furniture).
const LAYOUT = {
  centerX: 14 * TILE, // sprite-left x of the vertical corridor line
  midY: 10 * TILE,    // sprite-top y of the middle corridor line
  door: { x: 14 * TILE, y: 19 * TILE },
  rooms: [
    { x1: 2, y1: 3, x2: 12, y2: 8, top: true, gapX: 104,
      desks: [{ tx: 4, ty: 5 }, { tx: 8, ty: 5 }] },
    { x1: 18, y1: 3, x2: 28, y2: 8, top: true, gapX: 360,
      desks: [{ tx: 20, ty: 5 }, { tx: 24, ty: 5 }] },
    { x1: 2, y1: 12, x2: 12, y2: 17, top: false, gapX: 104,
      desks: [{ tx: 4, ty: 14 }, { tx: 8, ty: 14 }] },
    { x1: 18, y1: 12, x2: 28, y2: 17, top: false, gapX: 360,
      desks: [{ tx: 20, ty: 14 }, { tx: 24, ty: 14 }] },
  ],
};

function deskPos(desk) {
  return { x: desk.tx * TILE, y: (desk.ty + 1) * TILE };
}

// Waypoints from the front door to a position inside a room.
function pathToRoom(room, dest) {
  const gx = room.gapX - TILE / 2; // sprite-left so the sprite straddles the gap
  return [
    { x: LAYOUT.centerX, y: LAYOUT.midY },
    { x: gx, y: LAYOUT.midY },
    { x: gx, y: dest.y },
    { x: dest.x, y: dest.y },
  ];
}

// Waypoints from a position inside a room back to the door.
function pathToDoor(room, from) {
  const gx = room.gapX - TILE / 2;
  return [
    { x: gx, y: from.y },
    { x: gx, y: LAYOUT.midY },
    { x: LAYOUT.centerX, y: LAYOUT.midY },
    { x: LAYOUT.centerX, y: LAYOUT.door.y },
  ];
}

class Character {
  constructor(agent, room, dest) {
    this.id = agent.id;
    this.agent = agent;
    this.room = room;
    this.x = LAYOUT.door.x;
    this.y = LAYOUT.door.y;
    this.phase = 'entering'; // entering | atDesk | leaving | done
    this.path = pathToRoom(room, dest);
    this.animT = Math.random() * 10;
    this.facing = 1;
  }

  leave() {
    if (this.phase === 'leaving' || this.phase === 'done') return;
    this.phase = 'leaving';
    this.path = pathToDoor(this.room, { x: this.x, y: this.y });
  }

  update(dt) {
    this.animT += dt;
    if (this.agent.status === 'gone') this.leave();
    if (this.path.length === 0) return;
    const t = this.path[0];
    const step = WALK_SPEED * dt;
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    if (Math.abs(dx) > step) {
      this.x += Math.sign(dx) * step;
      this.facing = Math.sign(dx);
    } else if (Math.abs(dy) > step) {
      this.x = t.x;
      this.y += Math.sign(dy) * step;
    } else {
      this.x = t.x;
      this.y = t.y;
      this.path.shift();
      if (this.path.length === 0) {
        this.phase = this.phase === 'leaving' ? 'done' : 'atDesk';
      }
    }
  }

  get walking() {
    return this.path.length > 0;
  }

  frame() {
    if (this.walking) return Math.floor(this.animT * 6) % 2 ? 'walk1' : 'walk2';
    if (this.agent.status === 'idle') return 'sleep';
    return 'stand';
  }

  bob() {
    if (this.walking) return 0;
    if (this.agent.status === 'working') return Math.floor(this.animT * 8) % 2 ? -1 : 0;
    if (this.agent.status === 'waiting') return Math.abs(Math.sin(this.animT * 5)) * -3;
    return 0;
  }
}

class Sim {
  constructor() {
    this.chars = new Map();      // id -> Character
    this.roomOf = new Map();     // project -> room index
    this.layoutVersion = 0;      // bumped when room labels change
  }

  // One label per room listing every workspace with live agents in it.
  roomLabels() {
    const live = new Set(
      [...this.chars.values()].filter((c) => c.phase !== 'done').map((c) => c.agent.project || '?')
    );
    const names = LAYOUT.rooms.map(() => []);
    for (const [project, idx] of this.roomOf) {
      if (!live.has(project)) continue;
      const name = project === '?' ? '?' : project.split('/').filter(Boolean).pop();
      if (!names[idx].includes(name)) names[idx].push(name);
    }
    return names.map((list) => list.join(' · '));
  }

  assignRoom(project) {
    const key = project || '?';
    if (this.roomOf.has(key)) return this.roomOf.get(key);
    const used = new Set(this.roomOf.values());
    let idx = LAYOUT.rooms.findIndex((_, i) => !used.has(i));
    if (idx === -1) idx = this.roomOf.size % LAYOUT.rooms.length; // overflow: share
    this.roomOf.set(key, idx);
    this.layoutVersion++;
    return idx;
  }

  freeDesk(roomIdx) {
    const used = new Set(
      [...this.chars.values()]
        .filter((c) => c.desk && c.phase !== 'done')
        .map((c) => c.desk.tx + ',' + c.desk.ty)
    );
    return LAYOUT.rooms[roomIdx].desks.find((d) => !used.has(d.tx + ',' + d.ty)) || null;
  }

  // A parent character for a subagent: same project, not itself a subagent.
  findParent(agent) {
    for (const c of this.chars.values()) {
      if (c.id !== agent.id && !c.agent.isSubagent && c.agent.project === agent.project &&
          c.agent.status !== 'gone' && c.phase !== 'done') {
        return c;
      }
    }
    return null;
  }

  upsert(agent) {
    const existing = this.chars.get(agent.id);
    if (existing) {
      const oldProject = existing.agent.project;
      existing.agent = agent;
      // project refined mid-session (e.g. Claude narrowed to a subdir):
      // walk over to the right room once the character is settled
      if (!agent.isSubagent && agent.project && oldProject &&
          agent.project !== oldProject && existing.phase === 'atDesk') {
        this.relocate(existing);
      }
      return;
    }
    if (agent.status === 'gone') return;
    const roomIdx = this.assignRoom(agent.project);
    const room = LAYOUT.rooms[roomIdx];
    let dest;
    let desk = null;
    if (agent.isSubagent) {
      const parent = this.findParent(agent);
      if (parent) {
        // perch beside where the parent will end up, not where it is mid-walk
        const p = parent.path.length ? parent.path[parent.path.length - 1] : parent;
        dest = { x: p.x + 18, y: p.y + 6 };
      }
    }
    if (!dest) {
      desk = this.freeDesk(roomIdx);
      dest = desk
        ? deskPos(desk)
        : { x: room.gapX - TILE / 2, y: room.top ? (room.y2 - 2) * TILE : (room.y1 + 2) * TILE }; // room full: loiter by the doorway
    }
    const c = new Character(agent, room, dest);
    c.desk = desk;
    this.chars.set(agent.id, c);
  }

  relocate(c) {
    const roomIdx = this.assignRoom(c.agent.project);
    const room = LAYOUT.rooms[roomIdx];
    if (room === c.room) return;
    const oldRoom = c.room;
    const desk = this.freeDesk(roomIdx);
    const dest = desk
      ? deskPos(desk)
      : { x: room.gapX - TILE / 2, y: room.top ? (room.y2 - 2) * TILE : (room.y1 + 2) * TILE };
    c.desk = desk;
    c.room = room;
    c.phase = 'entering';
    // walk out to the middle corridor, then into the new room
    const out = pathToDoor(oldRoom, { x: c.x, y: c.y });
    out.splice(-1); // stop at (centerX, midY) instead of the front door
    const into = pathToRoom(room, dest);
    c.path = [...out, ...into];
  }

  remove(id) {
    const c = this.chars.get(id);
    if (c) c.agent = { ...c.agent, status: 'gone' };
  }

  update(dt) {
    for (const [id, c] of this.chars) {
      c.update(dt);
      if (c.phase === 'done') this.chars.delete(id);
    }
  }
}

window.Sim = { Sim, TILE, LAYOUT };
