(function() {
  'use strict';

  var Ease = window.Ease;

  function create(character) {
    var frameClock = 0;
    var reaction = null;

    function getStatus() {
      return character.agent && character.agent.status || 'idle';
    }

    function isWalking() {
      return character.path && character.path.length > 0;
    }

    function isAtDesk() {
      return character.phase === 'atDesk';
    }

    function update(dt) {
      frameClock += dt;

      // Advance reaction timer
      if (reaction) {
        reaction.elapsed += dt;
        if (reaction.elapsed >= reaction.duration) {
          reaction = null;
        }
      }
    }

    function currentFrame() {
      if (isWalking()) {
        // Alternate walk1/walk2 at 6fps (~0.167s per frame)
        var walkIdx = Math.floor(frameClock / 0.167) % 2;
        return walkIdx === 0 ? 'walk1' : 'walk2';
      }

      var status = getStatus();

      if (isAtDesk()) {
        switch (status) {
          case 'working':
            // Alternate typing1/typing2 at 4fps (0.25s per frame)
            var typingIdx = Math.floor(frameClock / 0.25) % 2;
            return typingIdx === 0 ? 'typing1' : 'typing2';
          case 'thinking':
            return 'lean';
          case 'waiting':
            return 'stand';
          case 'idle':
            return 'sleep';
          default:
            return 'stand';
        }
      }

      return 'stand';
    }

    function currentBob() {
      // Reaction overrides normal bob
      if (reaction) {
        var progress = reaction.elapsed / reaction.duration;
        if (progress > 1) progress = 1;

        if (reaction.type === 'jump') {
          return -reaction.magnitude * Ease.easeOutBounce(1 - progress);
        }
        if (reaction.type === 'settle') {
          return reaction.magnitude * Ease.easeInQuad(progress);
        }
      }

      if (isWalking()) {
        return 0;
      }

      var status = getStatus();
      var animT = character.animT || 0;

      if (isAtDesk()) {
        switch (status) {
          case 'working':
            // Alternating -1/0 at 8fps
            var bobIdx = Math.floor(frameClock / 0.125) % 2;
            return bobIdx === 0 ? -1 : 0;
          case 'waiting':
            return Math.abs(Math.sin(animT * 5)) * -3;
          case 'thinking':
            return Math.sin(animT * Math.PI) * -1;
          case 'idle':
            return 0;
          default:
            return 0;
        }
      }

      return 0;
    }

    function isActive() {
      // Walking
      if (isWalking()) return true;

      // Reaction playing
      if (reaction) return true;

      // Cycling statuses
      var status = getStatus();
      if (status === 'working' || status === 'thinking' || status === 'waiting') {
        return true;
      }

      return false;
    }

    function onStatusChange(oldStatus, newStatus) {
      // working → waiting: upward jump
      if (oldStatus === 'working' && newStatus === 'waiting') {
        reaction = { type: 'jump', elapsed: 0, duration: 0.3, magnitude: 3 };
        return;
      }

      // * → idle: settle down
      if (newStatus === 'idle') {
        reaction = { type: 'settle', elapsed: 0, duration: 0.4, magnitude: 1 };
        return;
      }
    }

    return {
      update: update,
      currentFrame: currentFrame,
      currentBob: currentBob,
      isActive: isActive,
      onStatusChange: onStatusChange
    };
  }

  window.AnimState = { create: create };
})();
