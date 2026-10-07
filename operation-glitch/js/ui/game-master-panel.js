/*
 * Hidden Game Master control panel (for you, not him).
 * Open: hold the terminal name (top-left) for 2 seconds, or add #control to the address.
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { pad, plain } = OG.text;
  const ui = OG.ui;

  const RESET_CONFIRM_MS = 4000;

  ui.GameMasterPanel = function (ctx, onClose) {
    const { store, missions, files, config, problems, placeholderCount } = ctx;
    const n = missions.length;
    const storageOk = OG.storage.available();
    let showAnswers = false;
    let resetArmed = false;
    let resetTimer = 0;
    let notice = '';
    let draft = '';
    let draftKind = 'handler';
    let link = '';

    const inner = h('div', { class: 'gm-inner' });
    const el = h('div', { class: 'gm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gm-title' }, inner);

    const say = (message) => {
      notice = message;
      render();
    };

    const button = (id, label, onClick, { disabled = false, variant = '', current = false } = {}) =>
      h(
        'button',
        {
          type: 'button',
          class: 'gm-btn' + (variant ? ' gm-btn-' + variant : ''),
          dataset: { gm: id },
          disabled,
          'aria-current': current ? 'step' : null,
          onClick: () => {
            notice = '';
            onClick();
          },
        },
        label
      );

    const card = (title, ...children) => h('section', { class: 'gm-card' }, h('div', { class: 'gm-label' }, title), ...children);

    function describe(state) {
      if (!state.activated) return { title: 'Activation screen (not started)', detail: '' };
      if (state.complete) return { title: 'Operation complete', detail: 'The Field Report is unlocked.' };
      const mission = missions[state.missionIndex];
      const title = `Mission ${state.missionIndex + 1} of ${n} · ${plain(mission.title)}`;
      const step = OG.game.currentStep(state, missions);
      if (state.outbox.length) return { title, detail: `Delivering ${state.outbox.length} queued message(s) in Comms.` };
      if (!step) return { title, detail: 'Finishing this mission.' };
      const waiting = state.announced;
      switch (step.type) {
        case 'lock':
          return { title, detail: `${waiting ? 'Waiting for him to open' : 'About to activate'} lock "${step.lock.id}" (${step.lock.type}).` };
        case 'ask':
          return { title, detail: `${waiting ? 'Waiting for his reply' : 'About to ask'}: ${step.replies.join(' / ')}` };
        case 'game':
          return { title, detail: `${waiting ? 'Waiting for him to finish' : 'About to assign'} training "${plain(step.game.title)}" (target ${OG.game.gameTarget(state, step.game)}).` };
        default:
          return { title, detail: `Delivering step ${state.stepIndex + 1} of ${mission.steps.length} (${step.type}).` };
      }
    }

    function position(state) {
      if (!state.activated) return -1;
      return state.complete ? n : state.missionIndex;
    }

    async function copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        say('Copied.');
      } catch (e) {
        say('Copy failed. Press and hold the text to copy it instead.');
      }
    }

    async function share(text) {
      try {
        await navigator.share({ text });
      } catch (e) {
        /* cancelled */
      }
    }

    function makeLink(payload, description) {
      link = OG.remote.link(payload);
      say(`Link ready: ${description}. Text it to him; it works once.`);
    }

    function render() {
      const focusedId = el.contains(document.activeElement) ? document.activeElement.dataset.gm : null;
      const state = store.getState();
      const pos = position(state);
      const lock = OG.game.activeLock(state, missions) || (OG.game.currentStep(state, missions) || {}).lock || null;
      const currentStep = OG.game.currentStep(state, missions);
      const stats = OG.game.stats(state, missions);
      const now = describe(state);

      const header = h(
        'div',
        { class: 'gm-header' },
        h('div', null, h('h2', { id: 'gm-title', tabIndex: -1 }, 'Game Master'), h('div', { class: 'gm-sub' }, 'Emergency override · hidden from the player')),
        button('close', 'Close ✕', onClose, { variant: 'ghost' })
      );

      const status = card(
        'Now',
        h('div', { class: 'gm-big' }, now.title),
        now.detail ? h('div', { class: 'gm-line' }, now.detail) : null,
        h('div', { class: 'gm-line gm-dim' }, `Hints used: ${stats.hints} · Wrong keys: ${stats.wrong} · Clearance ${OG.game.clearanceLevel(state, config)}`),
        storageOk ? null : h('div', { class: 'gm-warn' }, 'This browser is not saving progress (private browsing?). A refresh would restart the game.'),
        notice ? h('div', { class: 'gm-notice', role: 'status' }, notice) : null
      );

      const controls = card(
        'Controls',
        h(
          'div',
          { class: 'gm-grid' },
          button('back', '◀ Previous mission', () => store.dispatch({ type: 'JUMP', index: Math.max(0, pos - 1), now: Date.now() }), { disabled: pos <= 0 }),
          button('next', 'Complete mission ▶', () => {
            store.dispatch({ type: 'JUMP', index: Math.max(0, pos + 1), now: Date.now() });
            say(pos + 1 >= n ? 'Operation marked complete.' : `Mission ${pos + 1} marked complete. Mission ${pos + 2} is active.`);
          }, { disabled: pos >= n }),
          button('skip', 'Skip current step', () => {
            if (!state.activated) store.dispatch({ type: 'ACTIVATE', now: Date.now() });
            store.dispatch({ type: 'SKIP_STEP', now: Date.now() });
            say('Current step skipped.');
          }, { disabled: state.complete }),
          button('hint', 'Send next hint', () => {
            store.dispatch({ type: 'REPLY', now: Date.now(), silent: true, ...OG.handler.respond('hint', state) });
            say('Hint sent to his Comms.');
          }, { disabled: !OG.handler.hintsLeft(state) }),
          button('final', 'Unlock final mission', () => {
            store.dispatch({ type: 'JUMP', index: n - 1, now: Date.now() });
            say(`Mission ${n} is active.`);
          }, { disabled: pos === n - 1 })
        )
      );

      // ── Training simulations ──
      const training = card(
        'Training simulations',
        ...ctx.games.map((game) => {
          const record = state.games[game.id];
          const step = currentStep && currentStep.type === 'game' && currentStep.game.id === game.id;
          const status = record && record.done ? '✓ COMPLETE' : step ? 'IN PROGRESS' : record ? 'ASSIGNED' : 'NOT REACHED';
          const target = OG.game.gameTarget(state, game);
          const targetInput = h('input', {
            type: 'number',
            min: 1,
            class: 'gm-number',
            value: String(target),
            'aria-label': `Target for ${plain(game.title)}`,
            dataset: { gm: `target-input-${game.id}` },
          });
          return h(
            'div',
            { class: 'gm-item' },
            h('div', { class: 'gm-row' }, h('strong', null, plain(game.title)), h('span', { class: 'gm-small' + (record && record.done ? ' gm-ok' : ' gm-dim') }, status)),
            h('div', { class: 'gm-dim gm-small' }, `Target ${OG.handler.targetLabel(state, game)} · best run ${(record && record.best) || 0}`),
            h(
              'div',
              { class: 'gm-row gm-row-wrap' },
              targetInput,
              button(`target-${game.id}`, 'Set target', () => {
                store.dispatch({ type: 'GAME_TARGET', gameId: game.id, target: targetInput.value });
                say(`Target for ${plain(game.title)} set to ${targetInput.value}. It applies the next time the simulation opens.`);
              }, { variant: 'small' })
            ),
            h(
              'div',
              { class: 'gm-grid' },
              button(`game-done-${game.id}`, 'Mark training complete', () => {
                store.dispatch({ type: 'GAME_COMPLETE', gameId: game.id, now: Date.now() });
                say(`${plain(game.title)} marked complete.`);
              }, { disabled: !!(record && record.done) }),
              button(`game-reset-${game.id}`, 'Reset game', () => {
                store.dispatch({ type: 'GAME_RESET', gameId: game.id });
                say(`${plain(game.title)} reset.`);
              }, { disabled: !record })
            )
          );
        })
      );

      // ── Contact authorizations ──
      const contactLocks = ctx.locks.filter((l) => l.contact);
      const contacts = card(
        'Contact authorizations',
        ...contactLocks.map((l) => {
          const contact = config.contacts[l.contact] || {};
          const solved = state.solved.includes(l.id);
          const waiting = OG.game.activeLock(state, missions) === l;
          return h(
            'div',
            { class: 'gm-item' },
            h('div', { class: 'gm-row' }, h('strong', null, plain(contact.name || l.contact)), h('span', { class: 'gm-small' + (solved ? ' gm-ok' : ' gm-dim') }, solved ? '✓ AUTHORIZED' : waiting ? 'WAITING FOR REPLY' : 'NOT REACHED')),
            h('div', { class: 'gm-small' }, 'He texts: ', h('strong', null, contact.phrase || '')),
            h('div', { class: 'gm-small' }, 'Reply: ', h('strong', null, contact.reply || '')),
            button(`authorize-${l.contact}`, `Authorize ${plain(contact.name || l.contact)}`, () => {
              store.dispatch({ type: 'SOLVE', lockId: l.id, override: true, now: Date.now() });
              say(`${plain(contact.name || l.contact)} authorization accepted.`);
            }, { disabled: !waiting })
          );
        }),
        h('p', { class: 'gm-dim gm-small' }, 'Authorize is available while he is waiting on that contact. To get there sooner, use Jump to mission.')
      );

      const jump = card(
        'Jump to mission',
        h(
          'div',
          { class: 'gm-jump' },
          missions.map((m, i) => button(`jump-${i}`, String(i + 1), () => store.dispatch({ type: 'JUMP', index: i, now: Date.now() }), { current: pos === i })),
          button('jump-end', 'End', () => store.dispatch({ type: 'JUMP', index: n, now: Date.now() }), { current: pos === n })
        ),
        h('p', { class: 'gm-dim gm-small' }, 'Jumping applies every unlock from earlier missions (files, tools, clearance, evidence) and restarts the chosen mission. Comms history and stats are kept.')
      );

      const answers = card(
        'Expected answers',
        h(
          'div',
          { class: 'gm-row' },
          h('span', { class: 'gm-dim gm-small' }, showAnswers ? 'Shown' : 'Hidden, in case he is looking over your shoulder.'),
          button('answers', showAnswers ? 'Hide' : 'Show', () => {
            showAnswers = !showAnswers;
            render();
          }, { variant: 'small' })
        ),
        showAnswers && lock ? h('div', { class: 'gm-line' }, `Lock "${lock.id}" (${lock.type}): `, h('strong', null, lockAnswer(lock))) : null,
        showAnswers && currentStep && currentStep.type === 'ask' ? h('div', { class: 'gm-line' }, `Reply buttons: ${currentStep.replies.join(' / ')}`) : null,
        showAnswers && config.gameMaster.overrideCode
          ? h('p', { class: 'gm-small' }, 'Override code (opens any text lock): ', h('strong', null, config.gameMaster.overrideCode))
          : null
      );

      const message = card(
        'Send a message',
        h('textarea', {
          class: 'gm-textarea',
          rows: 3,
          placeholder: 'Type a message from the handler…',
          value: draft,
          dataset: { gm: 'draft' },
          onInput: (event) => (draft = event.target.value),
        }),
        h(
          'div',
          { class: 'gm-row gm-row-wrap' },
          h('label', { class: 'gm-radio' }, h('input', { type: 'radio', name: 'gm-kind', checked: draftKind === 'handler', onChange: () => (draftKind = 'handler') }), ' Handler'),
          h('label', { class: 'gm-radio' }, h('input', { type: 'radio', name: 'gm-kind', checked: draftKind === 'system', onChange: () => (draftKind = 'system') }), ' System notice')
        ),
        h(
          'div',
          { class: 'gm-grid' },
          button('send', 'Send on this phone', () => {
            if (!draft.trim()) return say('Type a message first.');
            store.dispatch({ type: 'INJECT', kind: draftKind, text: draft.trim() });
            draft = '';
            say('Sent. It will appear in his Comms.');
          }),
          button('make-link', 'Make a link to text him', () => {
            if (!draft.trim()) return say('Type a message first.');
            makeLink({ cmd: 'say', kind: draftKind, text: draft.trim() }, 'message');
          })
        ),
        h('p', { class: 'gm-dim gm-small' }, 'Remote links work from your own phone: send the link by text, and when he taps it, his terminal receives it.'),
        h('div', { class: 'gm-grid' }, button('link-skip', 'Link: skip his current step', () => makeLink({ cmd: 'skip' }, 'skip his current step'))),
        link
          ? h(
              'div',
              { class: 'gm-link' },
              h('code', null, link),
              h(
                'div',
                { class: 'gm-grid' },
                button('copy-link', 'Copy link', () => copy(link)),
                navigator.share ? button('share-link', 'Share…', () => share(link)) : null
              )
            )
          : null
      );

      const unlocks = card(
        'Unlock manually',
        h(
          'div',
          { class: 'gm-chips' },
          files.map((f) =>
            button(`file-${f.id}`, `${state.files[f.id] ? '✓ ' : ''}${plain(f.code)} ${plain(f.title)}`, () => store.dispatch({ type: 'UNLOCK_FILE', id: f.id, now: Date.now() }), {
              variant: 'chip',
              disabled: !!state.files[f.id],
            })
          )
        ),
        h(
          'div',
          { class: 'gm-chips' },
          ui.toolOrder
            .filter((id) => config.tools[id] && !config.tools[id].unlocked)
            .map((id) => {
              const has = OG.game.unlockedTools(state, config).has(id);
              return button(`tool-${id}`, `${has ? '✓ ' : ''}${plain(config.tools[id].label)}`, () => store.dispatch({ type: 'UNLOCK_TOOL', tool: id, now: Date.now() }), {
                variant: 'chip',
                disabled: has,
              });
            })
        )
      );

      const list = card(
        'All missions',
        h(
          'ol',
          { class: 'gm-list' },
          missions.map((m, i) => {
            const done = state.complete || i < state.missionIndex;
            const here = state.activated && !state.complete && i === state.missionIndex;
            const locks = m.steps.filter((s) => s.type === 'lock').map((s) => s.lock);
            return h(
              'li',
              { class: done ? 'is-done' : here ? 'is-here' : '' },
              h('span', { class: 'gm-mark', 'aria-hidden': 'true' }, done ? '✓' : here ? '▶' : '·'),
              h(
                'div',
                null,
                h('div', null, `${pad(i + 1)} ${plain(m.title)}`),
                h('div', { class: 'gm-dim gm-small' }, `${m.steps.length} steps · ${locks.length} lock${locks.length === 1 ? '' : 's'}`),
                locks.map((l) =>
                  h(
                    'div',
                    { class: 'gm-small' + (showAnswers ? ' gm-answers' : ' gm-dim') },
                    `${l.id} (${l.type}) · hints ${state.hintsUsed[l.id] || 0}/${l.hints.length} · wrong ${state.wrongAttempts[l.id] || 0}${showAnswers ? ' · ' + lockAnswer(l) : ''}`
                  )
                )
              )
            );
          })
        )
      );

      const warnings = problems.filter((p) => p.level === 'warning');
      const setup = card(
        'Setup check',
        h('p', { class: 'gm-small' }, placeholderCount ? `${placeholderCount} [PLACEHOLDER] markers still in the content files (highlighted yellow in the game).` : 'No placeholders left. Nice.'),
        warnings.length ? h('ul', { class: 'gm-small gm-problems' }, warnings.map((p) => h('li', null, p.message))) : null
      );

      const saved = JSON.stringify(state, null, 2);
      const inspect = card(
        'Saved progress',
        h('details', { class: 'gm-details' }, h('summary', null, `Inspect (${Math.round(saved.length / 1024)} KB, ${state.log.length} messages)`), h('pre', { class: 'gm-pre' }, saved)),
        button('copy-state', 'Copy saved progress', () => copy(saved), { variant: 'small' })
      );

      const danger = h(
        'section',
        { class: 'gm-card gm-danger' },
        h('div', { class: 'gm-label' }, 'Danger zone'),
        button('reset', resetArmed ? 'Tap again to erase all progress' : 'Reset entire game', () => {
          if (!resetArmed) {
            resetArmed = true;
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
              resetArmed = false;
              render();
            }, RESET_CONFIRM_MS);
            render();
            return;
          }
          clearTimeout(resetTimer);
          resetArmed = false;
          ctx.transient.connected.clear();
          store.dispatch({ type: 'RESET' });
          say('Game reset to the activation screen.');
        }, { variant: resetArmed ? 'armed' : 'danger' })
      );

      const footnote = h(
        'p',
        { class: 'gm-dim gm-small gm-foot' },
        'Progress is saved in this browser on this device only. Use the controls on his phone, or send him a link from yours. ',
        'Open this panel by holding the terminal name for 2 seconds, or by adding #control to the page address.'
      );

      inner.replaceChildren(...[header, status, controls, training, contacts, jump, answers, message, unlocks, list, setup, inspect, danger, footnote].filter(Boolean));
      if (focusedId) {
        const again = inner.querySelector(`[data-gm="${focusedId}"]`);
        if (again && !again.disabled) again.focus();
      }
    }

    function lockAnswer(lock) {
      if (lock.type === 'order') return lock.items.map((item, i) => `${i + 1}. ${plain(item)}`).join('  ');
      if (lock.type === 'sequence') return lock.sequence.join(' ');
      return lock.answers.join(' · ');
    }

    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }

    const unsubscribe = store.subscribe(() => {
      // Don't wipe a message she is typing.
      const typing = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.gm;
      if (typing && (typing === 'draft' || typing.startsWith('target-input-'))) return;
      render();
    });
    document.addEventListener('keydown', onKey);
    render();
    setTimeout(() => {
      const title = inner.querySelector('#gm-title');
      if (title) title.focus({ preventScroll: true });
    }, 0);

    return {
      el,
      destroy() {
        unsubscribe();
        clearTimeout(resetTimer);
        document.removeEventListener('keydown', onKey);
      },
    };
  };
})();
