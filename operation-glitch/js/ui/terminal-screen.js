/*
 * ACCESS TERMINAL: where keys, codes and sequences are authenticated.
 * Shows the active lock with the right input mode, a short feed of system output,
 * and a cosmetic trace-risk meter. Wrong attempts are unlimited.
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, fill } = OG.text;
  const ui = OG.ui;

  const CONNECT_LINE_MS = 260;
  const AUTH_MS = 550;
  const GRANTED_PAUSE_MS = 750;
  const FEED_LINES = 5;

  const pick = (list, i) => (list.length ? list[i % list.length] : '');

  ui.TerminalScreen = function (ctx) {
    const { config, store, missions } = ctx;
    const t = config.terminal;

    const body = h('main', { class: 'screen-body terminal-body' });
    const el = h('div', { class: 'screen terminal' }, ui.TopBar(ctx, { title: 'ACCESS TERMINAL', back: { view: 'hub', label: 'HUB' } }), body);

    let lockId = null;
    let input = null;
    let feed = null;
    let traceEl = null;
    let busy = false;
    let justSolved = null;
    let connecting = null;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    function say(text, tone = '') {
      if (!feed) return;
      feed.append(h('li', { class: tone ? 'is-' + tone : '' }, rich(text)));
      while (feed.children.length > FEED_LINES) feed.firstElementChild.remove();
    }

    function clearLock() {
      if (input) input.destroy();
      if (connecting) connecting.cancel();
      input = null;
      feed = null;
      connecting = null;
      busy = false;
      timers.forEach(clearTimeout);
      timers.clear();
    }

    function traceRisk(state, lock) {
      const wrong = state.wrongAttempts[lock.id] || 0;
      return Math.min(97, 12 + wrong * 11);
    }

    function showIdle(state) {
      const game = OG.game.activeGame(state, missions);
      if (game) {
        // A training simulation is the current assignment: point him at it.
        body.replaceChildren(
          h(
            'section',
            { class: 'term-screen term-idle' },
            h('h1', { class: 'sr-only', tabIndex: -1 }, 'Access Terminal'),
            h(
              'ol',
              { class: 'term-feed' },
              h('li', { class: 'is-warn' }, `> ${fill(config.system.trainingAssigned)}`),
              h('li', null, `> ${fill(game.title)}`),
              h('li', { class: 'is-dim' }, `> TARGET: ${OG.handler.targetLabel(state, game)}`)
            )
          ),
          ui.Button(config.training.launch, { size: 'xl', onClick: () => ctx.go('training') })
        );
        return;
      }
      body.replaceChildren(
        h('h1', { class: 'sr-only', tabIndex: -1 }, 'Access Terminal'),
        h(
          'section',
          { class: 'term-screen term-idle' },
          h('ol', { class: 'term-feed' }, h('li', null, `> ${fill(t.idle)}`), h('li', { class: 'is-dim' }, `> LOCKS BREACHED: ${state.solved.length}`)),
          h('p', { class: 'term-sub' }, rich(t.idleSub))
        ),
        ui.Button('OPEN COMMS', { variant: 'secondary', size: 'xl', onClick: () => ctx.go('comms') })
      );
    }

    function showSuccess(lock) {
      body.replaceChildren(
        h(
          'section',
          { class: 'term-screen term-success' },
          h('h1', { class: 'granted-stamp', tabIndex: -1 }, rich(t.granted)),
          lock.node ? h('p', { class: 'lock-node' }, rich(lock.node)) : null,
          h('ol', { class: 'term-feed' }, h('li', { class: 'is-ok' }, `> ${fill(t.decrypting)} DONE`), h('li', null, `> ${fill(t.afterSuccess)}`))
        ),
        ui.Button('OPEN COMMS', { size: 'xl', onClick: () => ctx.go('comms') })
      );
    }

    function askForHint() {
      const reply = OG.handler.respond('hint', store.getState());
      ctx.go('comms');
      store.dispatch({ type: 'REPLY', now: Date.now(), ...reply });
    }

    function attempt(lock, value) {
      if (busy) return;
      const verdict = OG.answers.checkLock(lock, value, config);
      if (verdict === 'empty') {
        say(t.emptyKey, 'warn');
        input.wrong();
        return;
      }
      busy = true;
      input.setBusy(true);
      say(t.authenticating, 'pending');
      OG.sound.play('beep');

      later(() => {
        if (verdict === 'wrong') {
          store.dispatch({ type: 'WRONG', lockId: lock.id });
          const state = store.getState();
          const attempts = state.wrongAttempts[lock.id] || 1;
          say(pick(t.denied, attempts - 1), 'error');
          const totalWrong = OG.game.stats(state, missions).wrong;
          const remark = OG.handler.wrongRemark(lock, attempts, lock.hints.length - (state.hintsUsed[lock.id] || 0), totalWrong);
          if (remark) say(`${config.handler.name}: ${remark}`, 'handler');
          traceEl.textContent = `${fill(t.trace)}: ${traceRisk(state, lock)}%`;
          input.wrong();
          OG.sound.play('error');
          ui.vibrate(40);
          el.classList.remove('is-interference');
          void el.offsetWidth;
          el.classList.add('is-interference');
          busy = false;
          input.setBusy(false);
          return;
        }
        say(t.granted, 'ok');
        say(t.decrypting, 'pending');
        OG.sound.play('success');
        ui.vibrate([20, 40, 20]);
        later(() => {
          justSolved = lock;
          store.dispatch({
            type: 'SOLVE',
            lockId: lock.id,
            override: verdict === 'override',
            overrideText: verdict === 'override' ? config.handler.overrideMessage : null,
            now: Date.now(),
          });
        }, ui.reducedMotion() ? 300 : GRANTED_PAUSE_MS);
      }, ui.reducedMotion() ? 200 : AUTH_MS);
    }

    function showLock(lock, state) {
      feed = h('ol', { class: 'term-feed', role: 'log', 'aria-live': 'polite' });
      traceEl = h('span', null, `${fill(t.trace)}: ${traceRisk(state, lock)}%`);
      input = ui.terminalInput(ctx, lock, (value) => attempt(lock, value));

      // Optional pieces may be null; filter them out so nothing stray is shown.
      const parts = [
        h(
          'header',
          { class: 'lock-head' },
          lock.node ? h('div', { class: 'lock-node' }, rich(lock.node)) : null,
          h('h1', { class: 'lock-prompt', tabIndex: -1 }, rich(lock.prompt)),
          lock.instructions ? h('p', { class: 'term-sub' }, rich(lock.instructions)) : null
        ),
        // Contact locks repeat the exact phrase to send, so he never has to scroll back for it.
        lock.contact ? ui.ContactCard(ctx, lock.contact, { inTerminal: true }) : null,
        // Back-to-front text, meant to be read in a mirror.
        lock.mirror
          ? h(
              'section',
              { class: 'mirror-panel', 'aria-label': 'Reversed transmission. Read it in a mirror.' },
              h('div', { class: 'panel-label' }, 'REVERSED TRANSMISSION · READ IN A MIRROR'),
              h('div', { class: 'mirror-text', 'aria-hidden': 'true' }, lock.mirror)
            )
          : null,
        h('section', { class: 'term-screen' }, feed),
        input.el,
        h('div', { class: 'term-statusbar' }, traceEl, h('span', null, rich(t.attempts))),
        lock.hints.length ? h('button', { type: 'button', class: 'link-btn', onClick: askForHint }, rich(t.askForHint)) : null,
      ];
      body.replaceChildren(...parts.filter(Boolean));

      // The connection sequence plays once per lock per visit; after that, one line.
      const lines = OG.text.paras(t.connecting);
      if (!ctx.transient.connected.has(lock.id) && lines.length) {
        ctx.transient.connected.add(lock.id);
        connecting = ui.reveal(lines.length, CONNECT_LINE_MS, (i) => say(lines[i], i === lines.length - 1 ? 'ok' : 'dim'));
      } else if (lines.length) {
        say(lines[lines.length - 1], 'ok');
      }
    }

    function update(state) {
      const lock = OG.game.activeLock(state, missions);
      if (justSolved) {
        if (lockId === justSolved.id) {
          clearLock();
          lockId = null;
          showSuccess(justSolved);
        }
        // Stay on "ACCESS GRANTED" until he leaves, or until the next lock comes online.
        if (!lock || lock.id === justSolved.id) return;
        justSolved = null;
      }
      const game = lock ? null : OG.game.activeGame(state, missions);
      const id = lock ? lock.id : game ? `game:${game.id}` : null;
      if (id === lockId && body.firstChild) return;
      clearLock();
      lockId = id;
      if (lock) showLock(lock, state);
      else showIdle(state);
    }

    update(store.getState());

    return {
      el,
      update,
      destroy: clearLock,
    };
  };
})();
