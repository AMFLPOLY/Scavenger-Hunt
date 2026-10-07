/*
 * The mission engine. All progress is one plain object, changed only through actions
 * and saved after every change.
 *
 * Each mission is a script of steps. A cursor (missionIndex, stepIndex) walks through it.
 * Messages are delivered one at a time by the runner (runner.js) via DELIVER_NEXT; the
 * cursor stops at "blocking" steps — lock, ask, game — until the player (or you) acts.
 * Progress depends only on what he does: there are no clock-based gates.
 *
 * Comms history is stored in `log`. Entries carry raw content text or a `code` that the
 * screen turns into wording from game-config.js, so the engine itself holds no copy.
 *
 * Actions
 *   ACTIVATE                         first launch finished
 *   DELIVER_NEXT                     deliver the next queued reply or script step
 *   REPLY        {label, ...}        player tapped a reply button (may answer an ask)
 *   SOLVE        {lockId}            a lock was opened
 *   WRONG        {lockId}            count a wrong key
 *   GAME_COMPLETE {gameId}           a training simulation reached its target
 *   GAME_BEST    {gameId, value}     remember his best run
 *   GAME_RESET   {gameId}            Game Master: clear a simulation's result
 *   GAME_TARGET  {gameId, target}    Game Master: change a simulation's target
 *   MARK_READ    {upTo}              Comms has been read up to this log length
 *   OPEN_FILE    {id}                a case file was opened
 *   SKIP_STEP                        Game Master: get past the current blocking step
 *   JUMP         {index}             Game Master: start mission `index` (missions.length = end)
 *   UNLOCK_FILE  {id} / UNLOCK_TOOL {tool}
 *   INJECT       {kind, text, transmissionId}   Game Master message (local or remote link)
 *   REMOTE       {transmissionId, cmd}          remote command from a link ('skip')
 *   RESET
 */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  const VERSION = 3;
  const MAX_LOG = 500;

  function freshProgress() {
    return {
      version: VERSION,
      activated: false,
      missionIndex: 0,
      stepIndex: 0,
      announced: false, // the current blocking step has been shown in Comms
      seq: 0,
      log: [],
      outbox: [], // replies waiting for their "typing" pause
      lastRead: 0,
      solved: [],
      hintsUsed: {},
      wrongAttempts: {},
      games: {}, // id → { done, best }
      gameTargets: {}, // id → target set by the Game Master
      files: {}, // id → { at, opened }
      tools: [], // unlocked during play (defaults come from game-config.js)
      clearance: 0,
      evidence: [], // { text, at }
      transmissions: [], // remote links already processed
      complete: false,
      startedAt: null,
      finishedAt: null,
    };
  }

  const iso = (now) => new Date(now || Date.now()).toISOString();

  function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  }

  function addLog(state, entry, now) {
    const seq = state.seq + 1;
    const log = [...state.log, { id: seq, at: iso(now), ...entry }];
    const trimmed = log.length > MAX_LOG ? log.slice(log.length - MAX_LOG) : log;
    const lastRead = Math.max(0, state.lastRead - (log.length - trimmed.length));
    return { ...state, seq, log: trimmed, lastRead };
  }

  function queue(state, entries) {
    let seq = state.seq;
    const items = entries.filter(Boolean).map((entry) => ({ ...entry, id: ++seq }));
    return { ...state, seq, outbox: [...state.outbox, ...items] };
  }

  const advance = (state) => ({ ...state, stepIndex: state.stepIndex + 1, announced: false });

  function currentStep(state, missions) {
    const mission = missions[state.missionIndex];
    return mission ? mission.steps[state.stepIndex] || null : null;
  }

  const gameDone = (state, id) => !!(state.games[id] && state.games[id].done);

  function setGame(state, id, patch) {
    const prev = state.games[id] || { done: false, best: 0 };
    return { ...state, games: { ...state.games, [id]: { ...prev, ...patch } } };
  }

  function unlockFile(state, id, now) {
    return state.files[id] ? state : { ...state, files: { ...state.files, [id]: { at: iso(now), opened: false } } };
  }

  function finishMission(state, missions, now) {
    const n = state.missionIndex;
    let s = addLog(state, { kind: 'system', code: 'missionComplete', n: n + 1 }, now);
    if (n + 1 < missions.length) {
      s = { ...s, missionIndex: n + 1, stepIndex: 0, announced: false };
      return addLog(s, { kind: 'mission', missionId: missions[n + 1].id }, now);
    }
    s = { ...s, complete: true, finishedAt: s.finishedAt || iso(now), stepIndex: missions[n].steps.length, announced: false };
    return addLog(s, { kind: 'system', code: 'operationComplete' }, now);
  }

  function deliverNext(state, missions, now) {
    if (state.outbox.length) {
      const [item, ...rest] = state.outbox;
      const { id, ...entry } = item;
      return addLog({ ...state, outbox: rest }, entry, now);
    }
    if (!state.activated || state.complete) return state;

    const step = currentStep(state, missions);
    if (!step) return finishMission(state, missions, now);

    switch (step.type) {
      case 'handler':
        return advance(addLog(state, { kind: 'handler', text: step.text, time: step.time || null }, now));
      case 'system':
        return advance(addLog(state, { kind: 'system', text: step.text }, now));
      case 'task':
        return advance(addLog(state, { kind: 'task', text: step.text }, now));
      case 'contact':
        return advance(addLog(state, { kind: 'contact', contactId: step.contactId }, now));
      case 'evidence': {
        const s = { ...state, evidence: [...state.evidence, { text: step.text, at: iso(now) }] };
        return advance(addLog(s, { kind: 'system', code: 'evidence', text: step.text }, now));
      }
      case 'unlock': {
        let s = state;
        for (const id of step.files) {
          if (s.files[id]) continue;
          s = addLog(unlockFile(s, id, now), { kind: 'system', code: 'file', fileId: id }, now);
        }
        for (const tool of step.tools) {
          if (s.tools.includes(tool)) continue;
          s = addLog({ ...s, tools: [...s.tools, tool] }, { kind: 'system', code: 'tool', tool }, now);
        }
        if (step.clearance > s.clearance) {
          s = addLog({ ...s, clearance: step.clearance }, { kind: 'system', code: 'clearance', level: step.clearance }, now);
        }
        return advance(s);
      }
      case 'lock':
        return state.announced ? state : { ...addLog(state, { kind: 'lock', lockId: step.lock.id }, now), announced: true };
      case 'ask':
        return state.announced ? state : { ...addLog(state, { kind: 'handler', text: step.text, ask: step.key }, now), announced: true };
      case 'game': {
        const id = step.game.id;
        if (!state.announced) {
          // Announcing a simulation also brings the Training Simulator online.
          const s = state.games[id] ? state : setGame(state, id, {});
          return { ...addLog(s, { kind: 'game', gameId: id }, now), announced: true };
        }
        return gameDone(state, id) ? advance(addLog(state, { kind: 'system', code: 'gameComplete', gameId: id }, now)) : state;
      }
      default:
        return advance(state); // 'objective' steps only change the current objective
    }
  }

  /** What DELIVER_NEXT would do right now, or null if the script is waiting on the player. */
  function nextDelivery(state, missions) {
    if (state.outbox.length) {
      const item = state.outbox[0];
      return { key: `out:${item.id}`, kind: item.kind, length: String(item.text || '').length };
    }
    if (!state.activated || state.complete) return null;
    const step = currentStep(state, missions);
    if (!step) return { key: `end:${state.missionIndex}`, kind: 'system', length: 0 };
    if (step.type === 'lock' || step.type === 'ask') {
      return state.announced ? null : { key: step.key, kind: step.type === 'ask' ? 'handler' : 'system', length: String(step.text || '').length };
    }
    if (step.type === 'game') {
      if (!state.announced) return { key: step.key, kind: 'system', length: 0 };
      return gameDone(state, step.game.id) ? { key: `${step.key}:done`, kind: 'system', length: 0 } : null;
    }
    return { key: step.key, kind: step.type === 'handler' ? 'handler' : 'system', length: String(step.text || '').length };
  }

  /** Game Master jump: rebuild unlocks from the missions before `target`, keep history and stats. */
  function jump(state, missions, target, now) {
    const n = missions.length;
    const to = clampInt(target, 0, n);
    const s = {
      ...state,
      activated: true,
      startedAt: state.startedAt || iso(now),
      solved: [],
      files: {},
      tools: [],
      clearance: 0,
      evidence: [],
      outbox: [],
      announced: false,
      complete: false,
      finishedAt: null,
      games: { ...state.games },
    };
    for (const mission of missions.slice(0, to)) {
      for (const step of mission.steps) {
        if (step.type === 'lock') s.solved.push(step.lock.id);
        if (step.type === 'evidence') s.evidence.push({ text: step.text, at: iso(now) });
        if (step.type === 'game') s.games[step.game.id] = { best: 0, ...state.games[step.game.id], done: true };
        if (step.type === 'unlock') {
          step.files.forEach((id) => (s.files[id] = state.files[id] || { at: iso(now), opened: false }));
          step.tools.forEach((tool) => s.tools.includes(tool) || s.tools.push(tool));
          if (step.clearance > s.clearance) s.clearance = step.clearance;
        }
      }
    }
    if (to >= n) {
      const done = { ...s, missionIndex: n - 1, stepIndex: missions[n - 1].steps.length, complete: true, finishedAt: state.finishedAt || iso(now) };
      return addLog(addLog(done, { kind: 'system', code: 'jumped', n: 'END' }, now), { kind: 'system', code: 'operationComplete' }, now);
    }
    const started = { ...s, missionIndex: to, stepIndex: 0 };
    return addLog(addLog(started, { kind: 'system', code: 'jumped', n: to + 1 }, now), { kind: 'mission', missionId: missions[to].id }, now);
  }

  function skipStep(state, missions, now) {
    if (!state.activated || state.complete) return state;
    const step = currentStep(state, missions);
    if (!step) return finishMission(state, missions, now);
    switch (step.type) {
      case 'lock':
        return reduce(state, { type: 'SOLVE', lockId: step.lock.id, override: true, now }, missions);
      case 'game':
        return reduce(state.announced ? state : deliverNext(state, missions, now), { type: 'GAME_COMPLETE', gameId: step.game.id, now }, missions);
      case 'ask':
        return advance(state.announced ? state : addLog(state, { kind: 'handler', text: step.text, ask: step.key }, now));
      default:
        return deliverNext(state, missions, now);
    }
  }

  function reduce(state, action, missions) {
    const now = action.now || Date.now();
    switch (action.type) {
      case 'ACTIVATE':
        if (state.activated) return state;
        return addLog({ ...state, activated: true, startedAt: state.startedAt || iso(now) }, { kind: 'mission', missionId: missions[0].id }, now);

      case 'DELIVER_NEXT':
        return deliverNext(state, missions, now);

      case 'REPLY': {
        // silent: sent by the Game Master, so no "AGENT" bubble.
        let s = action.silent ? state : addLog(state, { kind: 'agent', text: action.label }, now);
        const step = currentStep(s, missions);
        if (action.ask && step && step.type === 'ask' && s.announced && step.key === action.ask) s = advance(s);
        if (action.hintFor) s = { ...s, hintsUsed: { ...s.hintsUsed, [action.hintFor]: (s.hintsUsed[action.hintFor] || 0) + 1 } };
        if (action.responses && action.responses.length) s = queue(s, action.responses);
        return s;
      }

      case 'SOLVE': {
        const step = currentStep(state, missions);
        if (!step || step.type !== 'lock' || step.lock.id !== action.lockId) return state;
        let s = { ...state, solved: [...state.solved, step.lock.id] };
        s = addLog(s, { kind: 'system', code: 'keyAccepted', lockId: step.lock.id, override: !!action.override }, now);
        if (action.overrideText) s = queue(s, [{ kind: 'handler', text: action.overrideText }]);
        return advance(s);
      }

      case 'WRONG': {
        const id = action.lockId;
        return { ...state, wrongAttempts: { ...state.wrongAttempts, [id]: (state.wrongAttempts[id] || 0) + 1 } };
      }

      case 'GAME_COMPLETE': {
        const id = action.gameId;
        let s = gameDone(state, id) ? state : setGame(state, id, { done: true });
        const step = currentStep(s, missions);
        // If he is on this simulation right now, move straight on.
        if (step && step.type === 'game' && step.game.id === id && s.announced) {
          s = advance(addLog(s, { kind: 'system', code: 'gameComplete', gameId: id }, now));
        }
        return s;
      }

      case 'GAME_BEST': {
        const prev = state.games[action.gameId] || { done: false, best: 0 };
        const value = Math.floor(Number(action.value)) || 0;
        return value > (prev.best || 0) ? setGame(state, action.gameId, { best: value }) : state;
      }

      case 'GAME_RESET': {
        if (!state.games[action.gameId]) return state;
        const step = currentStep(state, missions);
        const isCurrent = step && step.type === 'game' && step.game.id === action.gameId;
        // Only a simulation he hasn't moved past can be made incomplete again.
        return setGame(state, action.gameId, { done: isCurrent ? false : state.games[action.gameId].done, best: 0 });
      }

      case 'GAME_TARGET': {
        const target = Math.floor(Number(action.target));
        if (!(target > 0)) return state;
        return { ...state, gameTargets: { ...state.gameTargets, [action.gameId]: target } };
      }

      case 'MARK_READ': {
        const upTo = Math.min(state.log.length, action.upTo);
        return upTo > state.lastRead ? { ...state, lastRead: upTo } : state;
      }

      case 'OPEN_FILE': {
        const file = state.files[action.id];
        return !file || file.opened ? state : { ...state, files: { ...state.files, [action.id]: { ...file, opened: true } } };
      }

      case 'SKIP_STEP':
        return skipStep(state, missions, now);

      case 'JUMP':
        return jump(state, missions, action.index, now);

      case 'UNLOCK_FILE':
        if (state.files[action.id]) return state;
        return addLog(unlockFile(state, action.id, now), { kind: 'system', code: 'file', fileId: action.id }, now);

      case 'UNLOCK_TOOL':
        if (state.tools.includes(action.tool)) return state;
        return addLog({ ...state, tools: [...state.tools, action.tool] }, { kind: 'system', code: 'tool', tool: action.tool }, now);

      case 'INJECT': {
        if (action.transmissionId && state.transmissions.includes(action.transmissionId)) return state;
        const s = action.transmissionId ? { ...state, transmissions: [...state.transmissions, action.transmissionId].slice(-100) } : state;
        return queue(s, [{ kind: action.kind === 'system' ? 'system' : 'handler', text: String(action.text || '') }]);
      }

      case 'REMOTE': {
        if (!action.transmissionId || state.transmissions.includes(action.transmissionId)) return state;
        const s = { ...state, transmissions: [...state.transmissions, action.transmissionId].slice(-100) };
        return action.cmd === 'skip' ? skipStep(s, missions, now) : s;
      }

      case 'RESET':
        return freshProgress();

      default:
        return state;
    }
  }

  // ── Selectors (read-only questions about progress) ──

  function activeStep(state, missions, type) {
    if (!state.activated || state.complete || !state.announced) return null;
    const step = currentStep(state, missions);
    return step && step.type === type ? step : null;
  }

  const activeLock = (state, missions) => {
    const step = activeStep(state, missions, 'lock');
    return step ? step.lock : null;
  };
  const activeAsk = (state, missions) => activeStep(state, missions, 'ask');
  const activeGame = (state, missions) => {
    const step = activeStep(state, missions, 'game');
    return step && !gameDone(state, step.game.id) ? step.game : null;
  };

  /** A simulation's target, including any Game Master adjustment. */
  const gameTarget = (state, game) => state.gameTargets[game.id] || game.target;

  /** What he should be doing now: { text } | { game } | { complete: true } | null */
  function objective(state, missions) {
    if (!state.activated) return null;
    if (state.complete) return { complete: true };
    const mission = missions[state.missionIndex];
    const ask = activeAsk(state, missions);
    if (ask) return { text: ask.text };
    const game = activeGame(state, missions);
    if (game) return { game };
    // Latest task/objective since the last lock or simulation in this mission.
    for (let i = state.stepIndex - 1; i >= 0; i--) {
      const step = mission.steps[i];
      if (step.type === 'task' || step.type === 'objective') return { text: step.text };
      if (step.type === 'lock' || step.type === 'game') break;
    }
    const lock = activeLock(state, missions);
    if (lock) return { text: lock.clarify || lock.prompt };
    return mission.objective ? { text: mission.objective } : null;
  }

  const unreadCount = (state) => state.log.slice(state.lastRead).filter((e) => e.kind !== 'agent' && e.kind !== 'mission').length;

  function unlockedTools(state, config) {
    const tools = new Set(Object.keys(config.tools).filter((key) => config.tools[key].unlocked));
    state.tools.forEach((tool) => tools.add(tool));
    if (Object.keys(state.games).length) tools.add('training');
    if (state.complete) tools.add('report');
    return tools;
  }

  const clearanceLevel = (state, config) => Math.max(Number(config.clearance.start) || 1, state.clearance);

  function stats(state, missions) {
    const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      missionsDone: state.complete ? missions.length : state.missionIndex,
      missionsTotal: missions.length,
      hints: sum(state.hintsUsed),
      wrong: sum(state.wrongAttempts),
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
    };
  }

  // ── Saved-progress repair (missions or files may be edited between sessions) ──

  function sanitize(raw, missions, fileIds) {
    const base = freshProgress();
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !missions.length) return base;
    const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    const counts = (v) => {
      const out = {};
      if (v && typeof v === 'object') {
        for (const [k, n] of Object.entries(v)) if (Number(n) > 0) out[k] = Math.floor(Number(n));
      }
      return out;
    };
    const isEntry = (e) => e && typeof e === 'object' && typeof e.kind === 'string';

    const s = { ...base };
    s.activated = !!raw.activated;
    s.missionIndex = clampInt(raw.missionIndex, 0, missions.length - 1);
    s.stepIndex = clampInt(raw.stepIndex, 0, missions[s.missionIndex].steps.length);
    s.announced = !!raw.announced;
    s.log = Array.isArray(raw.log) ? raw.log.filter(isEntry).slice(-MAX_LOG) : [];
    s.outbox = Array.isArray(raw.outbox) ? raw.outbox.filter(isEntry) : [];
    s.lastRead = clampInt(raw.lastRead, 0, s.log.length);
    s.solved = strings(raw.solved);
    s.hintsUsed = counts(raw.hintsUsed);
    s.wrongAttempts = counts(raw.wrongAttempts);
    s.gameTargets = counts(raw.gameTargets);
    if (raw.games && typeof raw.games === 'object') {
      for (const [id, g] of Object.entries(raw.games)) {
        if (g && typeof g === 'object') s.games[id] = { done: !!g.done, best: Math.max(0, Math.floor(Number(g.best)) || 0) };
      }
    }
    if (raw.files && typeof raw.files === 'object') {
      for (const [id, f] of Object.entries(raw.files)) {
        if (fileIds.has(id) && f && typeof f === 'object') s.files[id] = { at: typeof f.at === 'string' ? f.at : iso(), opened: !!f.opened };
      }
    }
    s.tools = strings(raw.tools);
    s.clearance = clampInt(raw.clearance, 0, 99);
    s.evidence = Array.isArray(raw.evidence) ? raw.evidence.filter((e) => e && typeof e.text === 'string') : [];
    s.transmissions = strings(raw.transmissions).slice(-100);
    s.complete = !!raw.complete;
    s.startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : null;
    s.finishedAt = typeof raw.finishedAt === 'string' ? raw.finishedAt : null;
    const ids = [...s.log, ...s.outbox].map((e) => Number(e.id) || 0);
    s.seq = Math.max(clampInt(raw.seq, 0, 1e9), ...ids, 0);
    return s;
  }

  function createStore(missions, fileIds, storageKey) {
    let state = sanitize(OG.storage.load(storageKey), missions, fileIds);
    const listeners = new Set();
    const notify = (action) => listeners.forEach((fn) => fn(store.getState(), action));

    // Progress changed in another tab on this device.
    window.addEventListener('storage', (event) => {
      if (event.key !== storageKey) return;
      state = sanitize(OG.storage.parse(event.newValue), missions, fileIds);
      notify({ type: 'EXTERNAL' });
    });

    const store = {
      getState: () => state,
      dispatch(action) {
        const next = reduce(state, action, missions);
        if (next === state) return false;
        state = next;
        OG.storage.save(storageKey, state);
        notify(action);
        return true;
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
    return store;
  }

  OG.game = {
    createStore,
    freshProgress,
    sanitize,
    reduce,
    nextDelivery,
    currentStep,
    activeLock,
    activeAsk,
    activeGame,
    gameTarget,
    objective,
    unreadCount,
    unlockedTools,
    clearanceLevel,
    stats,
  };
})();
