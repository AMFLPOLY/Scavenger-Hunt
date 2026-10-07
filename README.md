# OPERATION CyberSecurity — your guide

Agent N's birthday operation (10/07/2026), directed by **Major Monogram**. He plays on the **iPad in Safari**. Everything the game needs is in the **`operation-glitch`** folder.

There are **no time locks**: each mission starts as soon as the previous one is solved.

---

## 1. Hide these before he starts

| Mission | Hide this | Where |
|---|---|---|
| 1 | **Electric razor** | **Jungle bathroom vanity** |
| 2 | **Neck massager** | **Garden room bed** |
| 3 | **Toilet paper holder** | **Space room drawer** |
| 4 | **Wood holder + lamp** | **Office closet** |
| 5 | **Toilet shelves** | **Master closet** |
| 7 | You (Agent A) | **Master bathroom**, at the end |

No paper clue cards are needed anymore.

---

## 2. Brief your contacts (important)

He will text three people a phrase. Each one must reply with the right answer:

| Contact | He texts | They reply |
|---|---|---|
| **Mom** (Mission 2) | THE GUARDIANS HAVE ASSEMBLED | **5814** |
| **Dad** (Mission 4) | DO YOU CONCUR? | **PERRY REPORTS: THE OFFICE IS COMPROMISED.** |
| **You, Agent A** (Mission 6) | BANKA DA BANKA QUANK | **PERRY HAS LEFT THE BUILDING.** |

If someone can't reply in time, the third hint for that step gives him the answer. You can also tap **Authorize** in the Game Master panel.

---

## 3. Answer key (keep this away from him)

| Mission | What he does | Answer |
|---|---|---|
| 1 First Breach | First letters of the home screen's System Status spell **MIRROR**. He takes the iPad to the bathroom mirror to read a reversed message: 22–1–14–9–20–25, A=1 | **MIRROR**, then **VANITY** |
| 2 Systems Reconstruction | Falling-blocks game to **2000 points** → texts Mom → enters her code | **5814** |
| 3 Archive Chronology | Order: cake → Guardians Marathon → first child → underwater caves → Sun City. Then repeat the symbols **★ ● ▲ ◆ ■** → reveals **SPACE** | tap **ASSET RECOVERED** |
| 4 Signal Routing | Snake game, **20 data nodes** in one run → texts Dad → enters his finding | **THE OFFICE IS COMPROMISED** |
| 5 Quarter Portion | ¼ of 12, 28, 8, 36 | **3729** |
| 6 Vertical Extraction | Climber game to **Level 23** → texts you → enters your reply | **PERRY HAS LEFT THE BUILDING** |
| 7 Final Authorization | Order ◆ ▲ ■ ● with ◆=9 ▲=4 ■=2 ●=7 | **9427** |

Evidence Locker fragments: ▲ = 4 (Mission 1), ● = 7 (Mission 3), ■ = 2 (Mission 5), ◆ = 9 (Mission 6).

Every lock has 3 hints, from subtle to direct. He asks for them with **REQUEST HINT** in Comms.

---

## 4. Game Master controls (for you)

**To open:** on any screen, **press and hold the words at the top of the screen for 2 seconds**, or add `#control` to the end of the web address.

- **Controls:** previous mission, **Complete mission**, **Skip current step**, **Send next hint**, **Unlock final mission**
- **Training simulations:** status, best run, **Set target** (makes a game easier or harder), **Mark training complete**, **Reset game**
- **Contact authorizations:** see who has replied, and **Authorize Mom / Dad / Agent A** if needed
- **Jump to** any mission (fragments and unlocks are rebuilt automatically)
- **Show answers**, **Send a message** as Major Monogram, **Reset entire game**

**From your own phone:** open the same link, hold the top title, type a message, and tap **Make a link to text him**. You can also tap **Link: skip his current step**. Each link works once.

**Override code:** typing `command override` into any typed-answer lock opens it.

---

## 5. Changing things later

- **Contacts:** phrases and replies are in `content/game-config.js` under `contacts`.
- **Game targets:** in `content/missions.js`, look for `target: 2000`, `target: 20` and `target: 23`.
- **Messages and hints:** in `content/missions.js`.

---

## 6. Put it online (free, about 5 minutes)

1. Go to **app.netlify.com/drop** and create a free account.
2. Drag the whole **`operation-glitch`** folder onto the page.
3. Netlify gives you a link. That's the game.

**After editing later:** in Netlify, open your site → **Deploys** → drag the folder in again. The link stays the same.

---

## 7. Before he starts

- [ ] Open the link on **his iPad in Safari** (not a private tab, and not "Add to Home Screen")
- [ ] Try a few steps, then hold the title → **Reset entire game**
- [ ] Hide the items above and brief Mom and Dad
- [ ] Leave the iPad on the activation screen for him
