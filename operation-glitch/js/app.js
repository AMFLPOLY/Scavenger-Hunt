/*
 * App start-up, navigation and the pieces that run on every screen
 * (message runner, "incoming transmission" toasts, Game Master panel, remote links).
 *
 * Screens live in the address (#/comms, #/terminal, #/files/<id> ...) so the phone's
 * back gesture moves between them instead of leaving the game.
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const ui = OG.ui;
  const root = document.getElementById('app');

  const TOAST_MS = 4500;

  /** Plain-English screen for content-file mistakes (only you should ever see this). */
  function showSetupProblems(problems) {
    const errors = problems.filter((p) => p.level === 'error');
    root.replaceChildren(
      h(
        'div',
        { class: 'screen setup-error' },
        h(
          'main',
          { class: 'screen-body' },
          h('div', { class: 'eyebrow' }, 'SETUP CHECK'),
          h('h1', { class: 'screen-title' }, 'The game files need a small fix'),
          h('p', null, 'This screen only appears when a content file has a mistake. Nothing is lost: fix the file, save it, and reload this page.'),
          h('ul', { class: 'problem-list' }, errors.map((p) => h('li', null, p.message))),
          h(
            'p',
            { class: 'dim' },
            'The usual cause is a missing comma or quote mark, on the line named above or the line just before it. Compare it with the lines around it.'
          )
        )
      )
    );
  }

  function start() {
    const loaded = OG.content.load();
    if (loaded.fatal) return showSetupProblems(loaded.problems);
    const { config, missions, files, locks, games } = loaded;

    OG.text.setTokens({
      husbandName: config.husbandName,
      partnerName: config.partnerName,
      age: config.age,
      birthdayDate: config.birthdayDate,
      operationName: config.operationName,
    });
    OG.text.setHighlight(config.highlightPlaceholders);
    OG.handler.init(config, missions);
    ui.hapticsOn = !!config.haptics;

    const soundKey = `${config.storageKey}:sound`;
    const savedSound = OG.storage.load(soundKey);
    OG.sound.setEnabled(typeof savedSound === 'boolean' ? savedSound : !!config.sound.startOn, false);

    const store = OG.game.createStore(missions, new Set(files.map((f) => f.id)), config.storageKey);
    const ctx = {
      config,
      missions,
      files,
      locks,
      games,
      store,
      soundKey,
      problems: loaded.problems,
      placeholderCount: loaded.placeholderCount,
      events: new EventTarget(), // 'typing'
      transient: { connected: new Set() }, // per-visit memory, not saved
      runner: null,
      go,
      openGameMaster,
    };

    // ── Navigation ──
    const SCREENS = {
      hub: () => ui.HubScreen(ctx),
      comms: () => ui.CommsScreen(ctx),
      terminal: () => ui.TerminalScreen(ctx),
      training: () => ui.TrainingScreen(ctx),
      files: (arg) => ui.FilesScreen(ctx, arg),
      diagnostics: () => ui.DiagnosticsScreen(ctx),
      report: () => ui.ReportScreen(ctx),
    };
    let route = { view: 'hub', arg: null };
    let screen = null;
    let screenKey = '';

    const hashFor = (view, arg) => (view === 'hub' ? '#/' : `#/${view}${arg ? '/' + encodeURIComponent(arg) : ''}`);
    const isControlHash = () => /^#\/?(control|gm)$/i.test(location.hash);

    function replaceHash(hash) {
      try {
        history.replaceState(null, '', hash);
      } catch (e) {
        location.replace(hash);
      }
    }

    function readRoute() {
      if (isControlHash() || OG.remote.isTransmission()) return route; // not a screen change
      const [view, arg] = location.hash.replace(/^#\/?/, '').split('/');
      return { view: SCREENS[view] ? view : 'hub', arg: arg ? decodeURIComponent(arg) : null };
    }

    function go(view, arg = null, { replace = false } = {}) {
      const hash = hashFor(view, arg);
      if (location.hash === hash || (view === 'hub' && location.hash === '')) return render();
      if (replace) {
        replaceHash(hash);
        render();
      } else {
        location.hash = hash; // → hashchange → render
      }
    }

    function render() {
      const state = store.getState();
      route = readRoute();
      let view = route.view;
      if (!state.activated) view = 'boot';
      else if (view !== 'hub' && !OG.game.unlockedTools(state, config).has(view)) view = 'hub';
      const key = view === 'files' ? `files:${route.arg || ''}` : view;

      if (screen && key === screenKey) {
        if (screen.update) screen.update(state);
        return;
      }
      if (screen && screen.destroy) screen.destroy();
      screenKey = key;
      screen = view === 'boot' ? ui.BootScreen(ctx) : SCREENS[view](route.arg);
      root.replaceChildren(screen.el);
      if (!screen.scrollsToEnd) window.scrollTo(0, 0);
      const heading = screen.el.querySelector('h1');
      if (heading && !gameMaster) heading.focus({ preventScroll: true });
    }

    // ── Incoming-transmission toast (when he is not in Comms) ──
    const toastButton = h('button', { type: 'button', class: 'toast-btn' });
    const toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true }, toastButton);
    document.body.append(toastEl);
    let toastTimer = 0;
    const hideToast = () => (toastEl.hidden = true);

    function toast(entry) {
      // Where the toast leads, and what it says.
      let view = 'comms';
      let icon = 'comms';
      let label = entry.kind === 'task' ? 'NEW FIELD TASK' : 'INCOMING TRANSMISSION';
      let preview = entry.text || '';
      if (entry.kind === 'lock') {
        const lock = ui.lockById(ctx, entry.lockId);
        view = 'terminal';
        icon = 'lock';
        label = config.system.lockActive;
        preview = (lock && (lock.node || lock.prompt)) || '';
      } else if (entry.kind === 'game') {
        const game = ui.gameById(ctx, entry.gameId);
        view = 'training';
        icon = 'training';
        label = config.system.trainingAssigned;
        preview = game ? game.title : '';
      } else if (entry.kind === 'contact') {
        const contact = config.contacts[entry.contactId];
        label = config.system.contactAssigned;
        preview = contact ? `Text ${contact.name}: ${contact.phrase}` : '';
      }
      preview = OG.text.plain(preview);
      toastButton.replaceChildren(h('span', { class: 'toast-label' }, ui.icon(icon, 18), OG.text.fill(label)));
      if (preview) toastButton.append(h('span', { class: 'toast-text' }, preview.length > 96 ? preview.slice(0, 93) + '…' : preview));
      toastButton.onclick = () => {
        hideToast();
        go(view);
      };
      toastEl.hidden = false;
      toastEl.classList.remove('is-in');
      void toastEl.offsetWidth;
      toastEl.classList.add('is-in');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, TOAST_MS);
    }

    // ── Message runner ──
    ctx.runner = OG.createRunner(store, missions, {
      onTyping: (on) => ctx.events.dispatchEvent(new CustomEvent('typing', { detail: on })),
      onDelivered(entries) {
        const incoming = entries.filter((e) => ['handler', 'hint', 'task', 'lock', 'game', 'contact'].includes(e.kind));
        if (!incoming.length) return;
        OG.sound.play('message');
        const latest = incoming[incoming.length - 1];
        const viewing =
          route.view === 'comms' || (latest.kind === 'lock' && route.view === 'terminal') || (latest.kind === 'game' && route.view === 'training');
        if (!viewing && store.getState().activated) {
          ui.vibrate(25);
          toast(latest);
        }
      },
    });

    // ── Game Master panel ──
    let gameMaster = null;

    function openGameMaster() {
      if (gameMaster) return;
      gameMaster = ui.GameMasterPanel(ctx, closeGameMaster);
      document.documentElement.classList.add('gm-open');
      document.body.append(gameMaster.el);
    }

    function closeGameMaster() {
      if (!gameMaster) return;
      gameMaster.destroy();
      gameMaster.el.remove();
      gameMaster = null;
      document.documentElement.classList.remove('gm-open');
      const params = new URLSearchParams(location.search);
      if (params.has('control') || params.has('gm')) {
        params.delete('control');
        params.delete('gm');
        const query = params.toString();
        replaceHash(`${location.pathname}${query ? '?' + query : ''}${hashFor(route.view, route.arg)}`);
      } else if (isControlHash()) {
        replaceHash(hashFor(route.view, route.arg));
      }
      render();
    }

    // ── Remote links (#transmit=...) ──
    function receiveTransmission() {
      if (!OG.remote.isTransmission()) return false;
      const t = OG.remote.fromLocation();
      replaceHash('#/comms');
      if (t && t.cmd === 'say') store.dispatch({ type: 'INJECT', kind: t.kind, text: t.text, transmissionId: t.id });
      else if (t) store.dispatch({ type: 'REMOTE', cmd: t.cmd, transmissionId: t.id, now: Date.now() });
      return true;
    }

    function onAddressChange() {
      if (receiveTransmission()) return render();
      const params = new URLSearchParams(location.search);
      if (isControlHash() || params.has('control') || params.has('gm')) openGameMaster();
      render();
    }

    store.subscribe(() => render());
    window.addEventListener('hashchange', onAddressChange);
    onAddressChange();

    // ── Offline support (only on a real web address; harmless if unsupported) ──
    const servedOnline = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && servedOnline) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  try {
    start();
  } catch (error) {
    console.error(error);
    showSetupProblems([{ level: 'error', message: `The app hit an unexpected error while starting: ${error && error.message}` }]);
  }
})();
