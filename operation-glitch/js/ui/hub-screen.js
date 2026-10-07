/*
 * Home screen: the Field Operations Terminal.
 * Agent dossier, current objective, the tool cards, and the System Status panel
 * (whose lines can hide a puzzle; see hub.statusLines in game-config.js).
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, fill } = OG.text;
  const ui = OG.ui;

  const TOOL_ORDER = ['comms', 'terminal', 'training', 'files', 'diagnostics', 'report'];

  ui.HubScreen = function (ctx) {
    const { config, store, missions } = ctx;

    const header = h('section', { class: 'hub-head' });
    const objective = h('section', { class: 'objective', 'aria-live': 'polite' });
    const tools = h('nav', { class: 'tool-grid', 'aria-label': 'Terminal tools' });
    const status = h(
      'section',
      { class: 'status-panel', 'aria-label': fill(config.hub.statusTitle) },
      h('div', { class: 'panel-label' }, rich(config.hub.statusTitle)),
      h('ul', null, config.hub.statusLines.map((line) => h('li', null, h('span', { class: 'ok-dot', 'aria-hidden': 'true' }), rich(line))))
    );
    const body = h('main', { class: 'screen-body hub-body' }, header, objective, tools, status);
    const el = h('div', { class: 'screen hub' }, ui.TopBar(ctx), body);

    function statusOf(state) {
      if (state.complete) return { value: 'OPERATION COMPLETE', tone: 'ok' };
      if (OG.game.activeGame(state, missions)) return { value: 'TRAINING', tone: 'warn' };
      return { value: 'ACTIVE', tone: 'ok' };
    }

    function toolCard(id, state, unlocked, attention) {
      const tool = config.tools[id];
      const isUnlocked = unlocked.has(id);
      if (!isUnlocked && tool.hiddenUntilUnlocked) return null;

      let meta = fill(tool.sub);
      let badge = null;
      if (isUnlocked && id === 'comms') {
        const unread = OG.game.unreadCount(state);
        if (unread) badge = `${unread} NEW`;
        if (ctx.runner && ctx.runner.isTyping()) meta = 'Incoming transmission...';
      }
      if (isUnlocked && id === 'terminal') {
        const lock = OG.game.activeLock(state, missions);
        if (lock) {
          meta = lock.node ? fill(lock.node) : '1 lock awaiting authentication';
          badge = '1 LOCK ACTIVE';
        }
      }
      if (isUnlocked && id === 'training') {
        const game = OG.game.activeGame(state, missions);
        if (game) {
          meta = `${fill(game.title)} · TARGET ${OG.handler.targetLabel(state, game)}`;
          badge = 'SIMULATION READY';
        } else {
          const done = Object.values(state.games).filter((g) => g.done).length;
          meta = `${done} simulation${done === 1 ? '' : 's'} passed`;
        }
      }
      if (isUnlocked && id === 'files') {
        const fresh = Object.values(state.files).filter((f) => !f.opened).length;
        const count = Object.keys(state.files).length + (state.evidence.length ? 1 : 0);
        meta = `${count} ${count === 1 ? 'item' : 'items'} on record`;
        if (fresh) badge = `${fresh} NEW`;
      }

      return h(
        'button',
        {
          type: 'button',
          class: 'tool-card' + (isUnlocked ? '' : ' is-locked') + (attention === id ? ' needs-attention' : ''),
          disabled: !isUnlocked,
          'aria-label': `${fill(tool.label)}${isUnlocked ? '' : ', locked'}${badge ? ', ' + badge : ''}`,
          onClick: () => {
            OG.sound.play('beep');
            ctx.go(id);
          },
        },
        h('span', { class: 'tool-icon' }, ui.icon(isUnlocked ? id : 'lock', 26)),
        h(
          'span',
          { class: 'tool-text' },
          h('span', { class: 'tool-label' }, rich(tool.label)),
          h('span', { class: 'tool-meta' }, isUnlocked ? meta : rich(tool.lockedNote || 'LOCKED'))
        ),
        badge ? h('span', { class: 'tool-badge' }, badge) : null
      );
    }

    /** The one place he should go next, so he never wonders. */
    function attentionFor(state) {
      if (state.complete) return 'report';
      if (OG.game.unreadCount(state) || OG.game.activeAsk(state, missions)) return 'comms';
      if (OG.game.activeLock(state, missions)) return 'terminal';
      if (OG.game.activeGame(state, missions)) return 'training';
      return null;
    }

    function update(state) {
      const level = OG.game.clearanceLevel(state, config);
      const s = statusOf(state);
      const mission = missions[state.missionIndex];
      header.replaceChildren(
        h('div', { class: 'eyebrow' }, rich(config.terminalName)),
        h('h1', { class: 'hub-title', tabIndex: -1 }, rich(config.operationName)),
        ui.Dossier([
          { label: 'AGENT', value: config.husbandName },
          { label: 'CLEARANCE', value: ui.clearanceLabel(ctx, level) },
          { label: 'STATUS', value: s.value, tone: s.tone, dot: true },
        ]),
        h(
          'div',
          { class: 'hub-progress' },
          ui.MissionProgress(ctx, state),
          !state.complete && mission ? h('span', { class: 'phase' }, rich(mission.phase ? `${mission.phase} · ${mission.title}` : mission.title)) : null
        )
      );

      const goal = OG.handler.objectiveText(state);
      objective.replaceChildren(h('div', { class: 'panel-label' }, 'CURRENT OBJECTIVE'), h('p', null, goal ? rich(goal) : 'Stand by for instructions.'));

      const unlocked = OG.game.unlockedTools(state, config);
      const attention = attentionFor(state);
      tools.replaceChildren(...TOOL_ORDER.map((id) => toolCard(id, state, unlocked, attention)).filter(Boolean));
    }

    update(store.getState());
    const onTyping = () => update(store.getState());
    ctx.events.addEventListener('typing', onTyping);

    return {
      el,
      update,
      destroy: () => ctx.events.removeEventListener('typing', onTyping),
    };
  };

  ui.toolOrder = TOOL_ORDER; // the Game Master panel lists tools in the same order
})();
