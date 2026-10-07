/*
 * The handler's voice for everything that isn't in a mission script: replies to the
 * quick-response buttons, hints, and wrong-key remarks. All scripted (from game-config.js
 * and the locks), so it works offline and the same way every time.
 *
 * Future live-AI idea: give `respond` a smarter implementation that falls back to these
 * scripted lines when offline. Nothing else needs to change.
 */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  let cfg = null;
  let missions = [];

  const pick = (list, i) => (list.length ? list[i % list.length] : '');
  const say = (text, extra) => ({ kind: 'handler', text, ...extra });

  /** What a hint request is about: the active lock, or an ask step that has its own hints. */
  function hintTarget(state) {
    const lock = OG.game.activeLock(state, missions);
    if (lock) return lock;
    const ask = OG.game.activeAsk(state, missions);
    return ask && ask.hints.length ? ask : null;
  }

  function objectiveText(state) {
    const goal = OG.game.objective(state, missions);
    if (!goal) return '';
    if (goal.game) return `Complete the ${goal.game.title} simulation in the Training Simulator. Target: ${targetLabel(state, goal.game)}.`;
    if (goal.complete) return OG.text.fill(cfg.system.operationComplete);
    return goal.text || '';
  }

  /** "2000 POINTS", "20 DATA NODES", "LEVEL 23" */
  function targetLabel(state, game) {
    const target = OG.game.gameTarget(state, game);
    return game.kind === 'climber' ? `LEVEL ${target}` : `${target} ${game.unit}`;
  }

  OG.handler = {
    init(config, missionList) {
      cfg = config;
      missions = missionList;
    },

    objectiveText,
    hintTarget,
    targetLabel,

    /** Hints still available for whatever he is working on now. */
    hintsLeft(state) {
      const target = hintTarget(state);
      return target ? Math.max(0, target.hints.length - (state.hintsUsed[target.id] || 0)) : 0;
    },

    /** The four standard Comms buttons. */
    standardReplies() {
      return [
        { id: 'understood', label: cfg.replies.understood },
        { id: 'clarify', label: cfg.replies.clarify },
        { id: 'found', label: cfg.replies.found },
        { id: 'hint', label: cfg.replies.hint },
      ];
    },

    /** Build the REPLY action payload for a standard button. */
    respond(id, state) {
      const label = (this.standardReplies().find((r) => r.id === id) || {}).label || id;
      const lock = OG.game.activeLock(state, missions);
      const said = state.log.filter((e) => e.kind === 'agent').length;

      switch (id) {
        case 'understood':
          return { label, responses: [say(pick(cfg.handler.acknowledgements, said))] };
        case 'clarify': {
          const goal = objectiveText(state);
          return { label, responses: [say(goal ? OG.text.fill(cfg.handler.clarification, { objective: goal }) : cfg.handler.nothingToClarify)] };
        }
        case 'found':
          return { label, responses: [lock ? say(cfg.handler.foundSomething, { link: 'terminal' }) : say(cfg.handler.foundNothing)] };
        case 'hint': {
          const target = hintTarget(state);
          if (!target && OG.game.activeGame(state, missions)) return { label, responses: [say(cfg.handler.trainingHint)] };
          if (!target) return { label, responses: [say(cfg.handler.noHintTarget)] };
          const used = state.hintsUsed[target.id] || 0;
          if (used >= target.hints.length) return { label, responses: [say(cfg.handler.noHintsLeft)] };
          const quip = target.hintQuips[used] || pick(cfg.handler.hintQuips, used);
          return {
            label,
            hintFor: target.id,
            responses: [quip ? say(quip) : null, { kind: 'hint', text: target.hints[used], n: used + 1, total: target.hints.length }].filter(Boolean),
          };
        }
        default:
          return { label, responses: [] };
      }
    },

    /** REPLY payload for one of an ask step's own buttons. */
    answerAsk(step, label) {
      const response = step.responses[label];
      return { label, ask: step.key, responses: response ? [say(String(response))] : [] };
    },

    /**
     * Handler remark in the Access Terminal after a wrong key.
     * attempt: wrong keys on this lock (1-based); totalWrong: across the whole operation,
     * so the general lines keep rotating through the day instead of restarting per lock.
     */
    wrongRemark(lock, attempt, hintsLeft, totalWrong) {
      const own = lock.wrong;
      const general = cfg.handler.wrongAnswer.filter((m) => !own.includes(m));
      const pool = general.length ? general : own;
      let line = attempt <= own.length ? own[attempt - 1] : pick(pool, Math.max(0, (totalWrong || attempt) - 1));
      const every = Number(cfg.handler.suggestHintAfterWrong) || 0;
      if (every > 0 && hintsLeft > 0 && attempt % every === 0 && cfg.handler.suggestHint) line = cfg.handler.suggestHint;
      return line || '';
    },
  };
})();
