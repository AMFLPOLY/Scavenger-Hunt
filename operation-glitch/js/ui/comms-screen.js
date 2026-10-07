/*
 * COMMS: the secure channel between the agent and his handler.
 * Handler messages (personality), system notices (technical), field-task cards,
 * and his quick replies. The thread is the saved log; new entries are appended live.
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, fill, clock, pad } = OG.text;
  const ui = OG.ui;

  const NEAR_BOTTOM_PX = 220;

  /** Wording for a system notice, plus an optional action button. */
  function systemNotice(ctx, entry) {
    const s = ctx.config.system;
    switch (entry.code) {
      case 'keyAccepted':
        return { text: s.keyAccepted + (entry.override ? ` · ${s.commandOverride}` : ''), tone: 'ok' };
      case 'file': {
        const file = ui.fileById(ctx, entry.fileId);
        return { text: `${s.fileUnlocked}: ${file ? `${file.code} · ${file.title}` : entry.fileId}`, action: ['OPEN FILE', () => ctx.go('files', entry.fileId)] };
      }
      case 'tool': {
        const tool = ctx.config.tools[entry.tool];
        return { text: `${s.toolOnline}: ${tool ? tool.label : entry.tool}`, action: tool ? ['OPEN', () => ctx.go(entry.tool)] : null };
      }
      case 'clearance':
        return { text: `${s.clearanceUpdated}: ${ui.clearanceLabel(ctx, entry.level)}`, tone: 'ok' };
      case 'evidence':
        return { text: `${s.evidenceLogged}: ${entry.text}`, action: ['EVIDENCE LOCKER', () => ctx.go('files', 'evidence')] };
      case 'missionComplete':
        return { text: fill(s.missionComplete, { n: pad(entry.n) }), tone: 'ok' };
      case 'gameComplete': {
        const game = ui.gameById(ctx, entry.gameId);
        return { text: `${s.trainingComplete}: ${game ? game.title : entry.gameId}`, tone: 'ok' };
      }
      case 'operationComplete':
        return { text: s.operationComplete, tone: 'ok', action: ['VIEW FIELD REPORT', () => ctx.go('report')] };
      case 'jumped':
        return { text: fill(s.jumped, { n: typeof entry.n === 'number' ? pad(entry.n) : entry.n }), tone: 'warn' };
      default:
        return { text: entry.text || '' };
    }
  }

  function renderEntry(ctx, entry) {
    const time = clock(entry.time || entry.at);
    const handlerName = ctx.config.handler.name;

    switch (entry.kind) {
      case 'mission': {
        const mission = ui.missionById(ctx, entry.missionId);
        if (!mission) return null;
        const n = pad(ui.missionNumber(ctx, entry.missionId));
        return h(
          'div',
          { class: 'thread-group', role: 'separator' },
          h('span', { class: 'group-kicker' }, rich(mission.phase ? `${mission.phase} · MISSION ${n}` : `MISSION ${n}`)),
          h('span', { class: 'group-title' }, rich(mission.title))
        );
      }
      case 'handler':
      case 'hint': {
        const label = entry.kind === 'hint' ? `INTEL ${entry.n}/${entry.total}` : handlerName;
        return h(
          'article',
          { class: 'msg msg-handler' + (entry.kind === 'hint' ? ' msg-hint' : '') },
          h('header', null, h('span', { class: 'msg-from' }, rich(label)), h('time', null, time)),
          h('p', null, rich(entry.text)),
          entry.link === 'terminal' ? ui.ChipButton('OPEN ACCESS TERMINAL', () => ctx.go('terminal')) : null
        );
      }
      case 'agent':
        return h('article', { class: 'msg msg-agent' }, h('header', null, h('span', { class: 'msg-from' }, 'AGENT'), h('time', null, time)), h('p', null, rich(entry.text)));
      case 'task':
        return h(
          'article',
          { class: 'task-card' },
          h('header', null, h('span', { class: 'msg-from' }, 'FIELD TASK'), h('time', null, time)),
          h('p', null, rich(entry.text))
        );
      case 'game': {
        const game = ui.gameById(ctx, entry.gameId);
        if (!game) return null;
        return h(
          'article',
          { class: 'lock-card game-card' },
          h('header', null, h('span', { class: 'msg-from' }, ui.icon('training', 16), ` ${fill(ctx.config.system.trainingAssigned)}`), h('time', null, time)),
          h('p', { class: 'game-card-title' }, rich(game.title)),
          h('p', { class: 'lock-node' }, `TARGET: ${OG.handler.targetLabel(ctx.store.getState(), game)}`),
          ui.ChipButton(ctx.config.training.launch, () => ctx.go('training'))
        );
      }
      case 'contact':
        return ui.ContactCard(ctx, entry.contactId, { time });
      case 'lock': {
        const lock = ui.lockById(ctx, entry.lockId);
        return h(
          'article',
          { class: 'lock-card' },
          h('header', null, h('span', { class: 'msg-from' }, ui.icon('lock', 16), ` ${fill(ctx.config.system.lockActive)}`), h('time', null, time)),
          lock && lock.node ? h('p', { class: 'lock-node' }, rich(lock.node)) : null,
          lock ? h('p', null, rich(lock.prompt)) : null,
          ui.ChipButton('OPEN ACCESS TERMINAL', () => ctx.go('terminal'))
        );
      }
      case 'system': {
        const notice = systemNotice(ctx, entry);
        return h(
          'div',
          { class: 'sys-line' + (notice.tone ? ' is-' + notice.tone : '') },
          h('p', null, h('span', { class: 'sys-text' }, rich(notice.text)), ' ', h('time', null, time)),
          notice.action ? ui.ChipButton(notice.action[0], notice.action[1]) : null
        );
      }
      default:
        return null;
    }
  }

  ui.CommsScreen = function (ctx) {
    const { store, missions, config } = ctx;

    const thread = h('div', { class: 'thread', role: 'log', 'aria-live': 'polite', 'aria-label': 'Messages' });
    const typing = h(
      'button',
      { type: 'button', class: 'typing', hidden: true, 'aria-label': 'Handler is typing. Tap to show now.', onClick: () => ctx.runner.flush() },
      h('span', { class: 'typing-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      `${fill(config.handler.name)} IS TYPING`
    );
    const replies = h('div', { class: 'reply-grid' });
    const dock = h('div', { class: 'dock comms-dock' }, replies);
    const body = h(
      'main',
      { class: 'screen-body comms-body' },
      h('div', { class: 'channel-bar' }, h('span', { class: 'ok-dot', 'aria-hidden': 'true' }), 'SECURE CHANNEL · END-TO-END ENCRYPTED'),
      h('h1', { class: 'sr-only', tabIndex: -1 }, 'Comms'),
      thread,
      typing
    );
    const el = h('div', { class: 'screen comms' }, ui.TopBar(ctx, { title: 'COMMS', back: { view: 'hub', label: 'HUB' } }), body, dock);

    let rendered = 0;
    let lastId = 0;
    let repliesKey = '';

    const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
    const scrollToEnd = (smooth) =>
      requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth && !ui.reducedMotion() ? 'smooth' : 'auto' }));

    function send(payload) {
      OG.sound.play('key');
      store.dispatch({ type: 'REPLY', now: Date.now(), ...payload });
      scrollToEnd(true);
    }

    function renderReplies(state) {
      const ask = OG.game.activeAsk(state, missions);
      const target = OG.handler.hintTarget(state);
      const hintsLeft = OG.handler.hintsLeft(state);
      const key = state.complete ? 'complete' : `${ask ? 'ask:' + ask.key : 'std'}:${target ? target.id : ''}:${hintsLeft}`;
      if (key === repliesKey) return;
      repliesKey = key;

      const hintLabel = (base) => (target ? `${base} (${hintsLeft})` : base);
      const standard = (reply) =>
        ui.Button(reply.id === 'hint' ? hintLabel(reply.label) : reply.label, { variant: 'reply', onClick: () => send(OG.handler.respond(reply.id, store.getState())) });

      if (state.complete) {
        replies.className = 'reply-grid is-single';
        replies.replaceChildren(ui.Button('VIEW FIELD REPORT', { size: 'xl', onClick: () => ctx.go('report') }));
        return;
      }
      if (ask) {
        replies.className = 'reply-grid is-ask';
        const buttons = ask.replies.map((label) => ui.Button(label, { size: 'xl', onClick: () => send(OG.handler.answerAsk(ask, label)) }));
        // An ask that hides a reasoning step also offers help.
        if (ask.hints.length) {
          const help = OG.handler.standardReplies().filter((r) => r.id === 'clarify' || r.id === 'hint');
          buttons.push(h('div', { class: 'reply-grid' }, help.map(standard)));
        }
        replies.replaceChildren(...buttons);
        return;
      }
      replies.className = 'reply-grid';
      replies.replaceChildren(...OG.handler.standardReplies().map(standard));
    }

    function renderThread(state) {
      const log = state.log;
      // A Game Master reset or another tab can rewrite history: start over.
      if (log.length < rendered || (rendered && log[rendered - 1] && log[rendered - 1].id !== lastId)) {
        thread.replaceChildren();
        rendered = 0;
      }
      if (rendered === log.length) return false;
      const wasNear = rendered === 0 || nearBottom();
      for (let i = rendered; i < log.length; i++) {
        const node = renderEntry(ctx, log[i]);
        if (node) {
          if (rendered > 0) node.classList.add('is-new');
          thread.append(node);
        }
      }
      rendered = log.length;
      lastId = log.length ? log[log.length - 1].id : 0;
      if (wasNear) scrollToEnd(rendered > 0);
      return true;
    }

    function markRead(state) {
      if (state.lastRead < state.log.length && document.visibilityState === 'visible') {
        setTimeout(() => store.dispatch({ type: 'MARK_READ', upTo: store.getState().log.length }), 0);
      }
    }

    function update(state) {
      renderThread(state);
      renderReplies(state);
      markRead(state);
    }

    const onTyping = (event) => {
      typing.hidden = !event.detail;
      if (event.detail && nearBottom()) scrollToEnd(true);
    };
    ctx.events.addEventListener('typing', onTyping);
    typing.hidden = !ctx.runner.isTyping();

    const state = store.getState();
    renderThread(state);
    renderReplies(state);
    markRead(state);
    scrollToEnd(false);

    return {
      el,
      update,
      scrollsToEnd: true,
      destroy: () => ctx.events.removeEventListener('typing', onTyping),
    };
  };
})();
