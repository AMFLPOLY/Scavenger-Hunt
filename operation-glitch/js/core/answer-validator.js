/* Forgiving answer checking, plus the verdict for every Access Terminal lock type. */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  const DEFAULTS = { ignoreLeadingArticles: true, allowSmallTypos: true };
  // Typo tolerance only kicks in for answers this long (short words are too easy to hit by accident).
  const TYPO_MIN_LENGTH = 5;

  /** "  The TV-Remote! " → "tv remote" */
  function normalize(input, options) {
    const opts = { ...DEFAULTS, ...options };
    let s = String(input == null ? '' : input)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // café → cafe
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’‘`´]/g, '') // don't → dont
      .replace(/[^\p{L}\p{N}]+/gu, ' ') // any other punctuation → space
      .trim()
      .replace(/\s+/g, ' ');
    if (opts.ignoreLeadingArticles) s = s.replace(/^(the|a|an) /, '');
    return s;
  }

  const compact = (s) => s.replace(/ /g, '');

  /** Optimal-string-alignment distance: insert, delete, substitute or swap two neighbours = 1 each. */
  function editDistance(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const d = Array.from({ length: rows }, (_, i) => {
      const row = new Array(cols).fill(0);
      row[0] = i;
      return row;
    });
    for (let j = 0; j < cols; j++) d[0][j] = j;
    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[rows - 1][cols - 1];
  }

  /** True when `input` matches any of `acceptedAnswers` after normalizing both. */
  function matches(input, acceptedAnswers, options) {
    const opts = { ...DEFAULTS, ...options };
    const guess = normalize(input, opts);
    if (!guess) return false;
    const guessCompact = compact(guess);

    return (acceptedAnswers || []).some((answer) => {
      const target = normalize(answer, opts);
      if (!target) return false;
      const targetCompact = compact(target);
      if (guess === target || guessCompact === targetCompact) return true; // "olivegarden" = "olive garden"
      return (
        opts.allowSmallTypos &&
        targetCompact.length >= TYPO_MIN_LENGTH &&
        !/\d/.test(targetCompact) && // never fuzzy-match codes or numbers
        editDistance(guessCompact, targetCompact) <= 1
      );
    });
  }

  /** '▲■●' or ['RED', 'BLUE'] → ['▲', '■', '●'] / ['RED', 'BLUE'] */
  function tokens(value) {
    const list = Array.isArray(value) ? value : Array.from(String(value == null ? '' : value));
    return list.map((t) => String(t).trim().toUpperCase()).filter(Boolean);
  }

  const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /**
   * Verdict for an Access Terminal attempt: 'empty' | 'wrong' | 'correct' | 'override'.
   * value: a string (text, phrase, cipher, keypad), symbol tokens (sequence) or item indexes (order).
   */
  function checkLock(lock, value, config) {
    switch (lock.type) {
      case 'sequence': {
        const guess = tokens(value);
        if (!guess.length) return 'empty';
        return sameList(guess, lock.sequence) ? 'correct' : 'wrong';
      }
      case 'order': {
        const picked = Array.isArray(value) ? value : [];
        if (!picked.length) return 'empty';
        return picked.length === lock.items.length && picked.every((item, i) => item === i) ? 'correct' : 'wrong';
      }
      case 'keypad': {
        const digits = String(value || '').replace(/\s/g, '');
        if (!digits) return 'empty';
        return matches(digits, lock.answers, { allowSmallTypos: false, ignoreLeadingArticles: false }) ? 'correct' : 'wrong';
      }
      default: {
        if (!normalize(value)) return 'empty';
        const override = config.gameMaster.overrideCode;
        if (override && matches(value, [override], { allowSmallTypos: false })) return 'override';
        const options = { ...config.answers };
        if (lock.allowSmallTypos != null) options.allowSmallTypos = !!lock.allowSmallTypos;
        return matches(value, lock.answers, options) ? 'correct' : 'wrong';
      }
    }
  }

  OG.answers = { normalize, matches, editDistance, tokens, checkLock };

  /** Rotation (Caesar) cipher used by the decoder and by { cipher } blocks in case files. */
  OG.cipher = {
    shift(text, amount) {
      const n = ((Math.round(Number(amount) || 0) % 26) + 26) % 26;
      return String(text == null ? '' : text).replace(/[a-z]/gi, (ch) => {
        const base = ch <= 'Z' ? 65 : 97;
        return String.fromCharCode(((ch.charCodeAt(0) - base + n) % 26) + base);
      });
    },
  };
})();
