/* SYSTEM DIAGNOSTICS (a hidden tool for puzzle data) and the FINAL FIELD REPORT. */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, paras, clock } = OG.text;
  const ui = OG.ui;

  ui.DiagnosticsScreen = function (ctx) {
    const d = ctx.config.diagnostics;
    // No line numbers: the lines can carry a read-down puzzle, so each one starts with its own text.
    const list = h('ul', { class: 'diag-lines' }, paras(d.lines).map((line, i) => h('li', { style: { '--i': i } }, h('span', { class: 'ok-dot', 'aria-hidden': 'true' }), h('span', null, rich(line)))));
    const body = h(
      'main',
      { class: 'screen-body' },
      h('h1', { class: 'screen-title', tabIndex: -1 }, rich(d.title)),
      d.intro ? h('p', { class: 'screen-sub' }, rich(d.intro)) : null,
      h('section', { class: 'term-screen' }, list)
    );
    return { el: h('div', { class: 'screen diagnostics' }, ui.TopBar(ctx, { title: 'DIAGNOSTICS', back: { view: 'hub', label: 'HUB' } }), body) };
  };

  function duration(from, to) {
    const ms = Date.parse(to) - Date.parse(from);
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const minutes = Math.round(ms / 60000);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours} H ${minutes % 60} MIN` : `${minutes} MIN`;
  }

  ui.ReportScreen = function (ctx) {
    const { config, store, missions } = ctx;
    const r = config.report;
    const s = OG.game.stats(store.getState(), missions);
    const points = s.hints * 2 + s.wrong;
    const rating = (r.ratings.find((band) => points <= Number(band.upTo)) || r.ratings[r.ratings.length - 1] || { label: '' }).label;

    const rows = [
      { label: 'MISSIONS COMPLETED', value: `${s.missionsDone} / ${s.missionsTotal}` },
      { label: 'HINTS REQUESTED', value: String(s.hints) },
      { label: 'INVALID KEYS ENTERED', value: String(s.wrong) },
      { label: 'OPERATION STARTED', value: clock(s.startedAt) || '—' },
      { label: 'OPERATION COMPLETED', value: clock(s.finishedAt) || '—' },
      { label: 'TIME IN THE FIELD', value: s.startedAt && s.finishedAt ? duration(s.startedAt, s.finishedAt) : '—' },
      ...r.extraRows.map((row) => ({ label: row.label, value: row.value })),
    ];

    const body = h(
      'main',
      { class: 'screen-body report-body' },
      h('div', { class: 'eyebrow is-literal' }, rich(config.operationName)),
      h('h1', { class: 'screen-title', tabIndex: -1 }, rich(r.title)),
      h(
        'section',
        { class: 'panel report-panel' },
        ui.Dossier(rows),
        h('div', { class: 'report-rating' }, h('span', { class: 'panel-label' }, rich(r.ratingLabel || 'FIELD RATING')), ui.Stamp(rating, 'ok'))
      ),
      h('section', { class: 'signoff' }, h('div', { class: 'panel-label' }, rich(config.handler.name)), paras(r.signoff).map((line) => h('p', null, rich(line)))),
      r.personalNote
        ? h('section', { class: 'personal-note' }, h('div', { class: 'panel-label' }, rich(r.personalNoteLabel || 'PERSONAL NOTE')), paras(r.personalNote).map((line) => h('p', null, rich(line))))
        : null
    );
    return { el: h('div', { class: 'screen report' }, ui.TopBar(ctx, { title: 'FIELD REPORT', back: { view: 'hub', label: 'HUB' } }), body) };
  };
})();
