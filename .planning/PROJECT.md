# Hex RPG Proto — Codebase Health

## What This Is

A hex-grid RPG prototype with well-structured, modular codebase after a systematic quality pass. Monolithic files decomposed into focused modules, magic numbers consolidated, race conditions fixed, validation added, and per-frame calculations cached.

## Core Value

Code quality — split large files, reduce method sizes, and improve maintainability so the codebase stays workable as features grow.

## Requirements

### Validated

- ✓ Hex-grid movement with A* pathfinding — existing
- ✓ Turn-based combat with THC/damage pipeline — existing
- ✓ NPC disposition system (neutral/aggressive modes) — existing
- ✓ Speed-based initiative and turn ordering — existing
- ✓ Dependency injection module architecture — existing
- ✓ State machine (EXPLORATION/COMBAT_INPUT/COMBAT_EXECUTION) — existing
- ✓ Semantic token combat log with rich formatting — existing
- ✓ Per-attacker HP buffer system — existing
- ✓ Canvas-based rendering with sprite animations — existing
- ✓ Split large monolithic files (GSM, Renderer, CombatUILog, InputHandler) — v1.0
- ✓ Reduce CombatSystem.executeAttack() to 42-line pipeline orchestrator — v1.0
- ✓ Consolidate scattered magic numbers into const.js — v1.0
- ✓ Fix race condition in MovementSystem callbacks — v1.0
- ✓ Add area.json schema validation in AreaManager — v1.0
- ✓ Consistent error handling and DI validation across modules — v1.0
- ✓ Cache hex visibility calculations — v1.0
- ✓ Cache pathfinding results with version-based invalidation — v1.0
- ✓ Pre-compute connected blocked hex regions — v1.0
- ✓ Memoize AI distance calculations per turn — v1.0

### Active

(None — v1.0 milestone complete)

### Out of Scope

- New game features (combat actions, ranged targeting, victory conditions) — separate work tracked in mdplans/
- Test infrastructure (no test framework or test files) — future milestone
- Area transition wiring — partially implemented but not part of this effort
- Save/load system — future feature work

## Context

- Codebase is ~6,788 lines of vanilla JavaScript (ES6 modules), 24 files in `js/`
- No build step, no package manager, no external dependencies
- Runs in browser via Docker + nginx static file serving
- Codebase analysis in `.planning/codebase/CONCERNS.md` (most concerns now addressed)
- Separate combat development roadmap exists at `mdplans/current/` (not GSD-managed)
- Game is functional — all v1.0 changes preserved existing behavior

## Constraints

- **No behavior changes**: Refactoring only — game must play identically before and after each change
- **Vanilla JS**: No framework, bundler, or dependency additions
- **Tab-4 indentation**: Match existing code style (double quotes, semicolons, PascalCase files)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on code quality over features | Codebase growing harder to maintain; invest now to unblock future work | ✓ Good — all targets met |
| No test infrastructure in scope | Keep focused on refactoring; tests are a separate milestone | ✓ Good — stayed focused |
| Preserve all existing behavior | Refactoring must be safe; no functional changes | ✓ Good — game plays identically |
| hexKey() as canonical key function | Eliminate fragile string convention across files | ✓ Good — 20 inline patterns replaced |
| Direct DI for cross-cutting concerns | EngagementManager injected directly instead of routing through GSM | ✓ Good — eliminated split-tracking fragility |
| Cache invalidation by world dimensions | Simpler than camera-based; covers all cases | ✓ Good — no stale results |
| Deferred callback queue for movement | Deterministic ordering replaces setTimeout(0) | ✓ Good — race condition eliminated |

---
*Last updated: 2026-02-17 after v1.0 milestone*
