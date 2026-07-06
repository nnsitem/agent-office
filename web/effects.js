(function () {
  'use strict';

  var Tier = { FULL: 3, REDUCED: 2, MINIMAL: 1 };

  function EffectManager(scheduler) {
    var tier = Tier.FULL;
    var POOL_SIZE = 128;
    var particles = [];
    var deskStates = [];
    var plantStates = [];

    // Pre-allocate particle pool
    for (var i = 0; i < POOL_SIZE; i++) {
      particles.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, color: '', size: 1, type: '',
        cx: 0, cy: 0, radiusX: 0, radiusY: 0, angle: 0, speed: 0
      });
    }

    function findSlot() {
      for (var i = 0; i < POOL_SIZE; i++) {
        if (!particles[i].active) return particles[i];
      }
      return null;
    }

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function setTier(t) {
      tier = t;
    }

    function emit(type, config) {
      if (type === 'sparkle') {
        var count = Math.floor(rand(4, 7));
        for (var i = 0; i < count; i++) {
          var p = findSlot();
          if (!p) return;
          p.active = true;
          p.x = config.x + rand(-4, 4);
          p.y = config.y + rand(-2, 2);
          p.vx = rand(-8, 8);
          p.vy = rand(-30, -15);
          p.life = rand(0.8, 1.4);
          p.maxLife = p.life;
          p.color = config.color;
          p.size = 2;
          p.type = 'sparkle';
        }
      } else if (type === 'poof') {
        var count = Math.floor(rand(6, 10));
        for (var i = 0; i < count; i++) {
          var p = findSlot();
          if (!p) return;
          var angle = Math.random() * Math.PI * 2;
          var speed = rand(25, 50);
          p.active = true;
          p.x = config.x;
          p.y = config.y;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.life = rand(0.4, 0.7);
          p.maxLife = p.life;
          p.color = '#ffe8cc';
          p.size = 2;
          p.type = 'poof';
        }
      } else if (type === 'thinkDots') {
        for (var i = 0; i < 3; i++) {
          var p = findSlot();
          if (!p) return;
          p.active = true;
          p.cx = config.x;
          p.cy = config.y;
          p.radiusX = 6;
          p.radiusY = 3;
          p.angle = (i * 2 * Math.PI) / 3;
          p.speed = 3;
          p.x = p.cx + p.radiusX * Math.cos(p.angle);
          p.y = p.cy + p.radiusY * Math.sin(p.angle);
          p.vx = 0;
          p.vy = 0;
          p.life = 999;
          p.maxLife = 999;
          p.color = config.color;
          p.size = 1;
          p.type = 'orbit';
        }
      } else if (type === 'ambient') {
        var p = findSlot();
        if (!p) return;
        p.active = true;
        p.x = config.x;
        p.y = config.y;
        p.vx = rand(-2, 2);
        p.vy = rand(-3, -1);
        p.life = rand(3, 5);
        p.maxLife = p.life;
        p.color = 'rgba(200,200,220,0.5)';
        p.size = 1;
        p.type = 'ambient';
      }
    }

    function update(dt) {
      var anyActive = false;
      for (var i = 0; i < POOL_SIZE; i++) {
        var p = particles[i];
        if (!p.active) continue;
        if (p.type === 'orbit') {
          p.angle += p.speed * dt;
          p.x = p.cx + p.radiusX * Math.cos(p.angle);
          p.y = p.cy + p.radiusY * Math.sin(p.angle);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
        }
        if (p.life <= 0) {
          p.active = false;
        } else {
          anyActive = true;
        }
      }
      if (anyActive) {
        scheduler.markDirty('particles');
      }
    }

    function drawParticles(ctx) {
      var drew = false;
      for (var i = 0; i < POOL_SIZE; i++) {
        var p = particles[i];
        if (!p.active) continue;
        // Tier gating
        if (p.type === 'orbit') {
          if (tier < 2) continue;
        } else {
          if (tier < 3) continue;
        }
        ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        drew = true;
      }
      if (drew) {
        ctx.globalAlpha = 1;
      }
    }

    // World geometry the lighting scene needs (world px, 480x320)
    var WINDOW_XS = [5 * 16, 12 * 16, 19 * 16, 26 * 16];
    var CEILING_LAMPS = [[232, 90], [232, 170], [232, 250], [80, 168], [400, 168]];

    function timePhase() {
      var hour = (window.AO_FORCE_HOUR != null)
        ? Number(window.AO_FORCE_HOUR)
        : new Date().getHours() + new Date().getMinutes() / 60;
      if (hour >= 6 && hour < 9) return 'morning';
      if (hour >= 9 && hour < 16) return 'day';
      if (hour >= 16 && hour < 20) return 'evening';
      return 'night';
    }

    function glow(ctx, cx, cy, r, color, alpha) {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }

    function drawLighting(ctx, chars, desks) {
      if (tier < 2) return;

      var phase = timePhase();
      var night = phase === 'night';

      // Ambient tint per phase — day is untinted, night is cool and dark
      var tints = {
        morning: 'rgba(255,196,130,0.07)',
        day: null,
        evening: 'rgba(255,150,64,0.12)',
        night: 'rgba(28,38,80,0.30)',
      };
      if (tints[phase]) {
        ctx.fillStyle = tints[phase];
        ctx.fillRect(0, 0, 480, 320);
      }

      // Sunlight through the windows (morning/day/evening)
      if (!night) {
        var sun = phase === 'evening' ? 'rgba(255,180,90,1)' : 'rgba(255,244,214,1)';
        var sunAlpha = phase === 'day' ? 0.11 : 0.08;
        for (var i = 0; i < WINDOW_XS.length; i++) {
          var wx = WINDOW_XS[i] + 14; // window center
          var g = ctx.createLinearGradient(0, 24, 0, 78);
          g.addColorStop(0, sun);
          g.addColorStop(1, 'rgba(255,244,214,0)');
          ctx.globalAlpha = sunAlpha;
          ctx.fillStyle = g;
          // slightly widening shaft
          ctx.beginPath();
          ctx.moveTo(wx - 14, 24);
          ctx.lineTo(wx + 14, 24);
          ctx.lineTo(wx + 20, 78);
          ctx.lineTo(wx - 20, 78);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Ceiling lamps: warm pools in the corridors after dark
      if (night || phase === 'evening') {
        for (var i = 0; i < CEILING_LAMPS.length; i++) {
          glow(ctx, CEILING_LAMPS[i][0], CEILING_LAMPS[i][1], 36,
            'rgba(255,214,150,1)', night ? 0.16 : 0.08);
        }
      }

      // Desk lamp glow at occupied desks — stronger at night
      if (desks && chars) {
        for (var i = 0; i < desks.length; i++) {
          var desk = desks[i];
          var occupied = desk.occupied || false;
          if (!occupied) {
            for (var j = 0; j < chars.length; j++) {
              if (chars[j].deskId === desk.id) {
                occupied = true;
                break;
              }
            }
          }
          if (!occupied) continue;
          var cx = desk.laptopX !== undefined ? desk.laptopX : (desk.x + 4);
          var cy = desk.laptopY !== undefined ? desk.laptopY : (desk.y + 2);
          glow(ctx, cx, cy, night ? 46 : 36, 'rgba(255,228,181,1)', night ? 0.42 : 0.26);
        }
      }

      // Vignette — subtle depth at every hour
      var v = ctx.createRadialGradient(240, 160, 150, 240, 160, 330);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, night ? 'rgba(6,8,20,0.34)' : 'rgba(10,12,24,0.20)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, 480, 320);

      // Status glow for working characters
      if (chars) {
        for (var i = 0; i < chars.length; i++) {
          var ch = chars[i];
          if (ch.status !== 'working') continue;
          var pulse = Math.sin(Date.now() / 1000 * Math.PI) * 0.15 + 0.35;
          var color = ch.sourceColor || ch.color || 'rgba(255,255,255,0.25)';
          var gx = ch.x !== undefined ? ch.x : 0;
          var gy = ch.y !== undefined ? ch.y : 0;
          var gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, 12);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = pulse;
          ctx.fillStyle = gradient;
          ctx.fillRect(gx - 5, gy - 5, 10, 10);
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawAmbient(ctx, dt) {
      if (tier < 3) return;
      if (scheduler.isIdle()) return;

      var now = performance.now();

      // Monitor flicker
      var monitorColors = ['#cfe8ff', '#b8d8f0', '#e0f2ff'];
      for (var i = 0; i < deskStates.length; i++) {
        var ds = deskStates[i];
        if (now > ds.nextChangeAt) {
          ds.colorIdx = (ds.colorIdx + 1) % 3;
          ds.nextChangeAt = now + 1000 + Math.random() * 3000;
          scheduler.markDirty('bg');
        }
        ctx.fillStyle = monitorColors[ds.colorIdx];
        ctx.fillRect(ds.tx, ds.ty, 8, 5);
      }

      // Plant sway
      for (var i = 0; i < plantStates.length; i++) {
        var ps = plantStates[i];
        var offset = Math.sin(now / 1000 * (2 * Math.PI / ps.period) + ps.phase);
        var shift = Math.round(offset);
        // Draw a small green leaf area shifted horizontally
        ctx.fillStyle = '#4a7';
        ctx.fillRect(ps.x + shift, ps.y, 3, 2);
        ctx.fillRect(ps.x + shift - 1, ps.y + 1, 2, 1);
      }
    }

    function initDesks(desks) {
      deskStates = [];
      var now = performance.now();
      for (var i = 0; i < desks.length; i++) {
        var desk = desks[i];
        var tx = desk.screenX !== undefined ? desk.screenX : (desk.x + 2);
        var ty = desk.screenY !== undefined ? desk.screenY : (desk.y);
        deskStates.push({
          tx: tx,
          ty: ty,
          colorIdx: Math.floor(Math.random() * 3),
          nextChangeAt: now + Math.random() * 4000
        });
      }
    }

    function initPlants(plants) {
      plantStates = [];
      for (var i = 0; i < plants.length; i++) {
        var plant = plants[i];
        plantStates.push({
          x: plant.x,
          y: plant.y,
          phase: Math.random() * 2 * Math.PI,
          period: 3 + Math.random() * 2
        });
      }
    }

    return {
      setTier: setTier,
      emit: emit,
      update: update,
      drawParticles: drawParticles,
      drawLighting: drawLighting,
      drawAmbient: drawAmbient,
      initDesks: initDesks,
      initPlants: initPlants
    };
  }

  window.Effects = {
    EffectManager: EffectManager,
    Tier: Tier
  };
})();
