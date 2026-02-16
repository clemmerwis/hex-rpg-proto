# Hex RPG Proto — Codebase Health

## What This Is

A technical quality pass on the hex-grid RPG prototype. The game works but has accumulated tech debt — large monolithic files, scattered magic numbers, missing validation, race conditions, and per-frame performance waste. This project addresses the concerns identified in `.planning/codebase/CONCERNS.md`.

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

### Active

- [ ] Split large monolithic files (GameStateManager 722 lines, Renderer 663 lines, CombatUILog 453 lines, InputHandler 419 lines)
- [ ] Reduce CombatSystem.executeAttack() from ~200 lines / 18+ responsibilities
- [ ] Consolidate scattered magic numbers into const.js
- [ ] Fix race condition in MovementSystem callbacks (setTimeout 0 ordering)
- [ ] Add area.json schema validation in AreaManager
- [ ] Consistent error handling strategy across modules
- [ ] Cache hex visibility calculations (recalculated every frame)
- [ ] Cache pathfinding results (A* recomputed for identical paths)
- [ ] Pre-compute connected blocked hex regions (flood-fill on every hover)
- [ ] Memoize AI distance calculations per turn

### Out of Scope

- New game features (combat actions, ranged targeting, victory conditions) — separate work tracked in mdplans/
- Test infrastructure (no test framework or test files) — future milestone
- Area transition wiring — partially implemented but not part of this effort
- Save/load system — future feature work

## Context

- Codebase is ~5,895 lines of vanilla JavaScript (ES6 modules), 18 files in `js/`
- No build step, no package manager, no external dependencies
- Runs in browser via Docker + nginx static file serving
- Existing detailed analysis in `.planning/codebase/CONCERNS.md`
- Separate combat development roadmap exists at `mdplans/current/` (not GSD-managed)
- Game is functional — all changes must preserve existing behavior

## Constraints

- **No behavior changes**: Refactoring only — game must play identically before and after each change
- **Vanilla JS**: No framework, bundler, or dependency additions
- **Tab-4 indentation**: Match existing code style (double quotes, semicolons, PascalCase files)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on code quality over features | Codebase growing harder to maintain; invest now to unblock future work | — Pending |
| No test infrastructure in scope | Keep focused on refactoring; tests are a separate milestone | — Pending |
| Preserve all existing behavior | Refactoring must be safe; no functional changes | — Pending |

---
*Last updated: 2026-02-15 after initialization*
