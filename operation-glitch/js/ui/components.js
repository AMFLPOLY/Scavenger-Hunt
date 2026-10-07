/* Reusable UI building blocks. Screens are assembled from these. */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});
  const { h, svg } = OG.dom;
  const { rich, fill, pad } = OG.text;
  const ui = (OG.ui = OG.ui || {});

  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  ui.reducedMotion = () => !!(motionQuery && motionQuery.matches);

  ui.hapticsOn = false;
  ui.vibrate = (pattern) => {
    try {
      const activated = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (ui.hapticsOn && navigator.vibrate && activated) navigator.vibrate(pattern);
    } catch (e) {
      /* optional */
    }
  };

  const ICONS = {
    comms: '<path d="M4 5h16v11H10l-6 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12.5 15H17"/>',
    files: '<path d="M3 6.5h6l2 2h10V19H3z"/><path d="M3 10h18"/>',
    diagnostics: '<path d="M3 12h4l2.5-6 4.5 12 2.5-6H21"/>',
    report: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6v3H9zM8.5 11h7M8.5 15h5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    evidence: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.9 7.5 9.5 4.3-1.6 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    training: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  };
  ui.icon = (name, size = 22) =>
    svg(`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`);

  /** Fires `callback` after the element is held for `ms` (the secret Game Master entrance). */
  ui.onLongPress = function (el, ms, callback) {
    let timer = 0;
    const cancel = () => {
      clearTimeout(timer);
      timer = 0;
    };
    el.addEventListener('pointerdown', (event) => {
      if (event.button > 0) return;
      cancel();
      timer = setTimeout(() => {
        timer = 0;
        callback();
      }, ms);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => el.addEventListener(type, cancel));
    el.addEventListener('contextmenu', (event) => event.preventDefault());
  };

  /** Shows items one at a time; skip() reveals the rest instantly. */
  ui.reveal = function (count, interval, onItem, onDone) {
    let i = 0;
    let timer = 0;
    let finished = false;
    const done = () => {
      finished = true;
      if (onDone) onDone();
    };
    const next = () => {
      if (i < count) {
        onItem(i++);
        timer = setTimeout(next, interval);
      } else done();
    };
    const skip = () => {
      if (finished) return;
      clearTimeout(timer);
      while (i < count) onItem(i++);
      done();
    };
    const cancel = () => {
      clearTimeout(timer);
      finished = true;
    };
    if (ui.reducedMotion()) skip();
    else next();
    return { skip, cancel };
  };

  /** Button with decorative [ brackets ]. */
  ui.Button = function (label, { variant = 'primary', size = '', type = 'button', onClick, className = '' } = {}) {
    return h(
      'button',
      {
        type,
        class: ['btn', `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(' '),
        'aria-label': OG.text.plain(label),
        onClick,
      },
      h('span', { class: 'btn-bracket', 'aria-hidden': 'true' }, '['),
      h('span', { class: 'btn-label' }, rich(label)),
      h('span', { class: 'btn-bracket', 'aria-hidden': 'true' }, ']')
    );
  };
  ui.setButtonLabel = (button, label) => {
    button.setAttribute('aria-label', OG.text.plain(label));
    button.querySelector('.btn-label').replaceChildren(rich(label));
  };

  /** Small inline action inside Comms messages, e.g. [ OPEN FILE ]. */
  ui.ChipButton = (label, onClick) => h('button', { type: 'button', class: 'chip-btn', onClick }, rich(label));

  /** Text that flickers with brief signal interference now and then (never unreadable). */
  ui.GlitchText = function (text, level = 'none') {
    const plainText = OG.text.plain(text);
    const el = h(
      'span',
      { class: 'glitch', 'aria-hidden': 'true' },
      h('span', { class: 'glitch-main' }, rich(text)),
      h('span', { class: 'glitch-layer a' }, plainText),
      h('span', { class: 'glitch-layer b' }, plainText)
    );
    if (level !== 'none' && !ui.reducedMotion()) {
      const [min, max] = level === 'glitch-heavy' ? [3500, 7000] : [9000, 16000];
      let wasConnected = false;
      const loop = () => {
        if (!el.isConnected) {
          if (wasConnected) return;
        } else {
          wasConnected = true;
          el.classList.add('is-glitching');
          setTimeout(() => el.classList.remove('is-glitching'), 300);
        }
        setTimeout(loop, min + Math.random() * (max - min));
      };
      setTimeout(loop, 1500 + Math.random() * 2000);
    }
    return el;
  };

  /** Heading whose text can flicker; screen readers hear the title once. */
  ui.GlitchHeading = (className, text, level) =>
    h('h1', { class: className, tabIndex: -1, 'aria-label': OG.text.plain(text) }, ui.GlitchText(text, level));

  ui.Stamp = (text, tone = '') => h('span', { class: 'stamp' + (tone ? ' stamp-' + tone : '') }, rich(text));

  /** Labelled value rows like "AGENT: [NAME]". */
  ui.Dossier = (rows) =>
    h(
      'dl',
      { class: 'dossier' },
      rows.map((row) =>
        h(
          'div',
          { class: 'dossier-row' + (row.tone ? ' is-' + row.tone : '') },
          h('dt', null, rich(row.label)),
          h('dd', null, row.dot ? h('span', { class: 'status-dot', 'aria-hidden': 'true' }) : null, row.value instanceof Node ? row.value : rich(row.value))
        )
      )
    );

  const ICON_SOUND_ON =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const ICON_SOUND_OFF =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/></svg>';

  ui.SoundToggle = function (ctx) {
    const button = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Sound' });
    const sync = () => {
      const on = OG.sound.isEnabled();
      button.setAttribute('aria-pressed', String(on));
      button.replaceChildren(svg(on ? ICON_SOUND_ON : ICON_SOUND_OFF));
    };
    button.addEventListener('click', () => {
      const on = !OG.sound.isEnabled();
      OG.sound.setEnabled(on, true);
      OG.storage.save(ctx.soundKey, on);
      if (on) OG.sound.play('beep');
      sync();
    });
    sync();
    return button;
  };

  /**
   * Top bar. Home: terminal name (hold it to open the Game Master panel).
   * Other screens: a back button + the screen title (also holdable).
   */
  ui.TopBar = function (ctx, { title = '', back = null } = {}) {
    const { config } = ctx;
    const brand = h(
      'div',
      { class: 'brand' },
      back ? null : h('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
      h('span', { class: 'brand-text' }, rich(title || config.terminalName))
    );
    const holdMs = Math.max(0.5, Number(config.gameMaster.longPressSeconds) || 2) * 1000;
    ui.onLongPress(brand, holdMs, ctx.openGameMaster);
    const backButton = back
      ? h('button', { type: 'button', class: 'back-btn', 'aria-label': `Back to ${back.label}`, onClick: () => ctx.go(back.view, back.arg) }, ui.icon('back', 20), h('span', null, back.label))
      : null;
    return h('header', { class: 'topbar' + (back ? ' has-back' : '') }, backButton, brand, ui.SoundToggle(ctx));
  };

  /** One dot per mission: done, current, or ahead. Not clickable on purpose. */
  ui.MissionProgress = function (ctx, state) {
    const { missions } = ctx;
    const current = state.complete ? missions.length : state.missionIndex;
    const dots = missions.map((m, i) => h('span', { class: 'dot' + (i < current ? ' done' : i === current ? ' current' : '') }));
    const label = state.complete ? `${pad(missions.length)} / ${pad(missions.length)}` : `${pad(current + 1)} / ${pad(missions.length)}`;
    return h(
      'div',
      { class: 'mission-progress', role: 'img', 'aria-label': `Mission ${Math.min(current + 1, missions.length)} of ${missions.length}` },
      h('span', { class: 'progress-label', 'aria-hidden': 'true' }, `MISSION ${label}`),
      h('span', { class: 'progress-dots', 'aria-hidden': 'true' }, dots)
    );
  };

  /**
   * "Text this exact phrase to …" card for a real-world contact (Comms and Access Terminal).
   * The phrase is shown exactly as written in game-config.js so he never has to guess.
   */
  ui.ContactCard = function (ctx, contactId, { time = '', inTerminal = false } = {}) {
    const contact = ctx.config.contacts[contactId];
    if (!contact) return null;
    const name = String(contact.name || contactId);
    const copy = h('button', { type: 'button', class: 'chip-btn' }, 'COPY PHRASE');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(contact.phrase);
        copy.textContent = 'COPIED';
      } catch (e) {
        copy.textContent = 'PRESS AND HOLD THE PHRASE TO COPY';
      }
    });
    return h(
      'article',
      { class: 'contact-card' },
      h('header', null, h('span', { class: 'msg-from' }, fill(ctx.config.system.contactAssigned)), time ? h('time', null, time) : null),
      h('p', { class: 'contact-name' }, `CONTACT: ${name.toUpperCase()}`),
      h('p', { class: 'contact-label' }, 'SEND EXACT PHRASE:'),
      h('p', { class: 'contact-phrase' }, String(contact.phrase)),
      h(
        'p',
        { class: 'contact-help' },
        inTerminal
          ? `Text this exact phrase to ${name} yourself. When ${name} replies, enter the reply below.`
          : `Text this exact phrase to ${name} yourself. When ${name} replies, enter the reply in the Access Terminal.`
      ),
      h('div', { class: 'contact-actions' }, copy, inTerminal ? null : ui.ChipButton('OPEN ACCESS TERMINAL', () => ctx.go('terminal')))
    );
  };

  ui.gameById = (ctx, gameId) => ctx.games.find((g) => g.id === gameId) || null;
  ui.missionNumber = (ctx, missionId) => ctx.missions.findIndex((m) => m.id === missionId) + 1;
  ui.missionById = (ctx, missionId) => ctx.missions.find((m) => m.id === missionId) || null;
  ui.fileById = (ctx, fileId) => ctx.files.find((f) => f.id === fileId) || null;
  ui.lockById = (ctx, lockId) => ctx.locks.find((l) => l.id === lockId) || null;
  ui.clearanceLabel = (ctx, level) => {
    const name = ctx.config.clearance.names[level];
    return `LEVEL ${pad(level)}${name ? ' · ' + fill(name) : ''}`;
  };
})();
