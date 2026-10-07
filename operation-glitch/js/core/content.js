/*
 * Loads the three content files, fills in sensible defaults, turns mission scripts into
 * a uniform list of steps, and collects friendly problem reports for the setup-check
 * screen and the Game Master panel.
 */
(function () {
  'use strict';
  const OG = (window.OG = window.OG || {});

  const CONTENT_FILES = ['game-config.js', 'missions.js', 'case-files.js'];
  const STEP_TYPES = ['handler', 'system', 'task', 'objective', 'ask', 'lock', 'game', 'contact', 'unlock', 'file', 'evidence', 'standby'];
  const LOCK_TYPES = ['text', 'phrase', 'keypad', 'sequence', 'order', 'cipher'];
  const GAME_KINDS = { blocks: 'POINTS', snake: 'DATA NODES', climber: 'LEVEL' };
  const BLOCK_TYPES = ['heading', 'note', 'list', 'log', 'code', 'cipher', 'image'];
  const DEFAULT_PROMPTS = {
    text: 'ENTER ACCESS KEY',
    phrase: 'ENTER PASSPHRASE',
    keypad: 'ENTER ACCESS CODE',
    sequence: 'ENTER SEQUENCE',
    order: 'ARRANGE IN ORDER',
    cipher: 'ENTER DECRYPTED KEY',
  };

  // Fallbacks so a deleted line in game-config.js never crashes the game.
  const CONFIG_DEFAULTS = {
    husbandName: 'AGENT',
    partnerName: '',
    age: '',
    birthdayDate: '',
    operationName: 'OPERATION',
    terminalName: 'FIELD OPERATIONS TERMINAL',
    activation: { eyebrow: '', footer: '', status: 'AWAITING ACTIVATION', button: 'ACTIVATE', sequence: [] },
    clearance: { start: 1, names: {} },
    tools: {
      comms: { label: 'COMMS', sub: '', unlocked: true },
      terminal: { label: 'ACCESS TERMINAL', sub: '', unlocked: true },
      training: { label: 'TRAINING SIMULATOR', sub: '', unlocked: false, hiddenUntilUnlocked: true },
      files: { label: 'CASE FILES', sub: '', unlocked: false, lockedNote: 'LOCKED' },
      diagnostics: { label: 'SYSTEM DIAGNOSTICS', sub: '', unlocked: false, hiddenUntilUnlocked: true },
      report: { label: 'FIELD REPORT', sub: '', unlocked: false, hiddenUntilUnlocked: true },
    },
    hub: { statusTitle: 'SYSTEM STATUS', statusLines: [] },
    diagnostics: { title: 'SYSTEM DIAGNOSTICS', intro: '', lines: [] },
    handler: {
      name: 'HANDLER',
      acknowledgements: ['Noted.'],
      clarification: '{objective}',
      nothingToClarify: 'Stand by.',
      foundSomething: 'Enter it in the Access Terminal.',
      foundNothing: 'Noted.',
      hintQuips: [],
      noHintsLeft: 'No further hints.',
      noHintTarget: 'Nothing to hint at right now.',
      wrongAnswer: ['Incorrect.'],
      suggestHintAfterWrong: 4,
      suggestHint: '',
      overrideMessage: 'Override accepted.',
      trainingHint: 'This is a training simulation. The only assistance available is practice.',
    },
    contacts: {},
    replies: { understood: 'UNDERSTOOD', clarify: 'NEED CLARIFICATION', found: 'I FOUND SOMETHING', hint: 'REQUEST HINT' },
    system: {
      lockActive: 'NEW LOCK ACTIVE',
      keyAccepted: 'ACCESS KEY ACCEPTED',
      commandOverride: 'COMMAND OVERRIDE',
      fileUnlocked: 'CASE FILE UNLOCKED',
      toolOnline: 'NEW TOOL ONLINE',
      clearanceUpdated: 'CLEARANCE LEVEL UPDATED',
      evidenceLogged: 'EVIDENCE LOGGED',
      missionComplete: 'MISSION {n} COMPLETE',
      operationComplete: 'OPERATION COMPLETE',
      jumped: 'MISSION {n} ACTIVE',
      trainingAssigned: 'TRAINING SIMULATION ASSIGNED',
      trainingComplete: 'TRAINING COMPLETE',
      contactAssigned: 'EXTERNAL CONTACT REQUIRED',
    },
    training: { kicker: 'TRAINING SIMULATION', launch: 'LAUNCH SIMULATION', start: 'START SIMULATION', restart: 'RESTART', complete: 'SIMULATION COMPLETE' },
    terminal: {
      connecting: [],
      authenticating: 'AUTHENTICATING...',
      denied: ['ACCESS DENIED'],
      granted: 'ACCESS GRANTED',
      decrypting: 'DECRYPTING...',
      emptyKey: 'NO KEY ENTERED',
      submit: 'AUTHENTICATE',
      idle: 'NO ACTIVE LOCKS',
      idleSub: '',
      afterSuccess: 'NEW TRANSMISSION',
      attempts: 'ATTEMPTS REMAINING: ∞',
      trace: 'TRACE RISK',
      askForHint: 'ASK FOR A HINT',
    },
    report: { title: 'FIELD REPORT', extraRows: [], ratings: [{ upTo: 9999, label: 'ACCEPTABLE' }], signoff: [] },
    answers: { ignoreLeadingArticles: true, allowSmallTypos: true },
    gameMaster: { overrideCode: '', longPressSeconds: 2 },
    sound: { startOn: false },
    haptics: true,
    highlightPlaceholders: true,
    storageKey: 'field-terminal',
  };

  const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

  let knownContacts = {}; // filled from game-config.js at load time

  function merge(defaults, value) {
    if (value === undefined || value === null) return defaults;
    if (!isPlainObject(defaults) || !isPlainObject(value)) return value;
    const out = { ...defaults };
    for (const [key, v] of Object.entries(value)) out[key] = merge(defaults[key], v);
    return out;
  }

  const toList = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);
  const toStrings = (v) => toList(v).filter((x) => x != null && x !== '').map(String);

  function normalizeLock(raw, where, fallbackId, report) {
    if (!isPlainObject(raw)) {
      report.error(`${where}: a lock must be written as { ... }.`);
      return null;
    }
    if (raw.type != null && !LOCK_TYPES.includes(raw.type)) report.warn(`${where}: lock type "${raw.type}" isn't one of ${LOCK_TYPES.join(', ')}, so "text" is used.`);
    const type = LOCK_TYPES.includes(raw.type) ? raw.type : 'text';
    const lock = {
      ...raw,
      type,
      id: raw.id != null && String(raw.id).trim() ? String(raw.id).trim() : fallbackId,
      node: raw.node ? String(raw.node) : '',
      prompt: String(raw.prompt || DEFAULT_PROMPTS[type]),
      instructions: raw.instructions ? String(raw.instructions) : '',
      hints: toStrings(raw.hints),
      hintQuips: toStrings(raw.hintQuips),
      wrong: toStrings(raw.wrong),
      clarify: raw.clarify ? String(raw.clarify) : '',
      mirror: raw.mirror ? String(raw.mirror) : '', // text shown back-to-front, read in a mirror
      preview: !!raw.preview, // sequence locks: a "play sequence" memory preview
      previewLabels: toStrings(raw.previewLabels),
      contact: raw.contact ? String(raw.contact) : '',
    };
    const name = `${where} (lock "${lock.id}")`;
    if (!lock.hints.length) report.warn(`${name} has no hints.`);

    // A contact lock takes its accepted replies from the contacts in game-config.js.
    let contactAnswers = null;
    if (lock.contact) {
      const contact = knownContacts[lock.contact];
      if (!contact) report.error(`${name} uses contact "${lock.contact}", which isn't in the contacts list in game-config.js.`);
      else contactAnswers = toStrings(contact.acceptedReplies).length ? toStrings(contact.acceptedReplies) : toStrings(contact.reply);
    }

    if (type === 'order') {
      lock.items = toStrings(raw.items);
      if (lock.items.length < 2) report.error(`${name} needs at least two items to put in order.`);
    } else if (type === 'sequence') {
      lock.symbols = toStrings(raw.symbols);
      lock.sequence = OG.answers.tokens(raw.answer != null ? raw.answer : toList(raw.answers)[0]);
      if (!lock.symbols.length) report.error(`${name} needs a list of symbols to tap.`);
      if (!lock.sequence.length) report.error(`${name} needs an answer, e.g. answer: ['▲', '■', '●'].`);
      const known = new Set(lock.symbols.map((s) => s.toUpperCase()));
      if (lock.sequence.some((t) => !known.has(t))) report.error(`${name}: its answer uses a symbol that isn't in its symbols list.`);
      lock.length = lock.sequence.length;
    } else {
      lock.answers = toStrings(raw.answers != null ? raw.answers : contactAnswers).filter((a) => a.trim());
      if (!lock.answers.length) report.error(`${name} has no answers, so it can never be opened.`);
      if (type === 'keypad') {
        const first = (lock.answers[0] || '').replace(/\s/g, '');
        lock.length = Number(raw.length) > 0 ? Math.floor(Number(raw.length)) : first.length || 4;
        if (lock.answers.some((a) => /\D/.test(a.replace(/\s/g, '')))) report.error(`${name}: keypad answers can only contain digits.`);
        if (lock.answers.some((a) => a.replace(/\s/g, '').length !== lock.length)) report.warn(`${name}: an answer isn't ${lock.length} digits long.`);
      }
      if (type === 'cipher') {
        const cipher = isPlainObject(raw.cipher) ? raw.cipher : {};
        lock.cipher = { message: String(cipher.message || ''), shift: Number(cipher.shift) || 0 };
        if (!lock.cipher.message) report.error(`${name} needs cipher: { message: '...', shift: 7 }.`);
      }
    }
    return lock;
  }

  function normalizeSteps(raw, mission, where, report) {
    const steps = [];
    toList(raw).forEach((step, i) => {
      const at = `${where}, step ${i + 1}`;
      if (typeof step === 'string') {
        steps.push({ type: 'handler', text: step });
        return;
      }
      if (!isPlainObject(step)) return report.warn(`${at} isn't written as { ... }, so it's skipped.`);
      const type = STEP_TYPES.find((key) => key in step);
      if (!type) return report.warn(`${at} has no recognised type (${STEP_TYPES.join(', ')}), so it's skipped.`);
      const value = step[type];

      switch (type) {
        case 'handler':
        case 'system':
        case 'task':
        case 'objective':
        case 'evidence':
          toStrings(value).forEach((text) => steps.push({ type, text, time: step.time ? String(step.time) : null }));
          break;
        case 'ask': {
          const replies = toStrings(step.replies);
          steps.push({
            type,
            id: step.id != null && String(step.id).trim() ? String(step.id).trim() : `${mission.id}-ask-${i + 1}`,
            text: String(value),
            replies: replies.length ? replies : ['UNDERSTOOD'],
            responses: isPlainObject(step.responses) ? step.responses : {},
            // Optional hints, for asks that hide a reasoning step (e.g. "where does this point?").
            hints: toStrings(step.hints),
            hintQuips: toStrings(step.hintQuips),
          });
          break;
        }
        case 'lock': {
          const lock = normalizeLock(value, at, `${mission.id}-lock-${i + 1}`, report);
          if (lock) steps.push({ type, lock });
          break;
        }
        case 'unlock': {
          const u = isPlainObject(value) ? value : {};
          steps.push({ type, files: toStrings(u.files), tools: toStrings(u.tools), clearance: Number(u.clearance) || 0 });
          break;
        }
        case 'file':
          steps.push({ type: 'unlock', files: toStrings(value), tools: [], clearance: 0 });
          break;
        case 'game': {
          const g = isPlainObject(value) ? value : {};
          const kind = String(g.type || g.kind || '');
          if (!GAME_KINDS[kind]) {
            report.error(`${at}: a game needs type 'blocks', 'snake' or 'climber'.`);
            break;
          }
          const target = Math.floor(Number(g.target));
          if (!(target > 0)) report.error(`${at}: the game needs a target number above 0.`);
          steps.push({
            type,
            game: {
              id: g.id != null && String(g.id).trim() ? String(g.id).trim() : `${mission.id}-game-${i + 1}`,
              kind,
              title: String(g.title || 'TRAINING SIMULATION'),
              target: target > 0 ? target : 1,
              unit: String(g.unit || GAME_KINDS[kind]),
            },
          });
          break;
        }
        case 'contact': {
          const contactId = String(value);
          if (!knownContacts[contactId]) report.error(`${at}: contact "${contactId}" isn't in the contacts list in game-config.js.`);
          else steps.push({ type, contactId });
          break;
        }
        case 'standby':
          // Clock-based gates were removed on purpose: progress only depends on what he does.
          report.warn(`${at}: time locks (standby) are no longer supported, so this step is skipped.`);
          break;
        default:
          break;
      }
    });
    steps.forEach((step, i) => (step.key = `${mission.id}:${i}`));
    return steps;
  }

  function normalizeMission(raw, i, report) {
    const where = `Mission ${i + 1}`;
    if (!isPlainObject(raw)) {
      report.error(`${where} isn't written as a { ... } block.`);
      return null;
    }
    const id = raw.id != null && String(raw.id).trim() ? String(raw.id).trim() : `mission-${i + 1}`;
    if (raw.id == null) report.warn(`${where} has no id, so "${id}" is used.`);
    const mission = {
      ...raw,
      id,
      title: String(raw.title == null ? `MISSION ${i + 1}` : raw.title),
      phase: raw.phase ? String(raw.phase) : '',
      objective: raw.objective ? String(raw.objective) : '',
    };
    mission.steps = normalizeSteps(raw.steps, mission, `${where} ("${mission.title}")`, report);
    if (!mission.steps.length) report.error(`${where} ("${mission.title}") has no steps.`);
    return mission;
  }

  function normalizeFile(raw, i, report) {
    const where = `Case file ${i + 1}`;
    if (!isPlainObject(raw) || raw.id == null) {
      report.error(`${where} needs to be a { ... } block with an id.`);
      return null;
    }
    const body = toList(raw.body).filter((block) => {
      if (typeof block === 'string') return true;
      if (isPlainObject(block) && BLOCK_TYPES.some((t) => t in block)) return true;
      report.warn(`${where} ("${raw.id}") has a block the app doesn't understand, so it's skipped.`);
      return false;
    });
    return {
      ...raw,
      id: String(raw.id),
      code: String(raw.code || `FILE ${OG.text.pad(i + 1, 3)}`),
      title: String(raw.title || 'UNTITLED'),
      classification: raw.classification ? String(raw.classification) : '',
      body,
    };
  }

  function countPlaceholders(...values) {
    return (JSON.stringify(values).match(OG.text.PLACEHOLDER) || []).length;
  }

  function load() {
    const problems = [];
    const report = {
      error: (message) => problems.push({ level: 'error', message }),
      warn: (message) => problems.push({ level: 'warning', message }),
    };

    for (const err of window.__OG_SCRIPT_ERRORS || []) {
      if (!err.file || CONTENT_FILES.includes(err.file)) {
        const where = err.file ? `content/${err.file}${err.line ? `, line ${err.line}` : ''}` : 'A content file';
        report.error(`${where}: ${err.message}`);
      }
    }

    const rawConfig = window.GAME_CONFIG;
    const rawMissions = window.MISSIONS;
    const rawFiles = window.CASE_FILES;
    const typo = 'There may be a typo in it (often a missing comma or quote mark).';
    if (!isPlainObject(rawConfig)) report.error(`content/game-config.js did not load. ${typo}`);
    if (!Array.isArray(rawMissions) || !rawMissions.length) report.error(`content/missions.js did not load, or it has no missions. ${typo}`);
    if (rawFiles != null && !Array.isArray(rawFiles)) report.error(`content/case-files.js should be a list [ ... ]. ${typo}`);
    if (rawFiles == null) report.error(`content/case-files.js did not load. ${typo}`);

    const config = merge(CONFIG_DEFAULTS, isPlainObject(rawConfig) ? rawConfig : {});
    knownContacts = isPlainObject(config.contacts) ? config.contacts : {};
    for (const [id, c] of Object.entries(knownContacts)) {
      if (!isPlainObject(c) || !c.phrase || !c.reply) report.error(`Contact "${id}" in game-config.js needs a name, a phrase and a reply.`);
    }
    const files = (Array.isArray(rawFiles) ? rawFiles : []).map((f, i) => normalizeFile(f, i, report)).filter(Boolean);
    const missions = (Array.isArray(rawMissions) ? rawMissions : []).map((m, i) => normalizeMission(m, i, report)).filter(Boolean);

    // Cross-checks: unique ids, and every referenced file/tool exists.
    const unique = (list, label) => {
      const seen = new Set();
      for (const id of list) {
        if (seen.has(id)) report.error(`Two ${label} share the id "${id}". Each id must be unique.`);
        seen.add(id);
      }
    };
    unique(missions.map((m) => m.id), 'missions');
    unique(files.map((f) => f.id), 'case files');
    const locks = missions.flatMap((m) => m.steps.filter((s) => s.type === 'lock').map((s) => s.lock));
    unique(locks.map((l) => l.id), 'locks');
    const games = missions.flatMap((m) => m.steps.filter((s) => s.type === 'game').map((s) => s.game));
    unique(games.map((g) => g.id), 'training games');

    const fileIds = new Set(files.map((f) => f.id));
    const toolIds = new Set(Object.keys(config.tools));
    missions.forEach((m, i) =>
      m.steps.forEach((step) => {
        if (step.type !== 'unlock') return;
        step.files.filter((id) => !fileIds.has(id)).forEach((id) => report.error(`Mission ${i + 1} unlocks case file "${id}", which isn't in content/case-files.js.`));
        step.tools.filter((t) => !toolIds.has(t)).forEach((t) => report.error(`Mission ${i + 1} unlocks tool "${t}", which isn't one of ${[...toolIds].join(', ')}.`));
      })
    );

    return {
      config,
      missions,
      files,
      locks,
      games,
      problems,
      fatal: problems.some((p) => p.level === 'error') || !missions.length,
      placeholderCount: countPlaceholders(rawConfig, rawMissions, rawFiles),
    };
  }

  OG.content = { load };
})();
