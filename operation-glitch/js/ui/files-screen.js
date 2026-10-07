/* CASE FILES: unlocked documents, the evidence locker, and a full-screen image viewer. */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, fill, clock } = OG.text;
  const ui = OG.ui;

  const EVIDENCE_ID = 'evidence';

  function openLightbox(src, caption) {
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (event) => event.key === 'Escape' && close();
    const overlay = h(
      'div',
      { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Enlarged image', onClick: close },
      h('img', { src, alt: caption ? OG.text.plain(caption) : 'Case file image' }),
      h('button', { type: 'button', class: 'icon-btn lightbox-close', 'aria-label': 'Close image' }, ui.icon('close'))
    );
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
  }

  function renderBlock(block) {
    if (typeof block === 'string') return h('p', null, rich(block));
    if ('heading' in block) return h('h2', { class: 'file-heading' }, rich(block.heading));
    if ('note' in block) return h('p', { class: 'file-note' }, rich(block.note));
    if ('list' in block) return h('ul', { class: 'file-list' }, (Array.isArray(block.list) ? block.list : [block.list]).map((item) => h('li', null, rich(item))));
    if ('log' in block) return h('ol', { class: 'file-log' }, (Array.isArray(block.log) ? block.log : [block.log]).map((line) => h('li', null, rich(line))));
    if ('code' in block) return h('pre', { class: 'file-pre' }, fill(block.code));
    if ('cipher' in block) return h('pre', { class: 'file-pre' }, OG.cipher.shift(fill(block.cipher), block.shift));
    if ('image' in block) {
      const src = String(block.image);
      const img = h('img', { src, alt: block.caption ? OG.text.plain(block.caption) : 'Case file image' });
      const frame = h('button', { type: 'button', class: 'file-image', 'aria-label': 'Enlarge image', onClick: () => openLightbox(src, block.caption) }, img);
      img.addEventListener('error', () => frame.replaceWith(h('div', { class: 'file-image is-missing' }, `IMAGE NOT FOUND: ${src}`)));
      return h('figure', null, frame, block.caption ? h('figcaption', null, rich(block.caption)) : null);
    }
    return null;
  }

  function fileList(ctx, state) {
    const { files } = ctx;
    const unlocked = files.filter((f) => state.files[f.id]);
    const sealed = files.length - unlocked.length;
    const rows = unlocked.map((file) =>
      h(
        'button',
        { type: 'button', class: 'file-row', onClick: () => ctx.go('files', file.id) },
        h('span', { class: 'file-code' }, rich(file.code)),
        h('span', { class: 'file-title' }, rich(file.title)),
        h(
          'span',
          { class: 'file-meta' },
          file.classification ? h('span', { class: 'mini-stamp' }, rich(file.classification)) : null,
          state.files[file.id].opened ? null : h('span', { class: 'tool-badge' }, 'NEW')
        )
      )
    );
    return [
      h('h1', { class: 'screen-title', tabIndex: -1 }, 'CASE FILES'),
      h('p', { class: 'screen-sub' }, `CLEARANCE ${ui.clearanceLabel(ctx, OG.game.clearanceLevel(state, ctx.config))}`),
      state.evidence.length
        ? h(
            'button',
            { type: 'button', class: 'file-row is-evidence', onClick: () => ctx.go('files', EVIDENCE_ID) },
            h('span', { class: 'file-code' }, ui.icon('evidence', 18)),
            h('span', { class: 'file-title' }, 'EVIDENCE LOCKER'),
            h('span', { class: 'file-meta' }, `${state.evidence.length} ITEM${state.evidence.length === 1 ? '' : 'S'}`)
          )
        : null,
      rows.length ? h('div', { class: 'file-rows' }, rows) : h('p', { class: 'screen-sub' }, 'No files on record yet.'),
      sealed ? h('p', { class: 'sealed-note' }, ui.icon('lock', 16), ` ${sealed} FILE${sealed === 1 ? '' : 'S'} SEALED · AWAITING CLEARANCE`) : null,
    ];
  }

  function fileView(ctx, state, file) {
    const record = state.files[file.id];
    return [
      h(
        'header',
        { class: 'file-head' },
        h('div', { class: 'file-head-row' }, h('span', { class: 'file-code' }, rich(file.code)), file.classification ? ui.Stamp(file.classification, 'alert') : null),
        h('h1', { class: 'screen-title', tabIndex: -1 }, rich(file.title)),
        h('p', { class: 'screen-sub' }, `UNLOCKED ${clock(record.at)}`)
      ),
      h('article', { class: 'file-body' }, file.body.map(renderBlock)),
    ];
  }

  function evidenceView(ctx, state) {
    return [
      h('h1', { class: 'screen-title', tabIndex: -1 }, 'EVIDENCE LOCKER'),
      h('p', { class: 'screen-sub' }, 'Items recovered during this operation, in the order they were logged.'),
      h(
        'ol',
        { class: 'evidence-list' },
        state.evidence.map((item, i) => h('li', null, h('span', { class: 'evidence-n' }, OG.text.pad(i + 1)), h('span', { class: 'evidence-text' }, rich(item.text)), h('time', null, clock(item.at))))
      ),
    ];
  }

  ui.FilesScreen = function (ctx, fileId) {
    const { store } = ctx;
    const file = fileId && fileId !== EVIDENCE_ID ? ui.fileById(ctx, fileId) : null;
    const back = fileId ? { view: 'files', label: 'FILES' } : { view: 'hub', label: 'HUB' };
    const body = h('main', { class: 'screen-body files-body' });
    const el = h('div', { class: 'screen files' }, ui.TopBar(ctx, { title: 'CASE FILES', back }), body);

    function update(state) {
      if (fileId === EVIDENCE_ID) return body.replaceChildren(...evidenceView(ctx, state));
      if (file && state.files[file.id]) return body.replaceChildren(...fileView(ctx, state, file).filter(Boolean));
      body.replaceChildren(...fileList(ctx, state).filter(Boolean));
    }

    const state = store.getState();
    if (fileId && fileId !== EVIDENCE_ID && !(file && state.files[file.id])) {
      // Sealed or unknown file: show the list instead.
      setTimeout(() => ctx.go('files', null, { replace: true }), 0);
    }
    update(state);
    if (file && state.files[file.id] && !state.files[file.id].opened) setTimeout(() => store.dispatch({ type: 'OPEN_FILE', id: file.id }), 0);

    // Only the list needs live updates (new files, NEW badges).
    return { el, update: (s) => !fileId && update(s) };
  };
})();
