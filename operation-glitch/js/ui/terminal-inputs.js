/*
 * Access Terminal input modes. Each returns the same small interface:
 *   { el, wrong(), setBusy(busy), destroy() }
 * and calls submit(value) when he authenticates.
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const { rich, pad } = OG.text;
  const ui = OG.ui;

  const AUTO_SUBMIT_MS = 180;
  const CLEAR_AFTER_WRONG_MS = 700;

  function shake(el) {
    el.classList.remove('is-wrong');
    void el.offsetWidth; // restart the animation
    el.classList.add('is-wrong');
    setTimeout(() => el.classList.remove('is-wrong'), 700);
  }

  /** Password / passphrase box (also used under the cipher decoder). */
  function textEntry(ctx, lock, submit, { phrase = false } = {}) {
    let busy = false;
    const input = h('input', {
      class: 'term-input' + (phrase ? ' is-phrase' : ''),
      type: 'text',
      name: 'og-key',
      autocomplete: 'off',
      autocorrect: 'off',
      autocapitalize: 'off',
      spellcheck: false,
      enterKeyHint: 'go',
      maxLength: 120,
      placeholder: phrase ? 'ENTER PASSPHRASE' : 'ENTER KEY',
      'aria-label': OG.text.plain(lock.prompt),
    });
    const button = ui.Button(ctx.config.terminal.submit, { type: 'submit', size: 'xl' });
    const form = h(
      'form',
      {
        class: 'term-form',
        noValidate: true,
        autocomplete: 'off',
        onSubmit: (event) => {
          event.preventDefault();
          input.focus(); // keep the keyboard up for an immediate retry
          if (!busy) submit(input.value);
        },
      },
      h('div', { class: 'term-line' }, h('span', { class: 'term-caret', 'aria-hidden': 'true' }, '>'), input),
      button
    );
    return {
      el: form,
      wrong: () => shake(input),
      setBusy(on) {
        busy = on;
        button.disabled = on;
      },
      destroy() {},
    };
  }

  /** Big on-screen number pad. Submits automatically when every digit is in. */
  function keypad(ctx, lock, submit) {
    const length = lock.length || 4;
    let digits = '';
    let busy = false;
    const slots = Array.from({ length }, () => h('span', { class: 'slot' }));
    const display = h('div', { class: 'slots', role: 'status', 'aria-live': 'polite' }, slots);

    function render() {
      slots.forEach((slot, i) => {
        slot.textContent = digits[i] || '';
        slot.classList.toggle('is-filled', i < digits.length);
        slot.classList.toggle('is-next', i === digits.length);
      });
      display.setAttribute('aria-label', digits.length ? `${digits.length} of ${length} digits entered` : `Enter ${length} digits`);
    }

    function press(key) {
      if (busy) return;
      if (key === 'back') digits = digits.slice(0, -1);
      else if (key === 'clear') digits = '';
      else if (digits.length < length) digits += key;
      else return;
      OG.sound.play('key');
      render();
      if (digits.length === length) setTimeout(() => submit(digits), AUTO_SUBMIT_MS);
    }

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
    const grid = h(
      'div',
      { class: 'keypad' },
      keys.map((key) =>
        h(
          'button',
          {
            type: 'button',
            class: 'key' + (key.length > 1 ? ' key-fn' : ''),
            'aria-label': key === 'back' ? 'Delete' : key === 'clear' ? 'Clear' : key,
            onClick: () => press(key),
          },
          key === 'back' ? '⌫' : key === 'clear' ? 'CLR' : key
        )
      )
    );

    const onKey = (event) => {
      if (event.target.closest && event.target.closest('input, textarea')) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('back');
      else if (event.key === 'Escape') press('clear');
    };
    document.addEventListener('keydown', onKey);
    render();

    return {
      el: h('div', { class: 'keypad-wrap' }, display, grid),
      wrong() {
        shake(display);
        setTimeout(() => {
          digits = '';
          render();
        }, CLEAR_AFTER_WRONG_MS);
      },
      setBusy(on) {
        busy = on;
      },
      destroy: () => document.removeEventListener('keydown', onKey),
    };
  }

  /** Tap symbols in order. */
  function sequence(ctx, lock, submit) {
    const length = lock.length;
    let picked = [];
    let busy = false;
    const slots = Array.from({ length }, () => h('span', { class: 'slot slot-symbol' }));
    const display = h('div', { class: 'slots', role: 'status', 'aria-live': 'polite' }, slots);

    function render() {
      slots.forEach((slot, i) => {
        slot.textContent = picked[i] || '';
        slot.classList.toggle('is-filled', i < picked.length);
        slot.classList.toggle('is-next', i === picked.length);
      });
      display.setAttribute('aria-label', picked.length ? `Entered: ${picked.join(' ')}` : `Enter ${length} symbols`);
    }

    function add(symbol) {
      if (busy || previewing || picked.length >= length) return;
      picked = [...picked, symbol];
      OG.sound.play('key');
      render();
      if (picked.length === length) setTimeout(() => submit(picked), AUTO_SUBMIT_MS);
    }

    // Optional memory preview: shows the correct sequence one symbol at a time, then hides it.
    // He can replay it as often as he likes.
    let previewing = false;
    let previewTimer = 0;
    const previewSymbol = h('span', { class: 'preview-symbol' });
    const previewLabel = h('span', { class: 'preview-label' }, 'READY');
    const previewStage = h('div', { class: 'preview-stage', role: 'status', 'aria-live': 'polite' }, previewSymbol, previewLabel);
    function play() {
      if (previewing || busy) return;
      previewing = true;
      picked = [];
      render();
      previewStage.classList.add('is-playing');
      let i = 0;
      const next = () => {
        if (i < lock.sequence.length) {
          previewSymbol.textContent = lock.sequence[i];
          previewLabel.textContent = lock.previewLabels[i] || `${i + 1} / ${lock.sequence.length}`;
          OG.sound.play('beep');
          i++;
          previewTimer = setTimeout(next, 950);
        } else {
          previewSymbol.textContent = '';
          previewLabel.textContent = 'YOUR TURN';
          previewStage.classList.remove('is-playing');
          previewing = false;
        }
      };
      next();
    }
    const playButton = lock.preview ? ui.Button('PLAY SEQUENCE', { variant: 'secondary', size: 'xl', onClick: play }) : null;

    const palette = h(
      'div',
      { class: 'symbol-grid' },
      lock.symbols.map((symbol) => h('button', { type: 'button', class: 'key key-symbol', 'aria-label': `Symbol ${symbol}`, onClick: () => add(symbol) }, symbol))
    );
    const controls = h(
      'div',
      { class: 'term-controls' },
      h('button', { type: 'button', class: 'key key-fn', onClick: () => !busy && ((picked = picked.slice(0, -1)), render()) }, '⌫ DELETE'),
      h('button', { type: 'button', class: 'key key-fn', onClick: () => !busy && ((picked = []), render()) }, 'CLEAR')
    );
    render();

    return {
      el: h('div', { class: 'keypad-wrap' }, lock.preview ? previewStage : null, playButton, display, palette, controls),
      wrong() {
        shake(display);
        setTimeout(() => {
          picked = [];
          render();
        }, CLEAR_AFTER_WRONG_MS);
      },
      setBusy(on) {
        busy = on;
      },
      destroy: () => clearTimeout(previewTimer),
    };
  }

  /** Same scrambled order every time for a given lock (never the correct order). */
  function scrambled(count, seedText) {
    let seed = 0;
    for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.every((v, i) => v === i)) order.push(order.shift());
    return order;
  }

  /** Tap items in the order they belong; tap again to take one back. */
  function order(ctx, lock, submit) {
    const shown = scrambled(lock.items.length, lock.id);
    let picked = [];
    let busy = false;

    const status = h('div', { class: 'order-status', role: 'status', 'aria-live': 'polite' });
    const buttons = shown.map((itemIndex) =>
      h(
        'button',
        { type: 'button', class: 'order-item', onClick: () => toggle(itemIndex) },
        h('span', { class: 'order-num', 'aria-hidden': 'true' }),
        h('span', { class: 'order-text' }, rich(lock.items[itemIndex]))
      )
    );
    const go = ui.Button(ctx.config.terminal.submit, { size: 'xl', onClick: () => !busy && picked.length === lock.items.length && submit(picked) });
    const reset = h('button', { type: 'button', class: 'key key-fn', onClick: () => !busy && ((picked = []), render()) }, 'RESET ORDER');

    function toggle(itemIndex) {
      if (busy) return;
      picked = picked.includes(itemIndex) ? picked.filter((i) => i !== itemIndex) : [...picked, itemIndex];
      OG.sound.play('key');
      render();
    }

    function render() {
      buttons.forEach((button, i) => {
        const position = picked.indexOf(shown[i]);
        button.classList.toggle('is-picked', position !== -1);
        button.querySelector('.order-num').textContent = position === -1 ? '' : String(position + 1);
        button.setAttribute('aria-label', `${OG.text.plain(lock.items[shown[i]])}${position === -1 ? '' : `, position ${position + 1}`}`);
      });
      status.textContent = `${picked.length} / ${lock.items.length} PLACED`;
      go.disabled = picked.length !== lock.items.length;
    }
    render();

    return {
      el: h('div', { class: 'order-wrap' }, h('p', { class: 'term-help' }, 'Tap the items in order. Tap one again to take it back.'), h('div', { class: 'order-list' }, buttons), status, h('div', { class: 'term-controls' }, reset), go),
      wrong: () => shake(status),
      setBusy(on) {
        busy = on;
        go.disabled = on || picked.length !== lock.items.length;
      },
      destroy() {},
    };
  }

  /** Rotation decoder above a password box. The message is scrambled from the content's plain text. */
  function cipher(ctx, lock, submit) {
    const scrambledText = OG.cipher.shift(lock.cipher.message, lock.cipher.shift);
    let rotation = 0;
    const value = h('span', { class: 'rot-value' });
    const output = h('div', { class: 'cipher-out', 'aria-live': 'polite' });
    const range = h('input', { type: 'range', min: 0, max: 25, step: 1, value: 0, class: 'rot-range', 'aria-label': 'Rotation', onInput: () => set(Number(range.value)) });

    function set(r) {
      rotation = ((r % 26) + 26) % 26;
      range.value = String(rotation);
      value.textContent = pad(rotation);
      output.textContent = OG.cipher.shift(scrambledText, 26 - rotation);
    }

    const decoder = h(
      'section',
      { class: 'decoder' },
      h('div', { class: 'panel-label' }, 'INTERCEPTED SIGNAL'),
      h('div', { class: 'cipher-in' }, scrambledText),
      h(
        'div',
        { class: 'rot-row' },
        h('button', { type: 'button', class: 'key key-fn rot-btn', 'aria-label': 'Rotate back', onClick: () => (set(rotation - 1), OG.sound.play('key')) }, '−'),
        h('div', { class: 'rot-display' }, h('span', { class: 'panel-label' }, 'ROTATION'), value),
        h('button', { type: 'button', class: 'key key-fn rot-btn', 'aria-label': 'Rotate forward', onClick: () => (set(rotation + 1), OG.sound.play('key')) }, '+')
      ),
      range,
      h('div', { class: 'panel-label' }, 'DECODER OUTPUT'),
      output
    );
    set(0);
    const entry = textEntry(ctx, lock, submit);
    return { ...entry, el: h('div', { class: 'cipher-wrap' }, decoder, entry.el) };
  }

  ui.terminalInput = function (ctx, lock, submit) {
    switch (lock.type) {
      case 'keypad':
        return keypad(ctx, lock, submit);
      case 'sequence':
        return sequence(ctx, lock, submit);
      case 'order':
        return order(ctx, lock, submit);
      case 'cipher':
        return cipher(ctx, lock, submit);
      case 'phrase':
        return textEntry(ctx, lock, submit, { phrase: true });
      default:
        return textEntry(ctx, lock, submit);
    }
  };
})();
