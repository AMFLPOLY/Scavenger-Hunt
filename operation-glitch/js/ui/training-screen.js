/*
 * TRAINING SIMULATOR: hosts whichever simulation the mission has assigned, shows the
 * target and live progress, records his best run, and reports completion. If nothing is
 * assigned, it lists the simulations he has already passed.
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, fill } = OG.text;
  const ui = OG.ui;

  function progressText(game, value, target) {
    if (game.kind === 'blocks') return `SCORE ${value} / ${target}`;
    if (game.kind === 'snake') return `DATA NODES ${value} / ${target}`;
    return `LEVEL ${value} / ${target}`;
  }

  ui.TrainingScreen = function (ctx) {
    const { store, missions, config } = ctx;
    const t = config.training;
    const body = h('main', { class: 'screen-body training-body' });
    const el = h('div', { class: 'screen training' }, ui.TopBar(ctx, { title: 'TRAINING SIMULATOR', back: { view: 'hub', label: 'HUB' } }), body);

    let gameId = null;
    let instance = null;
    let finished = false;

    const allGames = () => missions.flatMap((m) => m.steps.filter((s) => s.type === 'game').map((s) => s.game));

    function stop() {
      if (instance) {
        try {
          instance.destroy();
        } catch (e) {
          /* already gone */
        }
      }
      instance = null;
    }

    function showList(state) {
      const seen = allGames().filter((g) => state.games[g.id]);
      const parts = [
        h('h1', { class: 'screen-title', tabIndex: -1 }, 'TRAINING SIMULATOR'),
        h('p', { class: 'screen-sub' }, 'NO SIMULATION ASSIGNED'),
        seen.length
          ? h(
              'div',
              { class: 'file-rows' },
              seen.map((g) =>
                h(
                  'div',
                  { class: 'file-row training-row' },
                  h('span', { class: 'file-code' }, state.games[g.id].done ? '✓ COMPLETE' : 'ASSIGNED'),
                  h('span', { class: 'file-title' }, rich(g.title)),
                  h('span', { class: 'file-meta' }, `TARGET: ${OG.handler.targetLabel(state, g)}`)
                )
              )
            )
          : null,
        ui.Button('OPEN COMMS', { variant: 'secondary', size: 'xl', onClick: () => ctx.go('comms') }),
      ];
      body.replaceChildren(...parts.filter(Boolean));
    }

    function showSuccess(game, value) {
      body.replaceChildren(
        h(
          'section',
          { class: 'term-screen term-success' },
          h('h1', { class: 'granted-stamp', tabIndex: -1 }, rich(t.complete)),
          h('p', { class: 'lock-node' }, rich(game.title)),
          h('ol', { class: 'term-feed' }, h('li', { class: 'is-ok' }, `> ${progressText(game, value, OG.game.gameTarget(store.getState(), game))}`), h('li', null, `> ${fill(config.terminal.afterSuccess)}`))
        ),
        ui.Button('OPEN COMMS', { size: 'xl', onClick: () => ctx.go('comms') })
      );
    }

    function showGame(game, state) {
      const target = OG.game.gameTarget(state, game);
      const best = (state.games[game.id] && state.games[game.id].best) || 0;
      const progress = h('span', { class: 'game-progress', 'aria-live': 'off' }, progressText(game, 0, target));
      const mount = h('div', { class: 'game-mount' });
      body.replaceChildren(
        h(
          'header',
          { class: 'lock-head training-head' },
          h('div', { class: 'lock-node' }, rich(t.kicker)),
          h('h1', { class: 'lock-prompt', tabIndex: -1 }, rich(game.title)),
          h(
            'div',
            { class: 'training-meta' },
            h('span', { class: 'training-target' }, `TARGET: ${OG.handler.targetLabel(state, game)}`),
            progress,
            best ? h('span', { class: 'training-best' }, `BEST ${best}`) : null
          )
        ),
        mount
      );

      const kind = OG.games[game.kind];
      if (!kind) {
        mount.append(h('p', { class: 'term-sub' }, 'This simulation is unavailable. Your handler can mark it complete.'));
        return;
      }
      try {
        instance = kind(mount, {
          target,
          labels: { start: t.start, restart: t.restart },
          onProgress: (value) => (progress.textContent = progressText(game, value, target)),
          onRunEnd: (value) => store.dispatch({ type: 'GAME_BEST', gameId: game.id, value }),
          onComplete: (value) => {
            finished = true;
            OG.sound.play('success');
            ui.vibrate([20, 40, 20]);
            store.dispatch({ type: 'GAME_BEST', gameId: game.id, value });
            store.dispatch({ type: 'GAME_COMPLETE', gameId: game.id, now: Date.now() });
            setTimeout(() => {
              stop();
              showSuccess(game, value);
            }, ui.reducedMotion() ? 200 : 1100);
          },
        });
      } catch (error) {
        console.error(error);
        mount.replaceChildren(
          h('p', { class: 'term-sub' }, 'SIMULATION FAULT. Tap to restart. If it keeps happening, your handler can mark it complete.'),
          ui.Button(t.restart, { size: 'xl', onClick: () => showGame(game, store.getState()) })
        );
      }
    }

    function update(state) {
      if (finished) return; // keep the success screen until he leaves
      const game = OG.game.activeGame(state, missions);
      const id = game ? game.id : null;
      if (id === gameId && body.firstChild) return; // never interrupt a running simulation
      stop();
      gameId = id;
      if (game) showGame(game, state);
      else showList(state);
    }

    update(store.getState());

    return { el, update, destroy: stop };
  };
})();
