/* Text helpers: {token} replacement, paragraph lists, placeholder highlights and ||redaction|| bars. */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});
  const { h } = OG.dom;

  // "[REPLACE WITH REAL MEMORY]", "[HUSBAND NAME]", "[TEST ANSWER: X]" ...
  const PLACEHOLDER = /\[[A-Z]{2}[^[\]]*\]/g;
  // ||hidden words||
  const REDACTION = /\|\|([^|]+)\|\|/g;

  let tokens = {};
  let highlight = true;

  /** Replace {husbandName}-style tokens. Unknown tokens are left untouched. */
  function fill(value, extra) {
    if (value == null) return '';
    const all = extra ? { ...tokens, ...extra } : tokens;
    return String(value).replace(/\{(\w+)\}/g, (match, key) => (key in all ? String(all[key]) : match));
  }

  /** Content text may be one string or a list of paragraphs; always return a filled list. */
  function paras(value) {
    if (value == null) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.filter((p) => p != null && String(p).trim() !== '').map((p) => fill(p));
  }

  /** Filled text with redactions spelled out, for labels, toasts and screen readers. */
  function plain(value) {
    return fill(value).replace(REDACTION, '[redacted]');
  }

  function appendHighlighted(frag, str) {
    if (!highlight) {
      frag.append(str);
      return;
    }
    let last = 0;
    for (const match of str.matchAll(PLACEHOLDER)) {
      if (match.index > last) frag.append(str.slice(last, match.index));
      frag.append(h('mark', { class: 'ph', title: 'Placeholder: replace in the content files' }, match[0]));
      last = match.index + match[0].length;
    }
    if (last < str.length) frag.append(str.slice(last));
  }

  /** Text as DOM nodes: placeholders highlighted, ||redactions|| drawn as bars (the hidden words are not in the page). */
  function rich(value) {
    const str = fill(value);
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const match of str.matchAll(REDACTION)) {
      if (match.index > last) appendHighlighted(frag, str.slice(last, match.index));
      frag.append(h('span', { class: 'redacted', role: 'img', 'aria-label': 'redacted', style: { '--len': Math.min(match[1].length, 32) } }));
      last = match.index + match[0].length;
    }
    if (last < str.length) appendHighlighted(frag, str.slice(last));
    return frag;
  }

  const pad = (n, width = 2) => String(n).padStart(width, '0');

  /** "07:42" from an ISO date (or a fixed "HH:MM" string, returned as-is). */
  function clock(value) {
    if (!value) return '';
    if (/^\d{1,2}:\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  OG.text = {
    setTokens(next) {
      tokens = { ...next };
    },
    setHighlight(on) {
      highlight = !!on;
    },
    fill,
    paras,
    plain,
    rich,
    pad,
    clock,
    PLACEHOLDER,
  };
})();
