/* =====================================================================
   FIELD OPERATIONS TERMINAL — CASE FILES  (OPERATION CyberSecurity)
   ---------------------------------------------------------------------
   Documents he unlocks during the operation. A file stays sealed until a
   mission step unlocks it:  { file: 'candy-inventory' }
   (His Evidence Locker of archive fragments is built automatically.)

   FIELDS
     id              unique name used by missions
     code            label like 'FILE 001'
     title           file name
     classification  stamp text, e.g. 'TOP SECRET'
     body            a list of blocks, shown in order:
       'Plain text paragraph. ||Redacted words|| show as black bars.'
       { heading: 'SECTION TITLE' }
       { note: 'An analyst note in the margin.' }
       { list: ['one', 'two'] }
       { log: ['03:12 UPLINK OPENED', '03:14 UPLINK CLOSED'] }   system-log lines
       { code: 'LINE ONE\nLINE TWO' }                              monospace block
       { cipher: 'PLAIN MESSAGE', shift: 7 }                       shows it scrambled
       { image: 'content/images/photo.jpg', caption: 'Text' }      tap to enlarge
   ===================================================================== */

window.CASE_FILES = [
  // Mission 5: one quarter of each lot = 3, 7, 2, 9.
  {
    id: 'candy-inventory',
    code: 'FILE 001',
    title: 'CONFISCATED CANDY INVENTORY',
    classification: 'EVIDENCE',
    body: [
      { code: 'LOT A: 12 UNITS\nLOT B: 28 UNITS\nLOT C: 8 UNITS\nLOT D: 36 UNITS' },
      'Associated phrase recovered from subject archive: QUARTER PORTION.',
    ],
  },
];
