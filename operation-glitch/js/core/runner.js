/*
 * Delivers Comms messages one at a time, with a short "typing" pause, so the handler
 * feels live. Runs whatever screen is open. Progress never waits on the clock: the
 * pause is only between messages, and tapping "typing…" delivers the next one at once.
 */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  function typingDelay(item) {
    if (item.kind === 'handler' || item.kind === 'hint') return Math.min(1900, Math.max(700, 450 + item.length * 16));
    return 420;
  }

  /**
   * onTyping(isTyping) — the handler is "typing" the next message.
   * onDelivered(entries) — new Comms entries just arrived.
   */
  OG.createRunner = function (store, missions, { onTyping, onDelivered }) {
    let timer = 0;
    let pendingKey = null;
    let typing = false;

    const setTyping = (on) => {
      if (on === typing) return;
      typing = on;
      onTyping(on);
    };

    function deliver() {
      timer = 0;
      pendingKey = null;
      const before = store.getState().log;
      const changed = store.dispatch({ type: 'DELIVER_NEXT', now: Date.now() });
      if (!changed) {
        setTyping(false);
        return;
      }
      const after = store.getState().log;
      const lastId = before.length ? before[before.length - 1].id : 0;
      const fresh = after.filter((entry) => entry.id > lastId);
      if (fresh.length) onDelivered(fresh);
    }

    function check() {
      const next = OG.game.nextDelivery(store.getState(), missions);
      if (!next) {
        clearTimeout(timer);
        timer = 0;
        pendingKey = null;
        setTyping(false);
        return;
      }
      if (timer && pendingKey === next.key) return; // already on its way
      clearTimeout(timer);
      pendingKey = next.key;
      setTyping(next.kind === 'handler' || next.kind === 'hint');
      timer = setTimeout(deliver, typingDelay(next));
    }

    store.subscribe(check);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    check();

    return {
      /** Deliver the pending message now (tapping "handler is typing"). */
      flush() {
        if (!pendingKey) return;
        clearTimeout(timer);
        deliver();
      },
      isTyping: () => typing,
    };
  };
})();
