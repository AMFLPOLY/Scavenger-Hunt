/* localStorage wrapper. Every call is safe: if storage is blocked, the game still runs (it just won't remember). */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  function available() {
    try {
      const probe = '__og_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  function parse(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function load(key) {
    try {
      return parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      /* nothing to do */
    }
  }

  OG.storage = { available, parse, load, save, remove };
})();
