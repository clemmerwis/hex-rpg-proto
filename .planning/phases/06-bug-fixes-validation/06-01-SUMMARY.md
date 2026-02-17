---
phase: 06-bug-fixes-validation
plan: 01
subsystem: movement
tags: [vanilla-js, race-condition, callbacks, movement-system]

# Dependency graph
requires:
  - phase: 03-gamestate-manager-split plan 01
    provides: CombatExecutor with movement completion callbacks via onMovementComplete
provides:
  - Deterministic movement callback ordering via deferred queue pattern
  - _pendingCallbacks array replaces setTimeout(0) for callback dispatch
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [deferred-callback-queue, copy-and-clear-drain]

key-files:
  created: []
  modified: [js/MovementSystem.js]

key-decisions:
  - "Copy-and-clear before drain: prevents same-cycle re-entrancy from callbacks that trigger new movements"

patterns-established:
  - "Deferred callback queue: collect callbacks during iteration, drain synchronously after loop completes"

issues-created: []
duration: 3min
completed: 2026-02-17
---

# Phase 6 Plan 1: Fix MovementSystem setTimeout Race Condition

**Replaced setTimeout(0) with deterministic deferred callback queue for movement completion dispatch**

## Performance

- **Duration:** 3min
- **Started:** 2026-02-17T01:23:54Z
- **Completed:** 2026-02-17T02:17:17Z
- **Tasks:** 1 auto + 1 checkpoint
- **Files modified:** 1

## Accomplishments

- Eliminated setTimeout(0) race condition in MovementSystem callback dispatch
- Movement completion callbacks now fire in deterministic character array order (PC first, then NPCs)
- Copy-and-clear pattern prevents re-entrancy: callbacks from newly-started movements queue for next cycle
- clearAllCallbacks() also clears pending queue to prevent stale callbacks after combat exit

## Task Commits

1. **Task 1: Replace setTimeout(0) with deferred callback queue** - `d46fa7d` (fix)

## Files Created/Modified

- `js/MovementSystem.js` - Replaced setTimeout(0) with _pendingCallbacks deferred queue pattern

## Decisions Made

None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 06-02-PLAN.md (area.json schema validation).

---
*Phase: 06-bug-fixes-validation*
*Completed: 2026-02-17*
