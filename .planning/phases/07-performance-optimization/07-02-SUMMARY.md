---
phase: 07-performance-optimization
plan: 02
subsystem: ai-system
tags: [vanilla-js, performance, memoization, ai]

# Dependency graph
requires:
  - phase: 07-performance-optimization plan 01
    provides: pathfinding-result-cache, version-based-invalidation-pattern
provides:
  - Per-turn distance matrix for O(1) AI distance lookups
  - beginTurn() precomputation wired from GameStateManager
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [per-turn-precomputation, symmetric-distance-matrix]

key-files:
  created: []
  modified: [js/AISystem.js, js/GameStateManager.js]

key-decisions:
  - "No endTurn cleanup — matrix is cheap and gets cleared at next beginTurn()"
  - "Fallback to direct hexDistance computation if matrix miss (defensive)"
  - "Store both directions in matrix for O(1) symmetric lookup"

patterns-established:
  - "Per-turn precomputation: build data structure once per turn, use across multiple AI methods"

issues-created: []
duration: 3min
completed: 2026-02-17
---

# Phase 7 Plan 2: Memoize AI Distance Calculations Summary

**Per-turn distance matrix eliminates redundant hexDistance calls across AI methods**

## Performance

- **Duration:** 3min
- **Tasks:** 2 auto
- **Files modified:** 2

## Accomplishments

- Added `_distanceMatrix` Map to AISystem constructor
- Added `beginTurn(allCharacters)` method that precomputes all pairwise distances in N*(N-1)/2 computations
- Added `_getDistance(charA, charB)` method with O(1) matrix lookup and fallback to direct computation
- Refactored 5 methods to use `_getDistance()`: findNearestSameFaction, findClosestEnemy, findNearestCharacter, getMoveTowardAction, getAIAction (neutral clustering)
- Wired `aiSystem.beginTurn(this.combatCharacters)` in GameStateManager.processAITurns() before the NPC loop
- AI decisions remain identical to pre-optimization behavior

## Task Commits

1. **Task 1: Add per-turn distance matrix to AISystem** - `f0498b8` (perf)
2. **Task 2: Wire beginTurn from GameStateManager.processAITurns** - `f705f8d` (perf)

## Files Created/Modified

- `js/AISystem.js` - Added _distanceMatrix, beginTurn(), _getDistance(), refactored 5 methods to use matrix lookups
- `js/GameStateManager.js` - Added aiSystem.beginTurn() call before AI loop in processAITurns()

## Decisions Made

None beyond plan specification.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Next Step

Phase 7 complete. All roadmap phases finished -- codebase health milestone done.

---
*Phase: 07-performance-optimization*
*Completed: 2026-02-17*
