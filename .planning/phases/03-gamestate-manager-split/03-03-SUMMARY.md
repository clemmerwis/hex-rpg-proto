---
phase: 03-gamestate-manager-split
plan: 03
subsystem: game-logic
tags: [vanilla-js, animation-timing, sprite-data, combat-execution]

# Dependency graph
requires:
  - phase: 03-gamestate-manager-split plan 01
    provides: CombatExecutor module with executeNextAttack using hardcoded timing
provides:
  - calculateAttackTiming() helper deriving windup/recovery from sprite frameCount
  - CombatExecutor using sprite-derived timing instead of hardcoded constants
  - Self-consistent animation timing that auto-adjusts when sprite data changes
affects: [04-renderer-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-driven-timing, fallback-defaults]

key-files:
  created: []
  modified: [js/const.js, js/CombatExecutor.js, js/Game.js]

key-decisions:
  - "COMBAT_ATTACK_WINDUP and COMBAT_ATTACK_RECOVERY kept as fallback defaults rather than removed — defensive coding for cases where setAttackTiming is not called"
  - "40% of attack animation used as windup point — approximates visual impact frame"

patterns-established:
  - "Data-driven timing: derive animation constants from sprite data rather than hardcoding"

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-16
---

# Plan 03-03: Derive Animation Timing Summary

**calculateAttackTiming() helper derives windup (102ms) and recovery (306ms) from sprite frameCount, replacing hardcoded constants; CombatExecutor now auto-adjusts if sprite frame counts change**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T07:27:48Z
- **Completed:** 2026-02-16T07:30:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created calculateAttackTiming() that derives windupMs and recoveryMs from sprite attack/impact frameCount and speed
- CombatExecutor uses sprite-derived timing (102ms windup, 306ms recovery) instead of hardcoded (100ms, 500ms)
- Recovery is snappier (306ms vs 500ms) — now matches actual animation duration instead of arbitrary padding
- GAME_CONSTANTS values annotated as fallbacks, kept for defensive coding

## Task Commits

Each task was committed atomically:

1. **Task 1: Add calculateAttackTiming helper to const.js** - `3bbef3b` (feat)
2. **Task 2: Use derived timing in CombatExecutor** - `7fd3e68` (refactor)

## Files Created/Modified
- `js/const.js` - Added calculateAttackTiming() function; annotated timing constants as fallbacks
- `js/CombatExecutor.js` - Import calculateAttackTiming, setAttackTiming() method, instance properties replace GAME_CONSTANTS refs
- `js/Game.js` - Import SPRITE_SETS, call setAttackTiming() after creating CombatExecutor

## Decisions Made
- Kept COMBAT_ATTACK_WINDUP/RECOVERY as fallback defaults rather than removing — defensive for cases where setAttackTiming not called
- 40% of attack animation frames used as windup point — reasonable approximation of visual impact frame

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SPRITE_SETS data structure uses nested animations object**
- **Found during:** Task 1 (implementing calculateAttackTiming)
- **Issue:** Plan referenced `spriteSet.attack` and `spriteSet.impact`, but actual SPRITE_SETS structure nests under `spriteSet.animations.attack` and `spriteSet.animations.impact`
- **Fix:** Implementation uses `spriteSet.animations.attack` and `spriteSet.animations.impact` to match real data structure
- **Verification:** Function correctly reads frameCount and speed from nested structure
- **Committed in:** 3bbef3b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for correctness — using wrong property path would return undefined. No scope creep.

## Issues Encountered
None

## Next Phase Readiness
- Phase 3 complete — GameStateManager split into focused modules
- GSM reduced from 730 to 358 lines across 3 plans
- New modules: CombatExecutor.js, EngagementManager.js
- Animation timing now data-driven
- Ready for Phase 4: Renderer Refactor

---
*Phase: 03-gamestate-manager-split*
*Completed: 2026-02-16*
