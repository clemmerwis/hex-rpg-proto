# Combat Development Roadmap

This document outlines the prioritized development plan for expanding the combat system in the hex-grid RPG prototype.

> **Statuses verified against source 2026-08-08.** Items #2 and #3 were marked
> IN PROGRESS but had drifted far out of date — see their entries.
>
> **Next up: #6 (victory/defeat).** Its dependencies (#2, #5) are both done, and
> without it combat has no terminal state — you can defeat every enemy and nothing
> happens. Highest leverage remaining item despite its MEDIUM priority.

## Development Priorities

### 1. Replace interval polling with event-based callbacks
**Priority:** CRITICAL
**Status:** COMPLETE (commit 5e79260)

Replaced interval polling with event-based movement callbacks in MovementSystem. GameStateManager now uses `onMovementComplete()` callbacks instead of polling.

**Impact:**
- Eliminates race conditions in combat execution
- Improves responsiveness
- Makes debugging easier
- Foundation for all other combat improvements

---

### 2. Create CombatSystem.js for damage/attacks
**Priority:** HIGH
**Status:** COMPLETE
**Depends On:** #1

Core combat mechanic that unlocks everything else. Went well past "basic structure" —
the damage pipeline is now the most developed part of the game.

**Scope:**
- ✅ Damage calculation formulas (THC = Attack_R - Defense_R + 50%)
- ✅ Attack resolution (hit/miss)
- ✅ Defense/armor mechanics (attack_rating, defense_rating)
- ✅ Health modification
- ✅ Character defeat detection
- ✅ Combat animation triggers (impact/die, frame reset on attack)

**Current Implementation** (`js/CombatSystem.js`, 424 lines):
- `executeAttack(attacker, targetHex, attackType)` — 43-line orchestrator, 14 steps
- Damage pipeline: base damage → resist/vuln → flanking + DR → crit
- Weapon/armor system: `WEAPONS`, `ARMOR_TYPES` with resistantAgainst /
  vulnerableAgainst / flankingDefense / mobility
- Per-attacker buffer system with concussive bypass (`applyDamage`)
- Action speed + CSC (crit) rolls surfaced in the combat log
- Semantic token logging throughout (`{{dmg}}`, `{{hp}}`, `{{buf}}`, …)
- `isValidAttackTarget(hexQ, hexR, attacker)` — still hardcoded range 1 (see #4)

Refactored into helpers per `combatsystem-refactoring-plan.md` (complete). Supporting
modules split out: `CombatLogFormatter.js`, `CombatExecutor.js`,
`CombatInputHandler.js`, `EngagementManager.js`.

---

### 3. Extend action system beyond MOVE/WAIT
**Priority:** HIGH
**Status:** IN PROGRESS
**Depends On:** #2

Define ATTACK, DEFEND, ABILITY actions to enable tactical gameplay.

**New Actions:**
- ✅ ATTACK - Melee attack on adjacent target (implemented)
- ❌ DEFEND - Defensive stance, damage reduction (no trace in `js/`)
- ❌ ABILITY - Special abilities (skills, spells) (no trace in `js/`)
- ❌ FLEE - Attempt to escape combat (no trace in `js/`)
- ❌ INTERACT - Use items or interact with environment (no trace in `js/`)

ATTACK went deep (light/heavy variants in `ATTACK_TYPES`, each with speedMod and
damageMod) but stayed the *only* verb. `ATTACK_TYPES` in `const.js` has exactly two
entries. Breadth of choice is the gap here, not depth.

**Current Implementation:**
- ✅ AI uses mode-based targeting (neutral vs aggressive)
- ✅ Two-phase execution: all MOVEs, then all ATTACKs
- ✅ Attacks hit whoever is on target hex (friendly fire possible)
- ✅ Animation frame reset on attack start (fixes intermittent wrong frame order)
- ✅ light/heavy attack types with distinct speed and damage profiles

---

### 3b. NPC Disposition System
**Priority:** HIGH
**Status:** COMPLETE

Per-character AI behavior with mode-based targeting and dynamic hostility.

**Features:**
- ✅ Two behavior modes: `neutral` and `aggressive`
- ✅ Per-character `enemies` Set for tracking opposition
- ✅ `lastAttackedBy` for tiebreaker targeting
- ✅ Hostility trigger: being attacked adds attacker to enemies and switches to aggressive
- ✅ All living NPCs participate in combat (not just faction=enemy)

**Mode Behaviors:**
- `neutral`: Move toward nearest character, wait if adjacent, never attack
- `aggressive`: Move toward closest enemy from opposition Set, attack if adjacent

**Example:**
- Guard starts neutral → moves toward nearest character
- Bandit attacks Guard → Guard becomes aggressive toward Bandit
- Guard pursues and attacks Bandit (not Hero, unless Hero attacks Guard)

---

### 4. Add range-based targeting
**Priority:** MEDIUM
**Status:** Not Started
**Depends On:** #3

Allow attacks from distance, not just adjacent hexes. Enables ranged combat and spell casting.

Confirmed not started: `CombatSystem.isValidAttackTarget()` hardcodes range 1
(`js/CombatSystem.js:417`, comment reads "Check adjacency (range = 1)"). Weapons have
no range property.

**Features:**
- Range calculation for different action types
- Line of sight checking
- Valid target highlighting
- Area of effect targeting

---

### 5. Implement turn order/initiative
**Priority:** MEDIUM
**Status:** COMPLETE

Characters act based on speed stats rather than hardcoded PC-first order.

**Features:**
- ✅ Initiative/speed stat for characters (Player: 12, Ally: 10, Enemy: 8, Neutral: 6)
- ✅ Turn order calculation (sortBySpeed with random tiebreaker)
- ✅ Character removal on defeat (bodies stay as obstacles, removed from combat queue)
- ✅ Defeated characters skipped in move/attack phases
- ✅ Death animation holds on final frame
- Turn order UI visualization (shows current character name)

**Current Implementation:**
- Speed stat determines order within each phase (move phase, action phase)
- Higher speed = acts first; ties randomized
- Dead characters remain on hex as obstacles, excluded from AI targeting

---

### 6. Add victory/defeat conditions
**Priority:** MEDIUM — **but this is the recommended next item**
**Status:** Not Started
**Depends On:** #2, #5 — both COMPLETE, so this is unblocked

Make combat actually end with proper win/loss states.

Confirmed not started: no `victory`, `endCombat`, or `allEnemiesDefeated` symbol exists
anywhere in `js/`. Individual character defeat works (`handleHitResult` →
`GameStateManager.handleCharacterDefeat()`), but nothing checks whether that defeat
ended the *encounter*. Combat currently has no terminal state — defeat every enemy and
the game sits in COMBAT_EXECUTION forever.

This is why it should jump the queue ahead of #3's remaining verbs and #4: it's the
difference between a combat demo and a combat loop.

**Features:**
- Victory detection (all enemies defeated)
- Defeat detection (PC defeated)
- Combat end transition to exploration
- Victory/defeat UI and animations
- Rewards/loot system (future)
- Experience/leveling (future)

---

## Implementation Notes

- Each item should be completed and tested before moving to the next
- Maintain backwards compatibility during refactoring
- Add debug controls for testing each feature
- Update CLAUDE.md documentation as features are added
- Consider performance impact as combat scales to 10+ characters

## Timeline

This is a prototype - implement features incrementally with user feedback between each phase. Focus on getting each piece working solidly before adding complexity.
