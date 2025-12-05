# Combat Development Roadmap

This document outlines the prioritized development plan for expanding the combat system in the hex-grid RPG prototype.

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
**Status:** IN PROGRESS (basic structure complete)
**Depends On:** #1

Core combat mechanic that unlocks everything else. CombatSystem.js created with basic attack/THC formula.

**Scope:**
- ✅ Damage calculation formulas (THC = Attack_R - Defense_R + 50%)
- ✅ Attack resolution (hit/miss)
- ✅ Defense/armor mechanics (attack_rating, defense_rating)
- ✅ Health modification
- ✅ Character defeat detection
- 🔄 Combat animation triggers (in progress)

**Current Implementation:**
- `executeAttack(attacker, defender)` - resolves attack with THC formula
- `isValidAttackTarget(hexQ, hexR, attacker)` - validates adjacent enemies
- Fixed damage (10) for now, will expand later

---

### 3. Extend action system beyond MOVE/WAIT
**Priority:** HIGH
**Status:** IN PROGRESS
**Depends On:** #2

Define ATTACK, DEFEND, ABILITY actions to enable tactical gameplay.

**New Actions:**
- ✅ ATTACK - Melee attack on adjacent target (implemented)
- DEFEND - Defensive stance, damage reduction
- ABILITY - Special abilities (skills, spells)
- FLEE - Attempt to escape combat
- INTERACT - Use items or interact with environment

**Current Implementation:**
- ✅ AI uses mode-based targeting (neutral vs aggressive)
- ✅ Two-phase execution: all MOVEs, then all ATTACKs
- ✅ Attacks hit whoever is on target hex (friendly fire possible)
- ✅ Animation frame reset on attack start (fixes intermittent wrong frame order)

---

### 3b. NPC Disposition System
**Priority:** HIGH
**Status:** COMPLETE

Per-character AI behavior with mode-based targeting and dynamic hostility.

**Features:**
- ✅ Two behavior modes: `neutral` and `aggressive`
- ✅ Per-character `enemies` Set for tracking personal enemies
- ✅ `lastAttackedBy` for tiebreaker targeting
- ✅ Hostility trigger: being attacked adds attacker to enemies and switches to aggressive
- ✅ All living NPCs participate in combat (not just faction=enemy)

**Mode Behaviors:**
- `neutral`: Move toward nearest character, wait if adjacent, never attack
- `aggressive`: Move toward closest enemy from personal enemies Set, attack if adjacent

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
**Priority:** MEDIUM
**Status:** Not Started
**Depends On:** #2, #5

Make combat actually end with proper win/loss states.

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
