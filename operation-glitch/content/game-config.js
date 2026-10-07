/* =====================================================================
   FIELD OPERATIONS TERMINAL — GAME CONFIG
   ---------------------------------------------------------------------
   Names, the terminal's wording, the handler's general personality, the
   final field report, and Game Master settings.

   The missions are in content/missions.js.
   The case files (documents he unlocks) are in content/case-files.js.

   EDITING RULES (the only three that matter):
     1. Keep text inside quote marks:   'like this'
        If your text contains an apostrophe, use double quotes instead:
        "Don't panic"   — or put a backslash before it:  'Don\'t panic'
     2. Keep the comma at the end of each line/item.
     3. Save the file, then reload the page to see the change.

   NAME TOKENS — type these anywhere and they are filled in automatically:
     {husbandName}  {partnerName}  {age}  {birthdayDate}  {operationName}

   Anything in [SQUARE BRACKETS STARTING WITH CAPITALS] is highlighted in
   yellow in the app so you can spot placeholders you still need to replace.
   Text between ||double bars|| is shown as a black redaction bar.
   ===================================================================== */

window.GAME_CONFIG = {
  // ── PERSONAL DETAILS ──────────────────────────────────────────────────
  husbandName: 'Agent N',
  partnerName: 'Agent A',
  age: '23',
  birthdayDate: '10/07/2026',

  operationName: 'OPERATION CyberSecurity',
  terminalName: 'FIELD OPERATIONS TERMINAL',

  // ── FIRST LAUNCH ──────────────────────────────────────────────────────
  activation: {
    eyebrow: 'SECURE FIELD TERMINAL',
    footer: 'AUTHORIZED FIELD PERSONNEL ONLY',
    status: 'AWAITING ACTIVATION',
    button: 'ACTIVATE TERMINAL',
    sequence: [
      'CONNECTING TO SECURE NODE...',
      'VERIFYING AGENT BIOMETRICS...',
      '{husbandName}: IDENTITY CONFIRMED.',
      'CLEARANCE LEVEL 01 GRANTED.',
      'OPENING FIELD OPERATIONS TERMINAL...',
    ],
  },

  // ── CLEARANCE LEVELS ──────────────────────────────────────────────────
  // Missions raise his clearance with  { unlock: { clearance: 2 } }
  clearance: {
    start: 1,
    names: { 1: 'FIELD', 2: 'RESTRICTED', 3: 'TOP SECRET' },
  },

  // ── TOOLS ON THE HOME SCREEN ──────────────────────────────────────────
  // Missions unlock tools with  { unlock: { tools: ['files'] } }
  tools: {
    comms: { label: 'COMMS', sub: 'Secure channel to your handler', unlocked: true },
    terminal: { label: 'ACCESS TERMINAL', sub: 'Authenticate keys and codes', unlocked: true },
    // Appears automatically when his first training simulation is assigned.
    training: { label: 'TRAINING SIMULATOR', sub: 'Field training simulations', unlocked: false, hiddenUntilUnlocked: true },
    files: { label: 'CASE FILES', sub: 'Recovered intelligence', unlocked: false, lockedNote: 'CLEARANCE 02 REQUIRED' },
    diagnostics: { label: 'SYSTEM DIAGNOSTICS', sub: 'Internal system records', unlocked: false, hiddenUntilUnlocked: true },
    report: { label: 'FIELD REPORT', sub: 'Final debrief', unlocked: false, hiddenUntilUnlocked: true },
  },

  // ── HOME SCREEN "SYSTEM STATUS" PANEL (always visible) ────────────────
  // MISSION 1 PUZZLE: the first letters of these six lines spell M-I-R-R-O-R.
  hub: {
    statusTitle: 'SYSTEM STATUS',
    statusLines: [
      'Monitoring channel secure',
      'Integrity checks passed',
      'Relay stable',
      'Remote node authenticated',
      'Operations terminal online',
      'Response latency nominal',
    ],
  },

  // ── CONTACT NETWORK (real people he texts himself) ────────────────────
  // phrase:          what the app tells him to text (shown exactly)
  // reply:           what the contact texts back
  // acceptedReplies: what counts when he enters the reply (capitals and
  //                  punctuation are ignored). If left out, `reply` is used.
  contacts: {
    mom: {
      name: 'Mom',
      phrase: 'THE GUARDIANS HAVE ASSEMBLED',
      reply: '5814',
      acceptedReplies: ['5814'],
    },
    dad: {
      name: 'Dad',
      phrase: 'DO YOU CONCUR?',
      reply: 'PERRY REPORTS: THE OFFICE IS COMPROMISED.',
      acceptedReplies: ['THE OFFICE IS COMPROMISED', 'OFFICE IS COMPROMISED', 'PERRY REPORTS: THE OFFICE IS COMPROMISED.'],
    },
    agentA: {
      name: 'Agent A',
      phrase: 'BANKA DA BANKA QUANK',
      reply: 'PERRY HAS LEFT THE BUILDING.',
      acceptedReplies: ['PERRY HAS LEFT THE BUILDING'],
    },
  },

  // ── SYSTEM DIAGNOSTICS (hidden tool, unlocked after Mission 4) ────────
  // Optional easter egg: the first letters of these six lines spell O-F-F-I-C-E.
  // Nothing requires it; Dad's intelligence is what points him to the office.
  diagnostics: {
    title: 'SYSTEM DIAGNOSTICS',
    intro: '',
    lines: [
      'Operational cache verified',
      'Firewall handshake accepted',
      'Field relay stable',
      'Internal storage synchronized',
      'Clearance token active',
      'Encrypted channel nominal',
    ],
  },

  // ── THE HANDLER (his mission controller) ──────────────────────────────
  // Calm, competent, dry. Never cheesy. Use \n inside a message for a line break.
  handler: {
    name: 'Major Monogram',
    // Replies to his quick-response buttons in Comms.
    acknowledgements: [
      'Good.',
      'Noted.',
      'Acknowledged. Proceed.',
      'Understood is the correct answer, Agent. Well done.',
      'Excellent. Try to stay that way.',
    ],
    clarification: 'Current objective: {objective}',
    nothingToClarify: 'There is nothing to clarify, Agent. Stand by.',
    foundSomething: 'Then authenticate it. The Access Terminal is ready for you.',
    foundNothing: 'Noted. Hold onto it. It may matter later.',
    hintQuips: [
      'Assistance request logged. I had hoped this would not be necessary.',
      'You have requested a second hint. This has been added to your permanent record.',
      'Final hint. After this I am simply doing it for you.',
    ],
    noHintsLeft: 'No further intelligence available, Agent. You have everything you need.',
    noHintTarget: 'There is nothing to assist with right now. Enjoy the quiet.',
    // Said inside the Access Terminal after a wrong key (rotates in order).
    wrongAnswer: [
      'That answer was incorrect. Fortunately, your clearance has not yet been revoked.',
      'Incorrect. Take a breath. Then take another look.',
      'No. But I admire the confidence.',
      'You are taking longer than projected. I am choosing to interpret that as caution rather than confusion.',
      'Agent, please search the actual location before declaring the clue impossible.',
      'Still no. The lock and I are in agreement on this.',
    ],
    suggestHintAfterWrong: 4,
    suggestHint: 'If you need assistance, request it in Comms. I will only judge you slightly.',
    overrideMessage: 'Override accepted. I will note that this lock was opened by command authority.',
    trainingHint: 'This is a training simulation, Agent. The only assistance available is practice.',
  },

  // ── QUICK-RESPONSE BUTTONS IN COMMS ───────────────────────────────────
  replies: {
    understood: 'UNDERSTOOD',
    clarify: 'NEED CLARIFICATION',
    found: 'I FOUND SOMETHING',
    hint: 'REQUEST HINT',
  },

  // ── SYSTEM NOTICES (technical, not the handler) ───────────────────────
  system: {
    lockActive: 'NEW LOCK ACTIVE',
    keyAccepted: 'ACCESS KEY ACCEPTED',
    commandOverride: 'COMMAND OVERRIDE',
    fileUnlocked: 'CASE FILE UNLOCKED',
    toolOnline: 'NEW TOOL ONLINE',
    clearanceUpdated: 'CLEARANCE LEVEL UPDATED',
    evidenceLogged: 'ARCHIVE FRAGMENT LOGGED',
    missionComplete: 'MISSION {n} COMPLETE',
    operationComplete: 'OPERATION COMPLETE',
    jumped: 'COMMAND OVERRIDE: MISSION {n} ACTIVE',
    trainingAssigned: 'TRAINING SIMULATION ASSIGNED',
    trainingComplete: 'TRAINING COMPLETE',
    contactAssigned: 'EXTERNAL CONTACT REQUIRED',
  },

  // ── TRAINING SIMULATOR WORDING ────────────────────────────────────────
  // (Each simulation's title and target are set in missions.js.)
  training: {
    kicker: 'TRAINING SIMULATION',
    launch: 'LAUNCH SIMULATION',
    start: 'START SIMULATION',
    restart: 'RESTART',
    complete: 'SIMULATION COMPLETE',
  },

  // ── ACCESS TERMINAL WORDING ───────────────────────────────────────────
  terminal: {
    connecting: ['CONNECTING TO SECURE NODE...', 'VERIFYING CREDENTIALS...', 'HANDSHAKE COMPLETE.'],
    authenticating: 'AUTHENTICATING KEY...',
    denied: ['ACCESS DENIED', 'INVALID KEY', 'KEY REJECTED', 'AUTHENTICATION FAILED'],
    granted: 'ACCESS GRANTED',
    decrypting: 'DECRYPTING...',
    emptyKey: 'NO KEY ENTERED',
    submit: 'AUTHENTICATE',
    idle: 'NO ACTIVE LOCKS',
    idleSub: 'Awaiting assignment from your handler.',
    afterSuccess: 'NEW TRANSMISSION FROM HANDLER',
    attempts: 'ATTEMPTS REMAINING: ∞',
    trace: 'TRACE RISK',
    askForHint: 'ASK HANDLER FOR A HINT',
  },

  // ── FINAL FIELD REPORT (shown when the operation is complete) ─────────
  report: {
    title: 'FINAL FIELD REPORT',
    // Shown after the automatic stats (missions, hints, wrong keys, time).
    extraRows: [
      { label: 'PROPERTY DAMAGE', value: '0' },
      { label: 'JEDI COUNCIL ASSESSMENT', value: 'MASTER RANK NOT YET GRANTED' },
      { label: 'S.H.I.E.L.D. THREAT RESPONSE', value: 'ACCEPTABLE' },
      { label: 'O.W.C.A. FIELD COMPLIANCE', value: 'SURPRISINGLY HIGH' },
      { label: 'SHED KEYS CURRENTLY ACCOUNTED FOR', value: 'UNCONFIRMED' },
      { label: 'PERFECTIONISM CONTAINMENT', value: 'FAILED' },
    ],
    ratingLabel: 'FINAL FIELD RATING',
    // One band = the same rating whatever his stats are.
    ratings: [{ upTo: 9999, label: 'ANNOYINGLY COMPETENT' }],
    signoff: [
      'Agent N, Operation CyberSecurity is complete.',
      'Seven protocols cleared. All classified assets recovered. No catastrophic failures recorded.',
      'Your field performance was competent enough that I am prepared to omit several details from the official report.',
      'Renovation clearance has been granted to Agents N and A.',
      'Proceed with installation. Try not to create a second operation requiring structural recovery.',
      'Major Monogram signing off. Happy birthday, Agent N.',
    ],
    personalNoteLabel: 'PERSONAL NOTE',
    personalNote: 'Happy Birthday my love — Agent A',
  },

  // ── ANSWER CHECKING ───────────────────────────────────────────────────
  // Capitals, extra spaces and punctuation are always ignored.
  answers: {
    ignoreLeadingArticles: true, // "the vanity" = "vanity"
    allowSmallTypos: true, // one wrong/missing/swapped letter is OK for words of 5+ letters (never for codes)
  },

  // ── GAME MASTER (YOU) ─────────────────────────────────────────────────
  gameMaster: {
    // If he types this into any text lock, that lock opens. Set to '' to disable.
    overrideCode: 'command override',
    // Hold the terminal name (top of the screen) this long to open the control panel.
    longPressSeconds: 2,
  },

  sound: { startOn: false }, // he can turn sound on with the speaker button
  haptics: true, // tiny vibrations on Android phones (iPads/iPhones ignore this)
  highlightPlaceholders: true, // yellow highlight on [PLACEHOLDER] text

  // Where progress is saved in the browser. Change it to start everyone fresh.
  storageKey: 'operation-cybersecurity-2026',
};
