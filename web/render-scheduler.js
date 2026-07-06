(function () {
  'use strict';

  var IDLE_THRESHOLD = 120; // ~2s at 60fps

  function create(options) {
    var dirtyFlags = {
      bg: false,
      lighting: false,
      chars: false,
      particles: false,
      ui: false
    };

    var idleFrames = 0;
    var idle = false;
    var frameCallback = null;

    function markDirty(layer) {
      dirtyFlags[layer] = true;
      idleFrames = 0;
      idle = false;
    }

    function markAllDirty() {
      dirtyFlags.bg = true;
      dirtyFlags.lighting = true;
      dirtyFlags.chars = true;
      dirtyFlags.particles = true;
      dirtyFlags.ui = true;
      idleFrames = 0;
      idle = false;
    }

    function isIdle() {
      return idle;
    }

    function wake() {
      idleFrames = 0;
      idle = false;
    }

    function hasDirty() {
      return dirtyFlags.bg || dirtyFlags.lighting || dirtyFlags.chars ||
        dirtyFlags.particles || dirtyFlags.ui;
    }

    function collectDirtyLayers() {
      var layers = [];
      if (dirtyFlags.bg) layers.push('bg');
      if (dirtyFlags.lighting) layers.push('lighting');
      if (dirtyFlags.chars) layers.push('chars');
      if (dirtyFlags.particles) layers.push('particles');
      if (dirtyFlags.ui) layers.push('ui');
      return layers;
    }

    function clearFlags() {
      dirtyFlags.bg = false;
      dirtyFlags.lighting = false;
      dirtyFlags.chars = false;
      dirtyFlags.particles = false;
      dirtyFlags.ui = false;
    }

    function tick(timestamp) {
      if (!hasDirty()) {
        idleFrames++;
        if (idleFrames > IDLE_THRESHOLD) {
          idle = true;
        }
        return false;
      }

      // Dirty flags are set — produce a frame
      var layers = collectDirtyLayers();
      clearFlags();
      idleFrames = 0;
      idle = false;

      if (frameCallback) {
        frameCallback(layers);
      }

      return true;
    }

    function onFrame(callback) {
      frameCallback = callback;
    }

    return {
      dirtyFlags: dirtyFlags,
      markDirty: markDirty,
      markAllDirty: markAllDirty,
      isIdle: isIdle,
      wake: wake,
      tick: tick,
      onFrame: onFrame
    };
  }

  window.RenderScheduler = { create: create };
})();
