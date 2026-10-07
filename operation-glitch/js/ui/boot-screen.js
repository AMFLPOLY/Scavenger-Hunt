/* First launch: the locked terminal + the short activation sequence. */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, paras } = OG.text;
  const ui = OG.ui;

  const LINE_MS = 480;
  const END_PAUSE_MS = 450;

  ui.BootScreen = function (ctx) {
    const { config, store } = ctx;
    const a = config.activation;

    const body = h(
      'main',
      { class: 'screen-body boot-body' },
      a.eyebrow ? h('div', { class: 'eyebrow' }, rich(a.eyebrow)) : null,
      ui.GlitchHeading('boot-title', config.terminalName, 'glitch-light'),
      h(
        'section',
        { class: 'panel boot-panel' },
        ui.Stamp('CLASSIFIED', 'alert'),
        ui.Dossier([
          { label: 'AGENT', value: config.husbandName },
          { label: 'OPERATION', value: config.operationName },
          { label: 'STATUS', value: a.status, tone: 'warn', dot: true },
        ])
      )
    );

    const startButton = ui.Button(a.button, { size: 'xl', onClick: activate });
    const dock = h('div', { class: 'dock' }, startButton, a.footer ? h('p', { class: 'fine-print' }, rich(a.footer)) : null);
    const el = h('div', { class: 'screen boot' }, ui.TopBar(ctx), body, dock);

    let sequence = null;
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (sequence) sequence.cancel();
      store.dispatch({ type: 'ACTIVATE', now: Date.now() });
      ctx.go('hub', null, { replace: true }); // always start on the home screen
    }

    function activate() {
      if (startButton.disabled) return;
      startButton.disabled = true;
      OG.sound.play('glitch');
      ui.vibrate(20);
      const lines = paras(a.sequence);
      if (!lines.length) return finish();

      const list = h('ol', { class: 'boot-lines' });
      el.append(h('div', { class: 'boot-overlay', role: 'status', 'aria-live': 'polite', onClick: finish }, list, h('div', { class: 'boot-skip' }, 'TAP TO SKIP')));
      sequence = ui.reveal(
        lines.length,
        LINE_MS,
        (i) => {
          list.append(h('li', { class: i === lines.length - 1 ? 'is-ok' : '' }, rich(lines[i])));
          OG.sound.play('beep');
        },
        () => setTimeout(finish, END_PAUSE_MS)
      );
    }

    return {
      el,
      destroy() {
        finished = true;
        if (sequence) sequence.cancel();
      },
    };
  };
})();
