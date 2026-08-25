# Project Reference

Detailed reference material for the RPG prototype. For architectural guidance and development instructions, see [CLAUDE.md](../CLAUDE.md).

## Character Data Structure

All characters (PC and NPCs) share this structure:
```javascript
{
    // Position
    hexQ, hexR,                    // Axial hex coordinates
    pixelX, pixelY,                // Rendered pixel position
    targetPixelX, targetPixelY,    // Movement interpolation targets

    // Animation
    facing,                        // One of the SIX hex facings only (dir1, dir2, dir3, dir5, dir6, dir7).
                                   // Sprites ship dir4/dir8 too, but those are the pure N/S pair a hex grid
                                   // has no neighbour for — assigning one strands rotateFacing() and
                                   // silently disables positional flanking against that character.
    currentAnimation,              // Animation state (idle, walk, run, attack, jump, die, impact, idle2)
    animationFrame,                // Current frame index
    animationTimer,                // Timer for frame progression

    // Identity
    name,                          // Display name
    faction,                       // Faction key: 'pc', 'pc_ally', 'bandit', 'guard'
    spriteSet,                     // Derived from equipment unless overridden — see Sprite System

    // Stats (12 stats, 69 total points, min 3 / max 10 per stat)
    stats: {
        str, int,                  // Power (Physical/Cerebral)
        dex, per,                  // Prowess (Physical/Cerebral)
        con, will,                 // Resistance (Physical/Cerebral)
        beauty, cha,               // Appearance (Physical/Cerebral)
        instinct, wis,             // Spirit (Physical/Cerebral)
        source, luck               // Destiny (Physical/Cerebral)
    },

    // Equipment
    equipment: {
        mainHand,                  // Weapon key ('unarmed', 'shortSword', 'longSword', etc.)
        offHand,                   // Shield or null ('smallShield', 'largeShield')
        armor                      // Armor key ('none', 'leather', 'scale', 'brigandine', 'chain', 'plate')
    },

    // Skills (all range 1-10)
    skills: {
        block, dodge,              // Defense skills
        unarmed, shortSword, longSword, shortSpear, longSpear, shortHammer, longHammer,  // Weapon skills
        criticalStrike, criticalDefense  // Critical skills
    },

    // Health
    health, maxHealth,             // Current and max HP
    hpBufferMax,                   // Temp HP per attacker (Instinct * WillMultiplier)
    hpBufferByAttacker,            // Map<attacker, remaining buffer>

    // Combat State
    isDefeated,                    // Boolean - character defeated (body stays on hex as obstacle)
    mode,                          // 'aggressive' or 'neutral' (AI behavior)
    enemies,                       // Set<character> - direct grudges (see Hostility)
    lastAttackedBy,                // Reference to last attacker
    conditions,                    // Set<CONDITIONS.*> - active conditions (currently only knockdown).
                                   // Cleared wholesale on combat exit.

    // Engagement (multi-opponent tracking)
    engagedBy,                     // Set<character> - who is engaging this character
    engagedMax,                    // Max simultaneous engagements (Cerebral Presence / 6)

    // Movement
    movementQueue,                 // Array of hex targets
    isMoving,                      // Boolean - currently moving
    moveSpeed,                     // ms per hex (default 300)
    currentMoveTimer               // Current interpolation progress
}
```

## Character Build Storage

A **build** is the editable part of a character: `{ name, stats, skills, equipment }`.
Game identity (faction, spriteSet, mode, facing, position) is NOT part of a build — that
stays in `NPC_TEMPLATES` and `area.json`, so a saved build can never change who a
character is.

Builds live as JSON files in `characters/`, one per character, named by slug
(`'Bandit Brute'` → `bandit_brute.json`).

**Build priority:** `CharacterFactory defaults < NPC_TEMPLATES/area.json < characters/*.json`

### Endpoints (nginx WebDAV, see `nginx-dev.conf`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/characters/` | JSON directory listing (the build index) |
| GET | `/characters/{slug}.json` | Read one build |
| PUT | `/characters/{slug}.json` | Create or overwrite |
| DELETE | `/characters/{slug}.json` | Remove |

> **DEV ONLY.** No auth, no validation, no concurrency control. Fine bound to
> localhost in the dev container; never a shipping configuration.

### CharacterStore

`js/CharacterStore.js` wraps those four calls. Loading is async but
`CharacterFactory.createCharacter()` is synchronous, so builds are fetched once into
an in-memory cache at startup and read back synchronously:

```javascript
await CharacterStore.loadAll();   // Game.init(), before any character is created
CharacterStore.get('Hero');       // sync cache read, used at spawn
await CharacterStore.save(build); // PUT
await CharacterStore.remove(name);// DELETE
```

**Migration to a real API:** change `BASE_PATH` and the four `fetch()` calls in
`CharacterStore.js` from `/characters/{slug}.json` to `/api/characters/{id}`. No caller
changes.

## Factions & Hostility

Factions define visual styling and team identity. Defined in `const.js`:

| Faction Key | Name | Tint Color | Nameplate Color |
|-------------|------|------------|-----------------|
| `pc` | PC | #4CAF50 (green) | #00ff00 |
| `pc_ally` | Companion | #4169E1 (blue) | #6495ED |
| `bandit` | Bandit | #B22222 (red) | #cc3333 |
| `guard` | Guard | #FF9800 (orange) | #ffaa44 |

Note: the Companion's actual `faction` is `pc` — `pc_ally` exists only as a render
tint for non-PC members of the pc faction.

**A different faction is NOT hostility.** Hostility is a *grudge* — per-character
`enemies` Sets, shared across a faction:

- **Direct grudge:** attacking any character makes the pair mutual enemies
  (`makeEnemies`, fired even on a miss).
- **Faction-shared:** a character treats X as an enemy if any faction-mate holds a
  grudge against X (`AISystem.getEffectiveEnemies`; the pairwise test is
  `utils.areHostile(a, b, roster)` — keep the two in step).
- **Corpses hold grudges.** Bodies stay in `game.npcs` forever, and a faction's
  shared disposition unions over the dead. Removing a body would erase the grudges
  it holds — read the TODO in AISystem before adding body cleanup.
- **Initial seeding** (`Game.init`): bandits ↔ PC faction bidirectionally; bandits →
  guards one-way (guards don't auto-aggro). Guards stay neutral to the player until
  somebody swings at one — then the whole guard faction turns.

Same faction: allies. Cannot be targeted, but attacks hit whoever is on the hex, so
friendly fire is possible when a target moves.

## Threat Display (shared hex edges)

The border between two adjacent characters is a threat indicator, drawn by
`HexGridRenderer.drawFactionBorders`. **Hostility-gated**: neutral pairs (a guard at
your shoulder, your companion) and corpses draw no edge at all.

| Edge | Meaning |
|------|---------|
| faction → faction gradient | Hostile, both locked in — neither has flanking |
| solid violet | One side holds the flanking advantage (+15 THC live in one direction) |
| faction → violet → faction | Mutual flank — both exposed, +15 both ways |

Violet (`ENGAGEMENT_BORDER.FLANK_COLOR`, #DDA0FF) appears **if and only if flanking
is live**. `holdsFlankAdvantage()` delegates to `EngagementManager.determineFlanking()`,
the same call the THC math spends, so the border cannot disagree with it. The E/W edges compress to ~17px at
play zoom — the grammar deliberately carries on hue alone (seams and dashes vanish
at that size).

## Stats & Combat Calculations

### Stat System
- 12 stats in 6 categories (Physical/Cerebral pairs) — listed in `STATS.categories`
- Each stat: min 3, max 10
- Total points per character: 69 (36 base + 33 distributable)

**Stats with no attached systems yet:** `beauty`, `cha`, `source`, `luck`

### Stat Bonuses

**Constitution Bonus (additive HP modifier):**
| Con | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-----|---|---|---|---|---|---|---|---|
| Bonus | -4 | -2 | 0 | +1 | +2 | +4 | +6 | +8 |

**Multiplier Scale (used by Str, Will):**
| Stat | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|------|---|---|---|---|---|---|---|---|
| Mult | 1.0 | 1.25 | 1.5 | 1.75 | 2.0 | 2.25 | 2.5 | 3.0 |

### Derived Values
```javascript
maxHealth = ceil((15 + CON_BONUS[con]) * MULTIPLIER[str])
hpBufferMax = ceil(instinct * MULTIPLIER[will])
engagedMax = floor((per + wis + int) / 6)  // Cerebral Presence
```

### Naming

Three separate numbers that used to blur together:
- **AttkR** / **DefR** — Attack and Defense Rating, the to-hit pair
- **ADR** — Armor Damage Reduction, flat damage subtracted by armor
- **resist / vuln** — armor's 0.5x / 1.5x multipliers, applied *before* ADR

### COMBAT_MODIFIERS (const.js)

| Constant | Value | Meaning |
|----------|-------|---------|
| `THC_BASE` | 50 | Baseline to-hit before ratings and mods — even fighters land half their swings |
| `FLANK_THC_BONUS` | 15 | THC bonus while flanking (worth 3 skill levels or 5 stat points of DefR) |
| `CRIT_BASE` | 25 | Baseline crit chance before ratings and critMod |
| `CRIT_DAMAGE_MULT` | 1.5 | Default crit multiplier — a weapon's `passives.critMultiplier` REPLACES it |
| `KNOCKDOWN_DR_MULT` | 0.7 | DefR multiplier while prone |

### Combat Formulas

**Attack Rating:**
```
synergy = floor(partnerSkill / 3)  // partner = same damage type, different size
attkR = ((weaponSkill + synergy) * 5) + (str * 3) + (dex * 2) + passives.attkR
```

**Defense Rating:**
```
defR = (skill * 5) + (dex * 3) + (instinct * 2) + passives.defR + 5
// Uses block skill if shield, dodge skill otherwise
// calculateDefR(character, mode): 'auto' (combat), or 'block' / 'dodge' to
//   force a branch — 'dodge' also drops the off-hand's passives.
//   The character sheet shows both, dimming whichever the equipped off-hand isn't using.
// +5 base defence bonus makes hitting slightly harder
// While prone: floor(defR * KNOCKDOWN_DR_MULT) — see Conditions
```

**To-Hit Chance (integer percentage, 0-100%):**
```
THC = clamp(0, 100, (attkR + atkMods) - (defR + defMods) + THC_BASE)
// THC_BASE = 50 (COMBAT_MODIFIERS) — two dead-even fighters land half their swings
// atkMods: attacker-side bonuses. Today: flanking (+15, FLANK_THC_BONUS), else 0
// defMods: defender-side bonuses. Today: equipment evasionBonus (unarmed +5), else 0
// Roll d100 (1-100), hit if roll <= THC
```

**The formula never changes shape.** One rule decides where anything new lands:

- **Situation → mods.** Circumstances of the exchange (position, cover, range,
  stance) are signed entries in `atkMods`/`defMods`. Positive helps the bucket's
  owner; debuffs are just negative entries. Flat on purpose — being behind
  someone is worth the same +15 no matter who they are.
- **State → ratings.** Conditions of the *character* change what a rating **is**;
  they never touch the formula. Precedent: DefR already branches block-vs-dodge
  on equipment, and nobody calls that a second THC formula. Prone is the same
  move — `floor(defR × KNOCKDOWN_DR_MULT)` against adjacent melee. Multiplicative
  because it impairs capability (a master dodger has more to lose), and because
  it rides rating inflation: flat −15 matches ×0.7 on today's DefR 44–69 roster
  but goes trivial at the ~113 a max block build reaches.

Flanking itself already obeys the rule in both directions: flat +15 on the roll
(situation), but armor ADR × `flankingDefense` (a capability, degraded
multiplicatively).

When ranged attacks arrive, the prone transform should move into a
`calculateEffectiveDefR(defender, attackContext)` so the rating layer owns all
of its own derivations (prone classically *helps* at range) and
`resolveHitRoll()` stays pure formula.

**Flanking:** granted by attacking from behind the defender's facing **or** by the
defender being at `engagedMax` and unable to engage the attacker back. The two
sources do not stack — either alone gives the same `+15` THC and the same armor
ADR scaling. Resolved by `EngagementManager.determineFlanking()` *before* the hit
roll, since the roll spends it. Both consumers call that one method:
`CombatSystem.executeAttack()` for the THC/ADR math, and
`HexGridRenderer.holdsFlankAdvantage()` to colour the shared hex edge.

**Critical Ratings (integer percentage, 0-100%):**
```
critAttkR = (criticalStrike * 5) + (int * 3) + (str * 2)
critDefR  = (criticalDefense * 5) + (dex * 3) + (per * 2) + instinct
CSC = clamp(0, 100, (critAttkR - critDefR) + CRIT_BASE + critMod)
// CRIT_BASE = 25. Two even fighters land ~21%, so crit is a minority outcome.
// This leaves only ~21 points of room below: a critMod steeper than about -20
// clamps to a flat 0% and the weapon can never crit at all.
// critMod: flat modifier from passives (unarmed -15, hammers -10, swords +10)
// Roll d100 (1-100), crit if roll <= CSC
```

**Damage Calculation (base → vuln/resist → ADR → crit):**
1. Base: `weapon.base + ceil(weapon.force * MULTIPLIER[str]) + attackType.damageMod`
2. **Crit is rolled here**, before ADR — a concussive crit decides whether ADR applies at all. The multiplier itself is still applied last, at step 6.
3. Resistance/Vulnerability: Multiply by 0.5 (resistant) or 1.5 (vulnerable). Weapon enhancements can increase the vulnerable multiplier (see Weapon Effects below)
4. Flanking Check: Attacker behind defender OR defender over-engaged (at max capacity)
5. Armor Damage Reduction: `effectiveADR = flanking ? floor(armor.adr * armor.flankingDefense) : armor.adr`, then `damage = max(0, damage - effectiveADR)`. Skipped entirely when step 2 crit on a `bypassADROnCrit` damage type (concussive).
6. Critical Hit: Multiply by `getCritMultiplier(attacker)` — a weapon's `passives.critMultiplier` **replaces** the 1.5x default rather than stacking with it (unarmed: 2x)

### Speed & Turn Order

**Move Speed (movement phase):**
```
moveSpeed = armor.mobility - str  // Lower = faster
```

**Action Speed (attack phase):**
```
actionSpeed = weapon.speed + shield.speed (if not 2h) + attackType.speedMod - dex
// STAND resolves at light-attack action speed
```

**Speed Tiers:**
| Tier | Speed Range | Name |
|------|-------------|------|
| 1 | 0-25 | 1/4 (fastest) |
| 2 | 26-40 | 2/4 |
| 3 | 41-55 | 3/4 |
| 4 | 56+ | 4/4 (slowest) |

**Ordering within a phase:** speed tier, then `initiative = will + instinct`
(higher first), then a per-round d100 roll breaks remaining ties. Raw speed score
never competes inside a tier — a 42 can act after a 55 in the same tier if its
initiative is lower.

Every phase line in the combat log carries the full ordering bracket
`[speed Ttier Iinit]` (`CombatSystem.formatSpeedBracket`), with the speed and
initiative formulas in its hover tooltip.

### HP Buffer System
Each attacker must deplete a character's buffer individually before dealing real HP damage. Represents composure that resets per-opponent. Unrelated to the (future) Stamina resource — the buffer is derived from Instinct and Will, not spent by moving or acting.

## Equipment

### Weapons
| Weapon | Base | Type | Force | Speed | Grip | Special |
|--------|------|------|-------|-------|------|---------|
| Unarmed | 2 | concussive | 1 | 16 | two | evasionBonus: 5, critMod: -15, critMultiplier: 2, bypasses buffer, crit bypasses ADR + knocks down |
| Short Spear | 3 | piercing | 1 | 19 | one | vulnerableEnhancementLight |
| Short Sword | 4 | slash | 2 | 18 | one | critMod: 10, bleedingLight |
| Short Hammer | 6 | blunt | 3 | 26 | one | critMod: -10, armorDamageEnhancementLight |
| Long Sword | 8 | slash | 4 | 20 | two | critMod: 10, bleedingHeavy |
| Long Spear | 6 | piercing | 4 | 20 | two | vulnerableEnhancementHeavy |
| Long Hammer | 10 | blunt | 6 | 31 | two | critMod: -10, armorDamageEnhancementHeavy |
| Small Shield | 1 | blunt | 2 | 17 | off | defR: 4 |
| Large Shield | 1 | blunt | 3 | 20 | off | defR: 8 |

**Grip types:** `one` (mainHand only), `two` (both hands), `off` (offHand only)

**Passive bonus channels** (summed across mainHand + offHand + armor by
`getEquipmentBonus`): `attkR`, `defR`, `evasionBonus`, `critMod`, `critMultiplier`.

### Weapon Effects

| Effect | Attack Type | Description |
|--------|-------------|-------------|
| evasionBonus | - | Reduces enemy to-hit chance (passive) |
| bypasses buffer | - | Concussive damage goes directly to HP |
| bypassADROnCrit | - | Concussive **crits** ignore armor ADR entirely (damage type property, not a weapon effect) |
| knockdown | - | Applied on every crit from a weapon carrying it. No second roll — the crit *is* the roll |
| vulnerableEnhancementLight | Light | Replaces 1.5x vulnerable multiplier with 2.0x |
| vulnerableEnhancementHeavy | Heavy | Replaces 1.5x vulnerable multiplier with 2.5x |
| bleedingLight/Heavy | - | Not yet implemented |
| armorDamageEnhancementLight/Heavy | - | Not yet implemented |

**Note:** Enhancement effects only activate when using the matching attack type. Using the wrong attack type (e.g., heavy attack with vulnerableEnhancementLight) applies only the base 1.5x multiplier.

### Attack Types
| Type | Speed Mod | Damage Mod |
|------|-----------|------------|
| Light | +12 | +0 |
| Heavy | +22 | +6 |

### Armor
`adr` is the flat Armor Damage Reduction. Resistant/Vulnerable are the multipliers, applied *before* it.

| Armor | ADR | Mobility | Resistant | Vulnerable | Flank Def |
|-------|-----|----------|-----------|------------|-----------|
| None | 0 | 20 | - | slash, piercing, blunt | 1.0 |
| Leather | 6 | 20 | piercing | blunt | 1.5 |
| Scale | 8 | 25 | slash | piercing | 0.0 |
| Brigandine | 10 | 23 | piercing, slash | blunt | 0.5 |
| Chain | 10 | 28 | slash | - | 0.25 |
| Plate | 12 | 30 | slash, blunt | piercing | 0.75 |

Concussive is deliberately absent from every resist/vuln list — it has its own
mechanics (buffer bypass, ADR bypass on crit) instead.

Leather's `flankingDefense: 1.5` is intended: supple armor wraps evenly, so leather
gets *tougher* against flankers (ADR 6 → 9).

### Conditions
Live on `character.conditions` (a `Set` of `CONDITIONS.*` keys), initialized by
`CharacterFactory` and cleared wholesale by `GameStateManager.exitCombat()`.

| Condition | Applied by | Effect |
|-----------|-----------|--------|
| knockdown | Any crit from a weapon with the `knockdown` effect (currently unarmed) | Prone. Defends at `floor(defR * KNOCKDOWN_DR_MULT)` (0.7) against adjacent melee. Cannot move or attack; the only action is `COMBAT_ACTIONS.STAND`, which costs the round. An attack already declared but not yet resolved is **cancelled** if the attacker is knocked down first. Borrows the final frame of the `die` animation until a prone sprite exists. |

## Keyboard Controls

### Universal Controls
| Key | Action |
|-----|--------|
| **WASD** | Pan camera |
| **Arrow keys** | *Unbound, reserved.* Swallowed so they can't scroll the page — they no longer pan the camera or rotate facing |
| **Shift+Space** | Toggle combat mode |
| **Tab** (hold) | Show all character nameplates |

### Exploration Mode
| Key | Action |
|-----|--------|
| **1-6** | Trigger animations (idle, walk, run, attack, jump, die) |
| **8** | Debug: log character positions to console |
| **Click** | Move to clicked hex (pathfinding); place/remove characters when Spawn Mode is on, mark hexes when Hex Marker Mode is on |

### Combat Input Phase
| Key | Action |
|-----|--------|
| **1** | Activate Light Attack mode (swallowed while knocked down) |
| **2** | Activate Heavy Attack mode (swallowed while knocked down) |
| **Q / E** | Rotate facing one hex step CCW / CW. **Ctrl** doubles to 2 steps. Auto-repeat is swallowed — one press, one step |
| **Enter** | Repeat last attack (same hex + type). Only available if you have not moved since declaring it; the target hex is outlined in dashed red when available |
| **Space** | Skip turn (wait) — or **stand up** if knocked down, which is the only action available while prone |
| **Click adjacent hex** | Move (move mode, blue hover) or attack (attack mode, red dashed hover) |

**Hover cues:** move mode shows a solid blue highlight on valid empty hexes; attack
mode shows the red dashed outline on any attackable hex, including empty ones (a
lead). Corpse hexes get an orange X instead — they cannot be targeted.

**Facing commits on attack declaration** — selecting an attack target immediately
turns the PC toward it, so you can see which way the swing points you (and whose
flank you're opening) while there is still a decision to make.

### Edge Scrolling
Mouse near canvas edges scrolls camera.

## Combat System Flow

### Game States
1. **EXPLORATION** - Free movement, click anywhere to pathfind
2. **COMBAT_INPUT** - Turn-based input, select actions
3. **COMBAT_EXECUTION** - Sequential action resolution

### Action Declaration

All actions are stored through `GameStateManager.setCharacterAction()` — never via a
raw `characterActions.set()` — because declaration stamps facts execution cannot
recover:

- **`wasOccupied`** on attacks: whether someone stood on the target hex at
  declaration. This is what separates a regular attack from a **lead**.

| Declared at | Hex at resolution | Result |
|---|---|---|
| Occupied hex | target still there | Normal attack (hits whoever is there — even an ally who stepped in) |
| Occupied hex | target left | **Called off**: no turn, no swing, no whiff. Logged `(Blocked) - target left the hex`. Once Stamina lands, this branch must not charge |
| Empty hex (lead) | someone arrived | Normal attack |
| Empty hex (lead) | still empty | Swings and whiffs — a lead commits to striking open ground |

The called-off check runs *before* facing and the attack animation. An action that
never happens must not reposition its owner — facing is worth `FLANK_THC_BONUS` to
whoever ends up behind them.

**Planned (not yet implemented):** a READY action — resolves last, only swings at a
valid hostile target, never whiffs or hits allies; a led ready gains the flank THC
bonus against a target arriving mid-move. Stamina costs for moving/acting also
planned; turning and waiting will stay free.

### Combat Execution Order

**Move Phase** (all MOVE actions, speed-sorted):
1. Occupancy check at execution — move cancelled `(Blocked)` if the hex was taken
2. Move animates; on completion, engagement updates and the mover auto-faces the
   first adjacent enemy (`getNeighbors` order)
3. Facing set by travel direction *during* the move — a mover can present their back
   between departing and the auto-face

**Action Phase** (all ATTACK and STAND actions, speed-sorted):
1. Knocked-down attacker → declared attack cancelled (`knocked down before the swing`)
2. STAND: clears knockdown, drops the prone pose, costs the action
3. ATTACK: called-off / lead / normal resolution per the declaration table above,
   then the CombatSystem pipeline (THC → crit → resist/vuln → ADR → crit multiplier
   → buffer → health)
4. Hostility trigger: the target becomes mutual enemies with the attacker, even on a
   miss
5. Defeated characters hold the die pose; the body stays on its hex as an obstacle
   and keeps holding its grudges

One character resolves at a time (windup → resolve → recovery), so every attack
reads live state — facing changes and knockdowns from earlier in the phase are
visible to later attacks. Flanking is computed at resolution, not at declaration.

### Engagement System
- Characters track who is engaging them (`engagedBy` Set), capacity `engagedMax`
  (Cerebral Presence / 6), filled first-come-first-serve **on movement completion**
- A defender at max capacity who cannot engage an attacker back is treated as
  flanked by that attacker (the overload half of the flanking OR)
- `clearStaleEngagements` releases slots held by the non-adjacent **and the dead**,
  and freed slots are re-offered to characters already standing adjacent — a corpse
  or a departed attacker cannot lock a defender into permanent overload
- All engagements clear on combat exit
- Engagement is still **faction-based, not hostility-based**: a neutral guard
  adjacent to you occupies one of your slots. Known asymmetry with the
  hostility-gated threat display; revisit if neutral bodies distracting defenders
  feels wrong in play

### Combat Timing (const.js)
```javascript
COMBAT_PHASE_TRANSITION: 100   // ms between move and action phases
COMBAT_ATTACK_WINDUP: 100      // fallback — prefer calculateAttackTiming()
COMBAT_ATTACK_RECOVERY: 500    // fallback — prefer calculateAttackTiming()
```
`calculateAttackTiming(spriteSet)` derives windup/recovery from the actual attack
animation (impact lands ~40% through the frames).

## Debug & Dev Tools

### Debug Panel
Mouse position, current hex, camera position, PC facing, animation state, and the
mode checkboxes below.

### Grid Toggle
Checkbox enables/disables hex grid overlay.

### Spawn Mode (exploration only)
Checkbox plus two dropdowns (build, faction):
- Click an empty hex → place a test character from the selected build/faction
- Click a spawned character → remove them
- Placements persist into `areas/{id}/spawned.json` — a **gitignored sidecar**,
  merged into the roster at load, so playtest spawns survive a refresh without
  ever dirtying the hand-authored `area.json`. Promoting a test spawn into the
  real level means moving its entry into `area.json`'s `npcs[]` by hand.
- **Clear All Spawned** removes every spawned character at once (living and
  dead), scrubbing them from everyone's enemies/engagement/buffer maps so no
  ghost references linger, and empties the sidecar

### Hex Marker Mode (exploration only)
- Click hexes to mark/unmark as blocked
- Pre-populates with existing blocked hexes
- **Export Hexes** - outputs JSON to console
- **Clear Hexes** - removes all marks

### Logging
`Logger` routes combat lines to the on-screen combat log (with semantic
`{{token}}` markup — see `COMBAT_TAGS` / `WRAPPER_TAGS` in const.js) and
`logger.debug` lines to the browser console (`[AI]`, `[ENGAGEMENT]`, `[BUFFER]`,
`[DEFEAT]` prefixes).

## Sprite System

### Sprite Sets

Appearance follows gear: `deriveSpriteSet(equipment)` picks the set at creation, so
changing a weapon in the character creator changes how the character looks.

| Rule (first match wins) | Set | Folder |
|---|---|---|
| offHand is a shield | swordShieldKnight | KnightSwordShield |
| any weapon except unarmed | swordKnight | KnightSword |
| otherwise (unarmed) | baseKnight | KnightBasic |

Only three sets exist, so every armed character reads as "sword" — spears and
hammers included — until more art lands. An explicit `spriteSet` on a template or
area placement overrides the derivation.

### Animations
| Animation | Frames | Speed | Notes |
|-----------|--------|-------|-------|
| idle | 17 | 120ms | Looping |
| walk | 11-13 | default | Looping |
| run | 8 | default | Looping |
| attack | 15 | default | oneShot |
| jump | 9-11 | default | Looping |
| die | 16-27 | 60ms | Plays once, holds final frame — for the dead *and the prone* (knockdown borrows it) |
| impact | 9 | default | oneShot |
| idle2 | 25 | 142ms | oneShot |

- Default speed: 17ms per frame (ANIMATION_SPEED)
- Frame size: 256x256 pixels
- Sprite sheets have 8 directions; hex grid uses 6: dir1, dir2, dir3, dir5, dir6, dir7 (dir4, dir8 must never be assigned as a facing)

## Coordinate Systems

1. **Canvas coordinates** - Mouse position relative to canvas element
2. **World coordinates** - Pixel position in game world (before zoom/camera)
3. **Hex coordinates** - Axial (q, r) for grid logic

Conversion: canvas → world (factor camera/zoom) → hex (hexGrid.pixelToHex)

### Isometric Projection

The hex grid uses vertical compression to match isometric background art. Controlled by `ISO_RATIO` in const.js (default 0.5 = classic 2:1 isometric).

**Three places must stay in sync** (all reference `hexGrid.isoRatio`):
1. `HexGrid.hexToPixel()` - scales Y spacing between hex centers
2. `HexGrid.pixelToHex()` - un-scales Y for click detection
3. `Renderer.drawHex()` - scales Y offset of hex corner points

**Tuning:** If hexes don't align with floor tiles in background art, adjust `ISO_RATIO`. Values 0.48-0.55 cover most isometric art styles.

**Future considerations:**
- Per-area ratio: If backgrounds have different angles, make `ISO_RATIO` per-area in area.json
- Performance: `drawHexGrid` currently iterates all world hexes. For very large maps, add camera culling
- `hexHeight` is updated to `2 * hexSize * isoRatio` but may be unused - verify if adding spacing logic

## Direction System

Only 6 directions matching hex grid neighbors:
```
dir6 = 0°   (East)
dir7 = 60°  (Southeast)
dir1 = 120° (Southwest)
dir2 = 180° (West)
dir3 = 240° (Northwest)
dir5 = 300° (Northeast)
```

Opposites: dir1↔dir5, dir2↔dir6, dir3↔dir7 — `isFlanking` compares the attack
direction against the opposite of the defender's facing, so a valid six-way facing
is what makes a character flankable at all.

`rotateFacing` cycles dir6→dir7→dir1→dir2→dir3→dir5; an off-cycle facing snaps to
dir6 rather than freezing.

## Area System

Baldur's Gate-style discrete areas with pre-rendered backgrounds.

### Area Structure
```
areas/
  bridge_crossing/
    area.json           <- Area definition
    background.jpg      <- Background image
```

### Area Definition Schema
```javascript
{
    "id": "bridge_crossing",
    "name": "Stone Bridge",
    "background": "background.jpg",
    "width": 1920,
    "height": 1080,
    "blocked": [{"q": 0, "r": 0, "type": "water"}],
    "spawns": {"default": {"q": 5, "r": -5}},
    "exits": [{
        "id": "north_exit",
        "hexes": [{"q": 0, "r": -10}],
        "target": "forest_path",
        "spawn": "south"
    }],
    "npcs": [
        // Template-backed placement (identity from NPC_TEMPLATES)
        {"templateId": "bandit", "hexQ": 3, "hexR": -7, "name": "Bandit"},
        // Build-backed placement (identity carried inline; used by Spawn Mode)
        {"buildId": "guard_novice", "name": "Guard Novice 2", "faction": "guard",
         "mode": "aggressive", "hexQ": 4, "hexR": -3,
         "facing": "dir2", "animationFrame": 2, "animationTimer": 100}
    ]
}
```

An npc entry needs `templateId` **or** `buildId`. Template placements pull identity
from `NPC_TEMPLATES` (build files can still override the editable parts); build-only
placements must carry their own `faction`/`mode`. Optional per-placement fields:
`name`, `facing`, `spriteSet`, `animationFrame`/`animationTimer` (desynchronizes
idle loops so a row of guards doesn't breathe in unison).

Spawn Mode's `buildId` placements are NOT written here — they live in a
`spawned.json` sidecar next to `area.json` (same array-of-specs shape, gitignored,
merged at load). `saveArea()` strips `buildId` entries defensively, so even a
hand-authored area save cannot leak test spawns into level data.

### AreaManager API
```javascript
await areaManager.loadArea('bridge_crossing', 'default');
const exit = areaManager.getExitAt(pc.hexQ, pc.hexR);
const blocked = areaManager.isBlocked(q, r);
const bg = areaManager.getBackground();
const { width, height } = areaManager.getDimensions();
```
