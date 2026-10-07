/* =====================================================================
   FIELD OPERATIONS TERMINAL — MISSIONS  (OPERATION CyberSecurity)
   ---------------------------------------------------------------------
   Each mission is a SCRIPT: a list of steps that play in order.
   Messages arrive in Comms one at a time (with a short "typing" pause).
   Progress depends only on what he does. There are no time locks.
   The script pauses at three kinds of step until he acts:
     lock   a challenge in the Access Terminal (pauses until solved)
     ask    a question with reply buttons in Comms (pauses until he taps one)
     game   a training simulation (pauses until he reaches its target)

   STEP TYPES — one per line, in any order:
     { handler: 'Text' }                  Major Monogram speaks
     { system: 'TEXT' }                   a technical system notice
     { task: 'Text' }                     a FIELD TASK card (a physical search);
                                          also becomes his "current objective"
     { ask: 'Question?', replies: ['READY'] }
                                          optional:  responses: { 'READY': 'Good.' }
                                          optional:  hints: ['...', '...', '...']
     { lock: { ... } }                    an Access Terminal challenge (see below)
     { game: { id, type, title, target } }  a training simulation:
                                          type 'blocks' (falling blocks, target = points)
                                          type 'snake'  (target = data nodes in one run)
                                          type 'climber' (target = level)
     { contact: 'mom' }                   show "text this exact phrase" for a contact
                                          (contacts live in game-config.js)
     { file: 'file-id' }                  unlock a case file (content/case-files.js)
     { unlock: { files: ['id'], tools: ['files', 'diagnostics'], clearance: 2 } }
     { evidence: '▲ = 4' }                add an item to his Evidence Locker

   LOCK FIELDS
     id           short unique name (keeps hint/attempt counts)
     type         'text' | 'phrase' | 'keypad' | 'sequence' | 'order' | 'cipher'
     contact      e.g. 'mom': the accepted answers come from that contact's reply
     node         label at the top, e.g. 'SECURE NODE 01'
     prompt       the instruction above the input
     instructions optional extra line under the prompt
     mirror       text shown back-to-front (read it in a mirror)
     answers      every answer that counts (text, phrase, keypad, cipher)
     answer       for 'sequence': the correct symbol order
     preview      for 'sequence': true = a PLAY SEQUENCE memory preview
     items        for 'order': list them in the CORRECT order (the app shuffles them)
     hints        3 hints, subtle → stronger → direct (requested from Comms)
     clarify      what the handler says if he taps NEED CLARIFICATION

   Text tokens: {husbandName} = Agent N, {partnerName} = Agent A
   ===================================================================== */

window.MISSIONS = [
  // ───────────────────────── MISSION 1 — FIRST BREACH ─────────────────────────
  // System Status spells MIRROR → mirrored transmission read at the bathroom mirror:
  // 22–1–14–9–20–25 (A=1) = VANITY → electric razor in the JUNGLE BATHROOM VANITY.
  {
    id: 'first-breach',
    title: 'FIRST BREACH',
    objective: 'Find the word hidden in your terminal.',
    steps: [
      { handler: '{husbandName}. Operation CyberSecurity is active. I am Major Monogram, and I will be directing this operation.' },
      { handler: 'Our systems were breached overnight. The intruder hid directions to the first asset inside your terminal.' },
      { handler: 'The first clue has been on your screen since you switched it on. Inspect what you have already been shown.' },
      {
        lock: {
          id: 'first-breach-word',
          type: 'text',
          node: 'SECURE NODE 01 // FIRST BREACH',
          prompt: 'ENTER THE HIDDEN WORD',
          answers: ['MIRROR'],
          clarify: 'A word is hidden in information already visible on your terminal home screen. Find it and enter it in the Access Terminal.',
          hints: [
            'The System Status panel on your home screen has been talking to you all along.',
            'Take the first letter of each System Status line, top to bottom.',
            'The first letters spell MIRROR.',
          ],
        },
      },
      { handler: 'Correct. The intruder sent the next key in reverse.' },
      { handler: 'Take your terminal to the bathroom mirror and read the transmission in the reflection.' },
      { task: 'Open the Access Terminal at the bathroom mirror. Read the reversed transmission in the reflection, then decode it.' },
      {
        lock: {
          id: 'first-breach-key',
          type: 'text',
          node: 'SECURE NODE 01 // REVERSED TRANSMISSION',
          prompt: 'AUTHENTICATION KEY REQUIRED. Submit the word recovered from the first breach.',
          mirror: '22 – 1 – 14 – 9 – 20 – 25\nA = 1',
          answers: ['VANITY', 'THE VANITY'],
          clarify: 'Read the reversed transmission in the bathroom mirror, decode it, and enter the word.',
          hints: [
            'Hold the screen up to the bathroom mirror. The reflection reads normally.',
            'Each number is a letter of the alphabet: A=1, B=2, C=3, and so on.',
            '22–1–14–9–20–25 decodes to VANITY.',
          ],
        },
      },
      { handler: 'Code accepted. Better. Search the jungle bathroom vanity. Asset recovery is authorized.' },
      { unlock: { tools: ['files'], clearance: 2 } },
      { evidence: '▲ = 4' },
      { task: 'Search the jungle bathroom vanity and recover the asset.' },
      {
        ask: 'Confirm once the asset from the jungle bathroom vanity is in your possession.',
        replies: ['ASSET RECOVERED'],
        responses: { 'ASSET RECOVERED': 'Asset recovered. Proceed.' },
      },
    ],
  },

  // ───────────────────────── MISSION 2 — SYSTEMS RECONSTRUCTION ─────────────────────────
  // Falling-block simulation (2000 points) → text Mom THE GUARDIANS HAVE ASSEMBLED → she
  // replies 5814 → GARDEN ROOM BED (neck massager). No fragment in this mission.
  {
    id: 'systems-reconstruction',
    title: 'SYSTEMS RECONSTRUCTION',
    objective: 'Complete the Systems Reconstruction simulation.',
    steps: [
      { handler: 'Reconstruct the corrupted data blocks.' },
      { handler: 'Minimum acceptable performance has been set deliberately low. Do not make me reconsider that decision.' },
      // Change `target` to make it easier or harder (the Game Master panel can also adjust it).
      { game: { id: 'systems-reconstruction', type: 'blocks', title: 'SYSTEMS RECONSTRUCTION', target: 2000 } },
      { handler: 'Reconstruction complete. Somehow.' },
      { handler: 'The reconstructed data contains a passphrase for an external contact. Her authorization is required to continue.' },
      { contact: 'mom' },
      {
        lock: {
          id: 'mom-authorization',
          type: 'keypad',
          contact: 'mom',
          node: 'EXTERNAL AUTHORIZATION // CONTACT: MOM',
          prompt: "ENTER MOM'S AUTHORIZATION CODE",
          clarify: 'Text Mom the exact phrase THE GUARDIANS HAVE ASSEMBLED, then enter the code she sends back.',
          hints: [
            'Text Mom the exact phrase shown above, then wait for her reply.',
            'Her reply is a four-digit code. Enter it on the keypad.',
            "Mom's authorization code is 5814.",
          ],
        },
      },
      { handler: 'External authorization accepted.' },
      { system: 'ASSET LOCATION: GARDEN ROOM BED' },
      { handler: 'Proceed to the garden room.' },
      { task: 'Recover the asset from the garden room bed.' },
      {
        ask: 'Confirm once the asset from the garden room bed is in your possession.',
        replies: ['ASSET RECOVERED'],
        responses: { 'ASSET RECOVERED': 'Noted. Proceed.' },
      },
    ],
  },

  // ───────────────────────── MISSION 3 — ARCHIVE CHRONOLOGY ─────────────────────────
  // Order the five memories → repeat their symbols ★ ● ▲ ◆ ■ → SPACE → toilet paper
  // holder in the SPACE ROOM DRAWER → fragment ● = 7.
  {
    id: 'archive-chronology',
    title: 'ARCHIVE CHRONOLOGY',
    objective: 'Restore the archive records to the correct order.',
    steps: [
      { handler: 'The archive holds five records from your joint history with {partnerName}. They have been filed out of order.' },
      { handler: 'Restore the chronology. Earliest first.' },
      {
        lock: {
          id: 'archive-order',
          type: 'order',
          node: 'ARCHIVE INDEX // JOINT HISTORY',
          prompt: 'ARRANGE THE RECORDS FROM EARLIEST TO LATEST',
          // Correct order (years are not shown to him): 2022, 2023, 2024, 2025, January 2026.
          items: ['Made our first cake together', 'Guardians Marathon', 'Had our first child', 'Underwater caves', 'Sun City'],
          clarify: 'Tap the five archive records in the order they happened, earliest first.',
          hints: [
            'Begin with the first thing the two of you ever made together in a kitchen.',
            'Your first child sits exactly in the middle of the timeline. Sun City is the most recent.',
            'Cake, Guardians Marathon, first child, underwater caves, Sun City.',
          ],
        },
      },
      { handler: 'Timeline restored. No temporal paradox detected.' },
      { system: 'ARCHIVE RECORDS DECRYPTED. EACH RECORD CARRIES A SYMBOL.' },
      { handler: 'The archive will replay the record symbols in chronological order. Repeat the sequence exactly.' },
      {
        lock: {
          id: 'archive-symbols',
          type: 'sequence',
          preview: true,
          node: 'ARCHIVE INDEX // SYMBOL VERIFICATION',
          prompt: 'REPEAT THE ARCHIVE SEQUENCE',
          instructions: 'Tap PLAY SEQUENCE, memorize the symbols, then enter them in order.',
          // The order the buttons appear in (deliberately not the answer order).
          symbols: ['▲', '■', '★', '◆', '●'],
          // 2022 ★, 2023 ●, 2024 ▲, 2025 ◆, 2026 ■
          answer: ['★', '●', '▲', '◆', '■'],
          previewLabels: ['2022', '2023', '2024', '2025', '2026'],
          clarify: 'Play the archive sequence in the Access Terminal and repeat the five symbols in the same order.',
          hints: [
            'You can play the sequence as many times as you like.',
            'One symbol per record, earliest record first. The first symbol is ★.',
            '★ ● ▲ ◆ ■',
          ],
        },
      },
      { handler: 'Archive sequence verified.' },
      { system: 'DESTINATION DECRYPTED: SPACE' },
      { handler: 'Search accordingly.' },
      { task: 'The archive points to SPACE. Search it and recover the asset.' },
      {
        ask: 'Confirm once you have recovered the asset from SPACE.',
        replies: ['ASSET RECOVERED'],
        responses: { 'ASSET RECOVERED': 'Asset recovered. Logging archive fragment.' },
        hints: [
          'SPACE is the name of a room in this house.',
          'Search the space room. Look in things that slide open.',
          'The drawer in the space room.',
        ],
      },
      { evidence: '● = 7' },
    ],
  },

  // ───────────────────────── MISSION 4 — SIGNAL ROUTING ─────────────────────────
  // Snake simulation (20 data nodes) → text Dad DO YOU CONCUR? → he replies
  // PERRY REPORTS: THE OFFICE IS COMPROMISED. → search the office (OFFICE CLOSET:
  // wood holder + lamp). No fragment in this mission.
  {
    id: 'signal-routing',
    title: 'SIGNAL ROUTING',
    objective: 'Complete the Signal Routing simulation.',
    steps: [
      { handler: 'Route the secure packet through the network.' },
      { handler: 'Avoid collision with your own trail.' },
      { handler: 'There is probably a metaphor in there. Ignore it.' },
      // Change `target` to make it easier or harder (the Game Master panel can also adjust it).
      { game: { id: 'signal-routing', type: 'snake', title: 'SIGNAL ROUTING', target: 20 } },
      { handler: 'Signal route stabilized.' },
      { handler: 'That was almost efficient.' },
      { contact: 'dad' },
      {
        lock: {
          id: 'dad-authorization',
          type: 'phrase',
          contact: 'dad',
          node: 'EXTERNAL AUTHORIZATION // CONTACT: DAD',
          prompt: "AUTHENTICATE DAD'S INTELLIGENCE",
          instructions: "Enter the key finding from Dad's report.",
          clarify: "Text Dad the exact phrase DO YOU CONCUR?, then enter the key finding from his report.",
          hints: [
            'Text Dad the exact phrase shown above and wait for his report.',
            "Perry's report says something has been compromised. Enter what it says.",
            'Enter: THE OFFICE IS COMPROMISED',
          ],
        },
      },
      { handler: 'Patternal intelligence authenticated.' },
      { handler: 'Apparently Perry has eyes on the office.' },
      { handler: 'The report identifies the room. Locating the actual asset remains your responsibility.' },
      { task: 'Search the office and recover the asset.' },
      {
        ask: 'Confirm once the asset from the office is in your possession.',
        replies: ['ASSET RECOVERED'],
        responses: { 'ASSET RECOVERED': 'Asset recovered. Perry will be pleased. He will not show it.' },
        hints: [
          'Perry identified the room, not the hiding place.',
          'Look for somewhere in the office with a door that closes.',
          'The office closet.',
        ],
      },
      // Optional easter egg: System Diagnostics (its first letters spell OFFICE).
      { unlock: { clearance: 3, tools: ['diagnostics'] } },
    ],
  },

  // ───────────────────────── MISSION 5 — QUARTER PORTION ─────────────────────────
  // Candy lots 12, 28, 8, 36 → one quarter of each = 3, 7, 2, 9 → 3729
  // → toilet shelves in the MASTER CLOSET → fragment ■ = 2.
  {
    id: 'quarter-portion',
    title: 'QUARTER PORTION',
    objective: 'Extract the access code from the confiscated candy inventory.',
    steps: [
      { handler: 'A shipment of candy has been confiscated. The inventory is now in your Case Files.' },
      { file: 'candy-inventory' },
      { handler: 'The inventory conceals a four-digit access code. Treat every detail in that file as evidence.' },
      {
        lock: {
          id: 'quarter-code',
          type: 'keypad',
          length: 4,
          node: 'EVIDENCE VAULT // CONFISCATED GOODS',
          prompt: 'ENTER 4-DIGIT ACCESS CODE',
          answers: ['3729'],
          clarify: 'Open the Confiscated Candy Inventory in Case Files and use it to work out the four-digit code.',
          hints: [
            'The associated phrase in the inventory is an instruction, not decoration.',
            'A quarter portion of each lot. Divide every quantity by four, in order.',
            '12, 28, 8, 36 divided by four is 3, 7, 2, 9. Enter 3729.',
          ],
        },
      },
      { handler: 'Accepted. Apparently quarter portions have legitimate tactical applications. I will update the manual.' },
      { evidence: '■ = 2' },
      { task: 'Search the master closet and recover the asset.' },
      {
        ask: 'Confirm once the asset from the master closet is in your possession.',
        replies: ['ASSET RECOVERED'],
        responses: { 'ASSET RECOVERED': 'Asset recovered. Proceed.' },
      },
    ],
  },

  // ───────────────────────── MISSION 6 — VERTICAL EXTRACTION ─────────────────────────
  // Climber simulation (Level 23) → text Agent A BANKA DA BANKA QUANK → she replies
  // PERRY HAS LEFT THE BUILDING. → fragment ◆ = 9 → Mission 7 starts immediately.
  {
    id: 'vertical-extraction',
    title: 'VERTICAL EXTRACTION',
    objective: 'Complete the Vertical Extraction simulation.',
    steps: [
      { handler: 'Vertical extraction simulation loaded.' },
      { handler: 'Reach Level 23.' },
      { handler: 'Age correlation noted. Subtlety was not a priority.' },
      // Change `target` to make it easier or harder (the Game Master panel can also adjust it).
      { game: { id: 'vertical-extraction', type: 'climber', title: 'VERTICAL EXTRACTION SIMULATION', target: 23 } },
      { handler: 'Extraction threshold reached.' },
      { handler: 'Your survival remains statistically convenient.' },
      { contact: 'agentA' },
      {
        lock: {
          id: 'agent-a-authorization',
          type: 'phrase',
          contact: 'agentA',
          node: 'EXTERNAL AUTHORIZATION // CONTACT: AGENT A',
          prompt: "ENTER AGENT A'S REPLY",
          clarify: 'Text Agent A the exact phrase BANKA DA BANKA QUANK, then enter her reply.',
          hints: [
            'Text Agent A the exact phrase shown above and wait for her reply.',
            'Her reply is the passphrase. Enter it word for word.',
            'Enter: PERRY HAS LEFT THE BUILDING',
          ],
        },
      },
      { evidence: '◆ = 9' },
      { handler: 'External authorization confirmed.' },
      { handler: 'Final protocol unlocked.' },
      { handler: 'Proceed when ready.' },
    ],
  },

  // ───────────────────────── MISSION 7 — FINAL AUTHORIZATION ─────────────────────────
  // Starts as soon as Mission 6 is done. Required order ◆ ▲ ■ ● with
  // ◆=9 ▲=4 ■=2 ●=7 → 9427 → MASTER BATHROOM, where Agent A is waiting.
  {
    id: 'final-authorization',
    title: 'FINAL AUTHORIZATION',
    objective: 'Enter the final authorization code.',
    steps: [
      { handler: '{husbandName}. Final authorization protocol is active.' },
      { handler: 'Four archive fragments were secured during this operation. Their values are already stored in your Evidence Locker.' },
      { handler: 'The authorization server will now provide their required order.' },
      { system: 'REQUIRED ORDER: ◆ ▲ ■ ●' },
      { handler: 'Do not confuse the order in which you found them with the order in which they are requested.' },
      {
        lock: {
          id: 'final-code',
          type: 'keypad',
          length: 4,
          node: 'AUTHORIZATION SERVER // FINAL',
          prompt: 'ENTER FINAL AUTHORIZATION CODE',
          instructions: 'REQUIRED ORDER: ◆ ▲ ■ ●',
          answers: ['9427'],
          clarify: 'Replace each symbol in the required order ◆ ▲ ■ ● with its value from your Evidence Locker, then enter the code.',
          hints: [
            'Open Case Files. Your Evidence Locker lists the value of each symbol.',
            'Write the symbols in the required order, ◆ ▲ ■ ●, and swap each one for its value.',
            '◆ = 9, ▲ = 4, ■ = 2, ● = 7. Enter 9427.',
          ],
        },
      },
      { handler: 'Final authorization accepted. All assets accounted for. Proceed to the master bathroom. {partnerName} is already on site.' },
      { task: 'Proceed to the MASTER BATHROOM. Build and install the recovered bathroom improvements with {partnerName}.' },
    ],
  },
];
