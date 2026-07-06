(function () {
  'use strict';

  var FULL = 3;
  var REDUCED = 2;
  var MINIMAL = 1;

  var BUFFER_SIZE = 60;
  var COOLDOWN_SAMPLES = 300;

  function create(options) {
    var buffer = new Float64Array(BUFFER_SIZE);
    var writeIdx = 0;
    var tier = FULL;
    var locked = false;
    var cooldown = 0;
    var windowScores = [0, 0];
    var effectManager = null;

    function evaluate() {
      if (locked) return;
      if (cooldown > 0) return;

      // Compute average of all 60 samples
      var sum = 0;
      for (var i = 0; i < BUFFER_SIZE; i++) {
        sum += buffer[i];
      }
      var avg = sum / BUFFER_SIZE;

      // Shift window scores
      windowScores[0] = windowScores[1];
      windowScores[1] = avg;

      // Check for tier downgrade (frames too slow)
      if (windowScores[0] > 16 && windowScores[1] > 16 && tier > MINIMAL) {
        tier -= 1;
        cooldown = COOLDOWN_SAMPLES;
        if (effectManager) effectManager.setTier(tier);
      }
      // Check for tier upgrade (frames fast enough)
      else if (windowScores[0] < 12 && windowScores[1] < 12 && tier < FULL) {
        tier += 1;
        cooldown = COOLDOWN_SAMPLES;
        if (effectManager) effectManager.setTier(tier);
      }
    }

    function sample(frameDurationMs) {
      buffer[writeIdx] = frameDurationMs;
      writeIdx = (writeIdx + 1) % BUFFER_SIZE;

      if (cooldown > 0) {
        cooldown--;
      }

      // Evaluate every time writeIdx wraps to 0
      if (writeIdx === 0) {
        evaluate();
      }
    }

    function currentTier() {
      return tier;
    }

    function forceTier(n) {
      tier = n;
      locked = true;
      if (effectManager) effectManager.setTier(tier);
    }

    function setEffectManager(em) {
      effectManager = em;
    }

    return {
      sample: sample,
      currentTier: currentTier,
      forceTier: forceTier,
      setEffectManager: setEffectManager,
      get tier() { return tier; }
    };
  }

  window.PerfDetect = { create: create, FULL: FULL, REDUCED: REDUCED, MINIMAL: MINIMAL };
})();
