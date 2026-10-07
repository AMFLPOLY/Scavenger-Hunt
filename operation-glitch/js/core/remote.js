/*
 * Remote transmissions: a Game Master message or command packed into a link.
 * You make the link on any device (the Game Master panel), text it to him, and when he
 * opens it his terminal receives it. No server needed. Each link only works once.
 *
 *   ...index.html#transmit=<data>
 *   data = { id, cmd: 'say' | 'skip', kind: 'handler' | 'system', text }
 */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  const PREFIX = '#transmit=';

  function encode(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(data) {
    try {
      let b64 = String(data).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
      return payload && typeof payload === 'object' && payload.id && payload.cmd ? payload : null;
    } catch (e) {
      return null;
    }
  }

  const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  OG.remote = {
    /** A shareable link for this same page. */
    link(payload) {
      const base = location.href.split('#')[0];
      return `${base}${PREFIX}${encode({ id: newId(), ...payload })}`;
    },
    /** The transmission in the current address, if any. */
    fromLocation() {
      return location.hash.startsWith(PREFIX) ? decode(location.hash.slice(PREFIX.length)) : null;
    },
    isTransmission: () => location.hash.startsWith(PREFIX),
  };
})();
