/* Tiny DOM helpers shared by every UI file. */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  function append(el, children) {
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false || child === true || child === '') continue;
      el.append(child instanceof Node ? child : String(child));
    }
    return el;
  }

  /**
   * Create an element:  h('button', { class: 'btn', onClick: fn }, 'Label')
   * - `class`, `dataset`, `style` (supports '--custom-props') are special-cased
   * - `onSomething` functions become event listeners
   * - aria-*, data-*, role and unknown keys become attributes; the rest are properties
   */
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key === 'style') {
          for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, String(v));
        } else if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key.startsWith('aria-') || key.startsWith('data-') || key === 'role' || !(key in el)) {
          el.setAttribute(key, value === true ? '' : String(value));
        } else {
          el[key] = value;
        }
      }
    }
    return append(el, children);
  }

  /** Element from trusted, hard-coded SVG markup (icons only). */
  function svg(markup) {
    const wrap = document.createElement('span');
    wrap.className = 'icon';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = markup;
    return wrap;
  }

  OG.dom = { h, append, svg };
})();
