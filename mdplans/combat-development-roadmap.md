# Combat Development Roadmap

This document outlines the prioritized development plan for expanding the combat system in the hex-grid RPG prototype.

## Development Priorities

### 1. Replace interval polling with event-based callbacks
**Priority:** CRITICAL
**Status:** Not Started

This fixes the fragile movement completion checking in GameStateManager and makes the system more responsive. The current setInterval polling approach is brittle and creates timing issues.

**Impact:**
- Eliminates race conditions in combat execution
- Improves responsiveness
- Makes debugging easier
- Foundation for all other combat improvements

---

### 2. Create CombatSystem.js for damage/attacks
**Priority:** HIGH
**Status:** Not Started
**Depends On:** #1

Core combat mechanic that unlocks everything else. This will handle damage calculation, effect application, and combat resolution.

**Scope:**
- Damage calculation formulas
- Attack resolution
- Defense/armor mechanics
- Health modification
- Character defeat detection
- Combat animation triggers

---

### 3. Extend action system beyond MOVE/WAIT
**Priority:** HIGH
**Status:** Not Started
**Depends On:** #2

Define ATTACK, DEFEND, ABILITY actions to enable tactical gameplay.

**New Actions:**
- ATTACK - Melee or ranged attack on target
- DEFEND - Defensive stance, damage reduction
- ABILITY - Special abilities (skills, spells)
- FLEE - Attempt to escape combat
- INTERACT - Use items or interact with environment

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
**Status:** Not Started

Characters act based on speed stats rather than hardcoded PC-first order.

**Features:**
- Initiative/speed stat for characters
- Turn order calculation and display
- Character removal on defeat
- Turn order UI visualization

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
