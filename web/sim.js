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

function dist(a, b) {
  var dx = b.x - a.x;
  var dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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
    this.x = LAYOUT.door.x + (Math.random() - 0.5) * 6;
    this.y = LAYOUT.door.y;
    this.phase = 'entering'; // entering | atDesk | leaving | done
    this.path = pathToRoom(room, dest);
    this.animT = Math.random() * 10;
    this.facing = 1;
    // Varied walk speed per character (±15%)
    this.walkSpeed = WALK_SPEED * (0.85 + Math.random() * 0.3);
    // Staggered entrance: wait before starting to walk
    this._entranceDelay = Math.random() * 1.8 + 0.2; // 0.2s to 2.0s delay
    this._waitingToEnter = true;
    // Eased walk tracking
    this._segStart = { x: this.x, y: this.y };
    this._segEnd = this.path.length > 0 ? this.path[0] : { x: this.x, y: this.y };
    this._segLen = dist(this._segStart, this._segEnd);
    this._segProgress = 0;
    // Brief pause at waypoints (corridor junctions)
    this._waypointPause = 0;
    // Animation state machine (if available)
    this.animState = window.AnimState ? window.AnimState.create(this) : null;
  }

  leave() {
    if (this.phase === 'leaving' || this.phase === 'done') return;
    this.phase = 'leaving';
    this._waitingToEnter = false; // clear any entrance delay
    this._waypointPause = 0;
    this.path = pathToDoor(this.room, { x: this.x, y: this.y });
    this._segStart = { x: this.x, y: this.y };
    this._segEnd = this.path.length > 0 ? this.path[0] : { x: this.x, y: this.y };
    this._segLen = dist(this._segStart, this._segEnd);
    this._segProgress = 0;
  }

  update(dt) {
    this.animT += dt;

    if (this.agent.status === 'gone') this.leave();

    // Update animation state machine
    if (this.animState) {
      // Skip update for idle characters at desk (perf optimization)
      if (this.path.length === 0 && this.phase === 'atDesk' &&
          this.agent.status === 'idle' && !this.animState.isActive()) {
        return;
      }
      this.animState.update(dt);
    }

    // Staggered entrance: wait at door before walking
    if (this._waitingToEnter) {
      this._entranceDelay -= dt;
      if (this._entranceDelay > 0) return;
      this._waitingToEnter = false;
    }

    if (this.path.length === 0) return;

    // Eased walk with per-character speed
    var speed = this.walkSpeed || WALK_SPEED;
    var segTime = this._segLen / speed;
    if (segTime <= 0) {
      // Zero-length segment, skip to next waypoint
      this.x = this._segEnd.x;
      this.y = this._segEnd.y;
      this.path.shift();
      if (this.path.length > 0) {
        this._segStart = { x: this.x, y: this.y };
        this._segEnd = this.path[0];
        this._segLen = dist(this._segStart, this._segEnd);
        this._segProgress = 0;
      } else {
        this.phase = this.phase === 'leaving' ? 'done' : 'atDesk';
      }
      return;
    }

    this._segProgress += dt / segTime;

    if (this._segProgress >= 1) {
      // Arrived at waypoint
      this.x = this._segEnd.x;
      this.y = this._segEnd.y;
      this.path.shift();
      if (this.path.length > 0) {
        this._segStart = { x: this.x, y: this.y };
        this._segEnd = this.path[0];
        this._segLen = dist(this._segStart, this._segEnd);
        this._segProgress = 0;
      } else {
        this.phase = this.phase === 'leaving' ? 'done' : 'atDesk';
        this._segProgress = 0;
      }
    } else {
      // Apply easing only at first and last segment; linear in between for smooth walking
      var Ease = window.Ease;
      var eased;
      if (!Ease) {
        eased = this._segProgress;
      } else if (this.path.length === 0 && this._segProgress < 1) {
        // Last segment: ease out (decelerate to stop)
        eased = Ease.easeOutQuad(this._segProgress);
      } else if (this.phase === 'entering' && this._segLen === dist({ x: LAYOUT.door.x, y: LAYOUT.door.y }, this._segEnd)) {
        // First segment from door: ease in (accelerate from standstill)
        eased = Ease.easeInQuad(this._segProgress);
      } else {
        // Middle segments: linear for constant speed (no jerky stops)
        eased = this._segProgress;
      }
      this.x = lerp(this._segStart.x, this._segEnd.x, eased);
      this.y = lerp(this._segStart.y, this._segEnd.y, eased);
      // Update facing direction
      var dx = this._segEnd.x - this._segStart.x;
      if (Math.abs(dx) > 0.1) this.facing = dx > 0 ? 1 : -1;
    }
  }

  get walking() {
    return this.path.length > 0 && !this._waitingToEnter;
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
      const oldStatus = existing.agent.status;
      existing.agent = agent;

      // Detect status change and trigger animation reaction
      if (existing.animState && oldStatus !== agent.status) {
        existing.animState.onStatusChange(oldStatus, agent.status);
      }

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
    c._segStart = { x: c.x, y: c.y };
    c._segEnd = c.path.length > 0 ? c.path[0] : { x: c.x, y: c.y };
    c._segLen = dist(c._segStart, c._segEnd);
    c._segProgress = 0;
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
