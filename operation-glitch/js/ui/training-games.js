/*
 * The three training simulations. Each one is self-contained:
 *
 *   OG.games[kind](mount, { target, labels, onProgress(value), onRunEnd(value), onComplete(value) })
 *     → { destroy() }
 *
 * They draw on a <canvas>, use big touch buttons (plus the keyboard), restart instantly,
 * pause when the iPad is put to sleep, and turn any unexpected error into a
 * "SIMULATION FAULT — RESTART" screen instead of freezing.
 */
(function () {
  'use strict';
  const OG = window.OG;
  const { h } = OG.dom;
  const games = (OG.games = OG.games || {});

  const C = {
    bg: '#050606',
    grid: 'rgba(160, 220, 190, 0.06)',
    green: '#4fd88a',
    greenDim: 'rgba(79, 216, 138, 0.35)',
    amber: '#f0b44c',
    red: '#ff5d55',
    text: '#e6eae7',
    dim: '#8f9994',
    font: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  };

  // ── Shared pieces ──

  /** Size a canvas for crisp drawing on Retina screens; returns its 2D context. */
  function sizeCanvas(canvas, width, height) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }

  /** A touch button. `repeat` (ms) keeps firing while held; `onUp` runs on release. */
  function control(label, ariaLabel, onPress, { repeat = 0, onUp = null, className = '' } = {}) {
    const button = h('button', { type: 'button', class: `game-btn ${className}`, 'aria-label': ariaLabel }, label);
    let pointer = false;
    let delayTimer = 0;
    let repeatTimer = 0;
    const release = () => {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      delayTimer = repeatTimer = 0;
      if (button.classList.contains('is-down')) {
        button.classList.remove('is-down');
        if (onUp) onUp();
      }
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      pointer = true;
      button.classList.add('is-down');
      onPress();
      if (repeat) delayTimer = setTimeout(() => (repeatTimer = setInterval(onPress, repeat)), 180);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => button.addEventListener(type, release));
    // Keyboard activation (Enter/Space) arrives as a click with no pointer press.
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (pointer) pointer = false;
      else {
        onPress();
        if (onUp) onUp();
      }
    });
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    return { el: button, release };
  }

  /** The panel over the board: START / PAUSED / GAME OVER / COMPLETE. */
  function overlay() {
    const title = h('div', { class: 'game-overlay-title' });
    const text = h('div', { class: 'game-overlay-text' });
    const actions = h('div', { class: 'game-overlay-actions' });
    const el = h('div', { class: 'game-overlay', role: 'status', 'aria-live': 'polite' }, title, text, actions);
    return {
      el,
      show(heading, message, buttonLabel, onClick, tone = '') {
        el.className = 'game-overlay' + (tone ? ' is-' + tone : '');
        title.textContent = heading;
        text.textContent = message || '';
        actions.replaceChildren();
        if (buttonLabel) {
          const button = OG.ui.Button(buttonLabel, { size: 'xl', onClick });
          actions.append(button);
          setTimeout(() => button.focus({ preventScroll: true }), 0);
        }
        el.hidden = false;
      },
      hide() {
        el.hidden = true;
      },
    };
  }

  /**
   * Common frame: stage (canvas + overlay) and a controls row, keyboard handling,
   * pause-on-sleep, resize, and error containment.
   */
  function frame(mount, { ariaLabel, controls, onKey, onResize, onHide }) {
    const canvas = h('canvas', { class: 'game-canvas', role: 'img', 'aria-label': ariaLabel });
    const panel = overlay();
    const stage = h('div', { class: 'game-stage' }, canvas, panel.el);
    const pad = h('div', { class: 'game-controls' }, controls.map((c) => (c instanceof Node ? c : c.el)));
    mount.replaceChildren(h('div', { class: 'game-frame' }, stage, pad));

    const keyHandler = (event) => {
      if (event.target.closest && event.target.closest('input, textarea, .gm')) return;
      if (onKey(event)) event.preventDefault();
    };
    const visibility = () => document.visibilityState === 'hidden' && onHide();
    const sized = () => stage.clientWidth > 40 && stage.clientHeight > 40;
    const resize = () => sized() && onResize();
    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(stage);
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('visibilitychange', visibility);
    // The game is built before it is on screen: size it as soon as the stage has real dimensions.
    let tries = 0;
    const firstSize = () => {
      if (sized()) onResize();
      else if (tries++ < 60) setTimeout(firstSize, 50);
    };
    setTimeout(firstSize, 0);

    return {
      canvas,
      stage,
      panel,
      destroy() {
        document.removeEventListener('keydown', keyHandler);
        document.removeEventListener('visibilitychange', visibility);
        if (ro) ro.disconnect();
        window.removeEventListener('resize', resize);
        tries = 99;
        controls.forEach((c) => c.release && c.release());
      },
    };
  }

  /** Run fn; on any error, report it and keep the simulation recoverable. */
  function guarded(fn, onFault) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        console.error(error);
        onFault(error);
        return undefined;
      }
    };
  }

  // ─────────────────────────── GAME 1: SYSTEMS RECONSTRUCTION (blocks) ───────────────────────────

  games.blocks = function (mount, opts) {
    const COLS = 10;
    const ROWS = 18;
    const SHAPES = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      O: [[1, 1], [1, 1]],
      T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    };
    const TINT = { I: '#4fd88a', O: '#f0b44c', T: '#7fd0ff', S: '#4fd88a', Z: '#ff8a7a', J: '#b9a3ff', L: '#f0b44c' };
    const LINE_POINTS = [0, 100, 300, 500, 800];

    let mode = 'ready'; // ready | running | paused | over | done
    let board = [];
    let piece = null;
    let bag = [];
    let score = 0;
    let lines = 0;
    let timer = 0;
    let g = null;
    let cell = 20;

    const act = (fn) => () => {
      if (mode !== 'running') return;
      safe(fn)();
      draw();
    };
    const controls = [
      control('◀', 'Move left', act(() => move(-1)), { repeat: 75 }),
      control('▶', 'Move right', act(() => move(1)), { repeat: 75 }),
      control('▼', 'Soft drop', act(softDrop), { repeat: 55 }),
      control('⟳', 'Rotate', act(rotatePiece), { className: 'game-btn-accent' }),
      control('⤓', 'Drop', act(hardDrop), { className: 'game-btn-accent' }),
    ];
    const f = frame(mount, {
      ariaLabel: 'Systems reconstruction board',
      controls,
      onKey(event) {
        const map = { ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowDown: softDrop, ArrowUp: rotatePiece, ' ': hardDrop };
        if (!map[event.key]) return false;
        if (mode === 'running') {
          safe(map[event.key])();
          draw();
        }
        return true;
      },
      onResize: () => resize(),
      onHide: () => mode === 'running' && pause(),
    });

    const safe = (fn) => guarded(fn, fault);

    function fault() {
      clearTimeout(timer);
      mode = 'over';
      f.panel.show('SIMULATION FAULT', 'Something went wrong. Restart to try again.', opts.labels.restart, start, 'error');
    }

    const shuffled = () => {
      const keys = Object.keys(SHAPES);
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
      return keys;
    };

    function collides(m, x, y) {
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const bx = x + c;
          const by = y + r;
          if (bx < 0 || bx >= COLS || by >= ROWS) return true;
          if (by >= 0 && board[by][bx]) return true;
        }
      }
      return false;
    }

    function spawn() {
      if (!bag.length) bag = shuffled();
      const type = bag.pop();
      const m = SHAPES[type].map((row) => row.slice());
      piece = { type, m, x: Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
      if (collides(piece.m, piece.x, piece.y)) gameOver();
    }

    function rotate(m) {
      const n = m.length;
      const out = m.map((row) => row.slice());
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[c][n - 1 - r] = m[r][c];
      return out;
    }

    function rotatePiece() {
      const m = rotate(piece.m);
      for (const dx of [0, -1, 1, -2, 2]) {
        if (!collides(m, piece.x + dx, piece.y)) {
          piece.m = m;
          piece.x += dx;
          return;
        }
      }
    }

    function move(dx) {
      if (!collides(piece.m, piece.x + dx, piece.y)) piece.x += dx;
    }

    function addScore(points) {
      score += points;
      opts.onProgress(score);
      if (score >= opts.target && mode === 'running') complete();
    }

    function lockPiece() {
      for (let r = 0; r < piece.m.length; r++) {
        for (let c = 0; c < piece.m[r].length; c++) {
          if (!piece.m[r][c]) continue;
          const by = piece.y + r;
          if (by < 0) return gameOver();
          board[by][piece.x + c] = piece.type;
        }
      }
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(Boolean)) {
          board.splice(r, 1);
          board.unshift(new Array(COLS).fill(null));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        OG.sound.play('hint');
      }
      addScore(LINE_POINTS[Math.min(4, cleared)]);
      if (mode === 'running') spawn();
    }

    function softDrop() {
      if (!collides(piece.m, piece.x, piece.y + 1)) {
        piece.y++;
        addScore(1);
      } else lockPiece();
    }

    function hardDrop() {
      let distance = 0;
      while (!collides(piece.m, piece.x, piece.y + 1)) {
        piece.y++;
        distance++;
      }
      addScore(distance * 2);
      if (mode === 'running') lockPiece();
    }

    const speed = () => Math.max(160, 750 - Math.floor(lines / 6) * 70);

    const tick = () => {
      if (mode !== 'running') return;
      safe(() => {
        if (!collides(piece.m, piece.x, piece.y + 1)) piece.y++;
        else lockPiece();
        draw();
      })();
      if (mode === 'running') timer = setTimeout(tick, speed());
    };

    function start() {
      clearTimeout(timer);
      board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
      bag = [];
      score = 0;
      lines = 0;
      opts.onProgress(0);
      mode = 'running';
      f.panel.hide();
      safe(spawn)();
      draw();
      timer = setTimeout(tick, speed());
    }

    function pause() {
      clearTimeout(timer);
      mode = 'paused';
      f.panel.show('SIMULATION PAUSED', `SCORE ${score}`, 'RESUME', resume);
    }

    function resume() {
      mode = 'running';
      f.panel.hide();
      timer = setTimeout(tick, speed());
    }

    function gameOver() {
      clearTimeout(timer);
      mode = 'over';
      OG.sound.play('error');
      opts.onRunEnd(score);
      f.panel.show('DATA CORRUPTED', `SCORE ${score} OF ${opts.target}. Runs are unlimited.`, opts.labels.restart, start, 'error');
    }

    function complete() {
      clearTimeout(timer);
      mode = 'done';
      draw();
      f.panel.show('RECONSTRUCTION COMPLETE', `SCORE ${score}`, null, null, 'ok');
      opts.onComplete(score);
    }

    function resize() {
      const w = f.stage.clientWidth;
      const ht = f.stage.clientHeight;
      cell = Math.max(10, Math.floor(Math.min(w / COLS, ht / ROWS)));
      g = sizeCanvas(f.canvas, cell * COLS, cell * ROWS);
      draw();
    }

    function drawCell(x, y, color, ghost) {
      const pad = Math.max(1, Math.round(cell * 0.06));
      if (ghost) {
        g.strokeStyle = C.greenDim;
        g.lineWidth = 1;
        g.strokeRect(x * cell + pad + 0.5, y * cell + pad + 0.5, cell - pad * 2 - 1, cell - pad * 2 - 1);
        return;
      }
      g.fillStyle = color;
      g.fillRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2);
      g.fillStyle = 'rgba(0, 0, 0, 0.18)';
      g.fillRect(x * cell + pad, y * cell + cell - pad - Math.max(2, cell * 0.14), cell - pad * 2, Math.max(2, cell * 0.14));
    }

    function draw() {
      if (!g) return;
      g.fillStyle = C.bg;
      g.fillRect(0, 0, cell * COLS, cell * ROWS);
      g.strokeStyle = C.grid;
      g.lineWidth = 1;
      for (let c = 1; c < COLS; c++) {
        g.beginPath();
        g.moveTo(c * cell + 0.5, 0);
        g.lineTo(c * cell + 0.5, cell * ROWS);
        g.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        g.beginPath();
        g.moveTo(0, r * cell + 0.5);
        g.lineTo(cell * COLS, r * cell + 0.5);
        g.stroke();
      }
      board.forEach((row, r) => row.forEach((type, c) => type && drawCell(c, r, TINT[type])));
      if (piece && (mode === 'running' || mode === 'paused')) {
        let gy = piece.y;
        while (!collides(piece.m, piece.x, gy + 1)) gy++;
        piece.m.forEach((row, r) => row.forEach((v, c) => v && gy + r >= 0 && drawCell(piece.x + c, gy + r, null, true)));
        piece.m.forEach((row, r) => row.forEach((v, c) => v && piece.y + r >= 0 && drawCell(piece.x + c, piece.y + r, TINT[piece.type])));
      }
    }

    board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    resize();
    opts.onProgress(0);
    f.panel.show('SYSTEMS RECONSTRUCTION', `Fill complete rows to rebuild corrupted data. TARGET: ${opts.target} POINTS.`, opts.labels.start, start);

    return {
      destroy() {
        clearTimeout(timer);
        mode = 'done';
        f.destroy();
      },
    };
  };

  // ─────────────────────────── GAME 2: SIGNAL ROUTING (snake) ───────────────────────────

  games.snake = function (mount, opts) {
    const N = 16;
    const TICK_MS = 145;
    const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

    let mode = 'ready';
    let snake = [];
    let dir = DIRS.right;
    let queue = [];
    let node = null;
    let nodes = 0;
    let timer = 0;
    let g = null;
    let cell = 20;

    const turn = (name) => () => {
      if (mode !== 'running') return;
      const d = DIRS[name];
      const last = queue.length ? queue[queue.length - 1] : dir;
      if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return;
      if (queue.length < 3) queue.push(d);
    };
    const up = control('▲', 'Up', turn('up'));
    const left = control('◀', 'Left', turn('left'));
    const down = control('▼', 'Down', turn('down'));
    const right = control('▶', 'Right', turn('right'));
    const dpad = h('div', { class: 'dpad' }, h('span'), up.el, h('span'), left.el, down.el, right.el);
    dpad.release = () => [up, left, down, right].forEach((c) => c.release());

    const f = frame(mount, {
      ariaLabel: 'Signal routing network',
      controls: [dpad],
      onKey(event) {
        const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        if (!map[event.key]) return false;
        turn(map[event.key])();
        return true;
      },
      onResize: () => resize(),
      onHide: () => mode === 'running' && pause(),
    });

    // Swipe on the board as an alternative to the buttons.
    let swipe = null;
    f.canvas.addEventListener('pointerdown', (event) => (swipe = { x: event.clientX, y: event.clientY }));
    f.canvas.addEventListener('pointerup', (event) => {
      if (!swipe) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')();
    });

    const safe = (fn) => guarded(fn, fault);

    function fault() {
      clearTimeout(timer);
      mode = 'over';
      f.panel.show('SIMULATION FAULT', 'Something went wrong. Restart to try again.', opts.labels.restart, start, 'error');
    }

    function placeNode() {
      const free = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!snake.some((p) => p.x === x && p.y === y)) free.push({ x, y });
      node = free.length ? free[Math.floor(Math.random() * free.length)] : null;
    }

    function stepOnce() {
      if (queue.length) dir = queue.shift();
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N) return crash();
      const eating = node && head.x === node.x && head.y === node.y;
      const body = eating ? snake : snake.slice(0, -1);
      if (body.some((p) => p.x === head.x && p.y === head.y)) return crash();
      snake.unshift(head);
      if (eating) {
        nodes++;
        OG.sound.play('key');
        opts.onProgress(nodes);
        if (nodes >= opts.target) return complete();
        placeNode();
        if (!node) return complete();
      } else snake.pop();
    }

    const tick = () => {
      if (mode !== 'running') return;
      safe(() => {
        stepOnce();
        draw();
      })();
      if (mode === 'running') timer = setTimeout(tick, TICK_MS);
    };

    function start() {
      clearTimeout(timer);
      const mid = Math.floor(N / 2);
      snake = [{ x: 5, y: mid }, { x: 4, y: mid }, { x: 3, y: mid }];
      dir = DIRS.right;
      queue = [];
      nodes = 0;
      opts.onProgress(0);
      placeNode();
      mode = 'running';
      f.panel.hide();
      draw();
      timer = setTimeout(tick, TICK_MS);
    }

    function pause() {
      clearTimeout(timer);
      mode = 'paused';
      f.panel.show('SIMULATION PAUSED', `${nodes} DATA NODES ROUTED`, 'RESUME', () => {
        mode = 'running';
        f.panel.hide();
        timer = setTimeout(tick, TICK_MS);
      });
    }

    function crash() {
      clearTimeout(timer);
      mode = 'over';
      OG.sound.play('error');
      opts.onRunEnd(nodes);
      f.panel.show('PACKET LOST', `${nodes} OF ${opts.target} DATA NODES ROUTED. Runs are unlimited.`, opts.labels.restart, start, 'error');
    }

    function complete() {
      clearTimeout(timer);
      mode = 'done';
      draw();
      f.panel.show('SIGNAL ROUTE STABILIZED', `${nodes} DATA NODES ROUTED`, null, null, 'ok');
      opts.onComplete(nodes);
    }

    function resize() {
      const size = Math.min(f.stage.clientWidth, f.stage.clientHeight);
      cell = Math.max(8, Math.floor(size / N));
      g = sizeCanvas(f.canvas, cell * N, cell * N);
      draw();
    }

    function draw() {
      if (!g) return;
      const s = cell * N;
      g.fillStyle = C.bg;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = C.grid;
      g.lineWidth = 1;
      for (let i = 1; i < N; i++) {
        g.beginPath();
        g.moveTo(i * cell + 0.5, 0);
        g.lineTo(i * cell + 0.5, s);
        g.moveTo(0, i * cell + 0.5);
        g.lineTo(s, i * cell + 0.5);
        g.stroke();
      }
      g.strokeStyle = C.greenDim;
      g.strokeRect(0.5, 0.5, s - 1, s - 1);
      if (node) {
        const cx = node.x * cell + cell / 2;
        const cy = node.y * cell + cell / 2;
        const r = cell * 0.34;
        g.fillStyle = C.amber;
        g.beginPath();
        g.moveTo(cx, cy - r);
        g.lineTo(cx + r, cy);
        g.lineTo(cx, cy + r);
        g.lineTo(cx - r, cy);
        g.closePath();
        g.fill();
      }
      const pad = Math.max(1, Math.round(cell * 0.1));
      snake.forEach((p, i) => {
        g.fillStyle = i === 0 ? C.green : 'rgba(79, 216, 138, 0.7)';
        g.fillRect(p.x * cell + pad, p.y * cell + pad, cell - pad * 2, cell - pad * 2);
      });
    }

    resize();
    opts.onProgress(0);
    f.panel.show('SIGNAL ROUTING', `Collect data nodes. Avoid the walls and your own trail. TARGET: ${opts.target} DATA NODES IN ONE RUN.`, opts.labels.start, start);

    return {
      destroy() {
        clearTimeout(timer);
        mode = 'done';
        f.destroy();
      },
    };
  };

  // ─────────────────────────── GAME 3: VERTICAL EXTRACTION (climber) ───────────────────────────

  games.climber = function (mount, opts) {
    const SPACING = 104; // vertical gap between floors (px)
    const GRAVITY = 1500; // px/s²
    const JUMP = 760; // px/s — clears one floor, with ~250 px of sideways reach per jump
    const SPEED = 300; // sideways px/s
    const P = 28; // player size
    // Difficulty: narrow platforms, a forced sideways shift on every floor, moving platforms
    // from MOVING_FROM, and platforms that crumble after one bounce from CRUMBLE_FROM.
    const MOVING_FROM = 6;
    const CRUMBLE_FROM = 14;

    let mode = 'ready';
    let W = 360;
    let H = 520;
    let g = null;
    let raf = 0;
    let fallback = 0;
    let last = 0;
    let platforms = [];
    let player = null;
    let camera = 0;
    let level = 0;
    let steer = { left: false, right: false };

    const hold = (side) =>
      control(side === 'left' ? '◀' : '▶', side === 'left' ? 'Move left' : 'Move right', () => (steer[side] = true), {
        onUp: () => (steer[side] = false),
        className: 'game-btn-wide',
      });
    const leftBtn = hold('left');
    const rightBtn = hold('right');

    const f = frame(mount, {
      ariaLabel: 'Vertical extraction route',
      controls: [leftBtn, rightBtn],
      onKey(event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
        steer[event.key === 'ArrowLeft' ? 'left' : 'right'] = event.type === 'keydown';
        return true;
      },
      onResize: () => resize(),
      onHide: () => mode === 'running' && pause(),
    });
    const keyUp = (event) => {
      if (event.key === 'ArrowLeft') steer.left = false;
      if (event.key === 'ArrowRight') steer.right = false;
    };
    document.addEventListener('keyup', keyUp);

    // Pressing the left or right half of the board also steers.
    const pointerSteer = (event) => {
      const rect = f.canvas.getBoundingClientRect();
      const side = event.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
      steer = { left: side === 'left', right: side === 'right' };
    };
    f.canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      pointerSteer(event);
    });
    f.canvas.addEventListener('pointermove', (event) => event.buttons && pointerSteer(event));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => f.canvas.addEventListener(type, () => (steer = { left: false, right: false })));

    const safe = (fn) => guarded(fn, fault);

    function fault() {
      halt();
      mode = 'over';
      f.panel.show('SIMULATION FAULT', 'Something went wrong. Restart to try again.', opts.labels.restart, start, 'error');
    }

    const groundY = () => H - 26;

    function buildRoute() {
      platforms = [{ floor: 0, x: 0, y: groundY(), w: W, vx: 0 }];
      let prevCenter = W / 2;
      for (let floor = 1; floor <= opts.target + 6; floor++) {
        const w = Math.max(54, W * (0.32 - floor * 0.007));
        // Shift sideways by at least 18% of the width, never beyond one jump's reach.
        const minShift = W * 0.18;
        const maxShift = Math.max(minShift, Math.min(230, W * 0.45));
        const shift = minShift + Math.random() * (maxShift - minShift);
        let sign = Math.random() < 0.5 ? -1 : 1;
        if (prevCenter + sign * shift < w / 2 || prevCenter + sign * shift > W - w / 2) sign = -sign;
        const center = Math.min(W - w / 2, Math.max(w / 2, prevCenter + sign * shift));
        const moves = floor >= MOVING_FROM && (floor > MOVING_FROM + 4 || Math.random() < 0.5);
        const moving = moves ? (Math.random() < 0.5 ? -1 : 1) * (50 + (floor - MOVING_FROM) * 6) : 0;
        const crumble = floor >= CRUMBLE_FROM && floor !== opts.target && Math.random() < 0.4;
        platforms.push({ floor, x: center - w / 2, y: groundY() - floor * SPACING, w, vx: moving, crumble, gone: false });
        prevCenter = center;
      }
    }

    function start() {
      halt();
      buildRoute();
      player = { x: W / 2 - P / 2, y: groundY() - P, vy: -JUMP };
      camera = 0;
      level = 0;
      steer = { left: false, right: false };
      opts.onProgress(0);
      mode = 'running';
      f.panel.hide();
      last = 0;
      schedule();
    }

    function pause() {
      halt();
      mode = 'paused';
      f.panel.show('SIMULATION PAUSED', `LEVEL ${level}`, 'RESUME', () => {
        mode = 'running';
        f.panel.hide();
        last = 0;
        schedule();
      });
    }

    function fell() {
      halt();
      mode = 'over';
      OG.sound.play('error');
      opts.onRunEnd(level);
      f.panel.show('EXTRACTION FAILED', `REACHED LEVEL ${level} OF ${opts.target}. Runs are unlimited.`, opts.labels.restart, start, 'error');
    }

    function complete() {
      halt();
      mode = 'done';
      draw();
      f.panel.show('EXTRACTION THRESHOLD REACHED', `LEVEL ${level}`, null, null, 'ok');
      opts.onComplete(level);
    }

    function update(dt) {
      const vx = ((steer.right ? 1 : 0) - (steer.left ? 1 : 0)) * SPEED;
      player.x += vx * dt;
      if (player.x < -P / 2) player.x += W;
      if (player.x > W - P / 2) player.x -= W;

      for (const p of platforms) {
        if (!p.vx) continue;
        p.x += p.vx * dt;
        if (p.x < 0 || p.x + p.w > W) {
          p.vx = -p.vx;
          p.x = Math.max(0, Math.min(W - p.w, p.x));
        }
      }

      const prevBottom = player.y + P;
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;

      if (player.vy > 0) {
        for (const p of platforms) {
          if (p.gone) continue;
          const bottom = player.y + P;
          if (prevBottom <= p.y && bottom >= p.y && player.x + P > p.x && player.x < p.x + p.w) {
            player.y = p.y - P;
            player.vy = -JUMP;
            if (p.crumble) p.gone = true; // one bounce only: no falling back to it
            if (p.floor > level) {
              level = p.floor;
              OG.sound.play('key');
              opts.onProgress(level);
              if (level >= opts.target) return complete();
            }
            break;
          }
        }
      }

      const follow = player.y - H * 0.42;
      if (follow < camera) camera = follow;
      if (player.y - camera > H + 40) return fell();
    }

    // Animation frames drive the climb; a timer takes over if the browser throttles frames
    // (Low Power Mode, background tabs), so the simulation can never freeze mid-run.
    function schedule() {
      raf = requestAnimationFrame(loop);
      clearTimeout(fallback);
      fallback = setTimeout(() => {
        cancelAnimationFrame(raf);
        loop(performance.now());
      }, 34);
    }

    function halt() {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    }

    const loop = (time) => {
      clearTimeout(fallback);
      if (mode !== 'running') return;
      const dt = last ? Math.min(0.033, Math.max(0, time - last) / 1000) : 1 / 60;
      last = time;
      safe(() => {
        update(dt);
        draw();
      })();
      if (mode === 'running') schedule();
    };

    function resize() {
      const newW = Math.max(240, Math.min(560, f.stage.clientWidth));
      const newH = Math.max(320, f.stage.clientHeight);
      const changed = newW !== W || newH !== H;
      W = newW;
      H = newH;
      g = sizeCanvas(f.canvas, W, H);
      if (changed && mode !== 'running') {
        buildRoute();
        player = { x: W / 2 - P / 2, y: groundY() - P, vy: 0 };
        camera = 0;
      }
      draw();
    }

    function draw() {
      if (!g || !player) return;
      g.fillStyle = C.bg;
      g.fillRect(0, 0, W, H);
      // faint horizontal rules for a sense of height
      g.strokeStyle = C.grid;
      g.lineWidth = 1;
      const offset = ((-camera % 46) + 46) % 46;
      for (let y = offset; y < H; y += 46) {
        g.beginPath();
        g.moveTo(0, y + 0.5);
        g.lineTo(W, y + 0.5);
        g.stroke();
      }
      g.font = `600 11px ${C.font}`;
      g.textBaseline = 'bottom';
      for (const p of platforms) {
        const y = p.y - camera;
        if (p.gone || y < -20 || y > H + 20) continue;
        const isTarget = p.floor === opts.target;
        if (p.crumble) {
          // Crumbling platforms: dashed red outline, so he can see they won't hold twice.
          g.fillStyle = 'rgba(255, 93, 85, 0.18)';
          g.fillRect(p.x, y, p.w, 9);
          g.strokeStyle = C.red;
          g.setLineDash([6, 4]);
          g.strokeRect(p.x + 0.5, y + 0.5, p.w - 1, 8);
          g.setLineDash([]);
        } else {
          g.fillStyle = isTarget ? C.amber : p.floor <= level ? C.green : 'rgba(79, 216, 138, 0.75)';
          g.fillRect(p.x, y, p.w, 9);
        }
        if (p.floor > 0) {
          g.fillStyle = isTarget ? C.amber : C.dim;
          g.fillText(isTarget ? `LEVEL ${p.floor} · EXTRACTION` : String(p.floor).padStart(2, '0'), p.x + 4, y - 3);
        }
      }
      const py = player.y - camera;
      g.fillStyle = C.amber;
      g.fillRect(player.x, py, P, P);
      if (player.x + P > W) g.fillRect(player.x - W, py, P, P); // wrap-around ghost
      g.fillStyle = '#1f1300';
      g.fillRect(player.x + 5, py + 8, P - 10, 5);
    }

    resize();
    buildRoute();
    player = { x: W / 2 - P / 2, y: groundY() - P, vy: 0 };
    draw();
    opts.onProgress(0);
    f.panel.show(
      'VERTICAL EXTRACTION',
      `Steer left and right. Your agent bounces automatically. Red dashed platforms crumble after one bounce. TARGET: LEVEL ${opts.target}.`,
      opts.labels.start,
      start
    );

    return {
      destroy() {
        halt();
        mode = 'done';
        document.removeEventListener('keyup', keyUp);
        f.destroy();
      },
    };
  };
})();
