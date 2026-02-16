# Roadmap: Hex RPG Proto — Codebase Health

## Overview

A systematic code quality pass transforming the hex-grid RPG prototype from a working-but-messy state into a well-structured, maintainable codebase. Starting with foundational cleanup (constants, utilities), progressing through major file decompositions (CombatSystem, GameStateManager, Renderer), then smaller file splits, bug fixes, and finally performance optimizations.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Constants & Utilities** - Consolidate magic numbers and create shared utility functions
- [ ] **Phase 2: CombatSystem Pipeline** - Decompose executeAttack() into discrete pipeline stages
- [ ] **Phase 3: GameStateManager Split** - Break up monolithic GSM into focused modules
- [ ] **Phase 4: Renderer Refactor** - Split Renderer and add visibility/flood-fill caching
- [ ] **Phase 5: Supporting File Splits** - Split CombatUILog and InputHandler
- [ ] **Phase 6: Bug Fixes & Validation** - Fix race condition, add validation, improve error handling
- [ ] **Phase 7: Performance Optimization** - Cache pathfinding and memoize AI calculations

## Phase Details

### Phase 1: Constants & Utilities
**Goal**: All magic numbers consolidated in const.js; shared hex key function eliminates string convention fragility
**Depends on**: Nothing (first phase)
**Research**: Unlikely (internal cleanup, established patterns)
**Plans**: 2 plans (4 tasks)

Plans:
- [x] 01-01: Move COMBAT_TAGS/WRAPPER_TAGS and viewport dimensions to const.js (2 tasks)
- [x] 01-02: Create hexKey() utility, replace ad-hoc `${q},${r}` across 5 files (2 tasks)

### Phase 2: CombatSystem Pipeline
**Goal**: executeAttack() decomposed from ~200-line monolith into discrete, testable pipeline stages
**Depends on**: Phase 1
**Research**: Unlikely (existing refactoring plan at mdplans/current/combatsystem-refactoring-plan.md)
**Plans**: 3 plans (6 tasks)

Plans:
- [x] 02-01: Extract pure calculation helpers (hit roll, resistance, flanking/DR, crit) (2 tasks)
- [x] 02-02: Extract presentation helpers (attack name, damage breakdown, combat log, buffer log) (2 tasks)
- [ ] 02-03: Extract result handlers and rewrite orchestrator (2 tasks)

### Phase 3: GameStateManager Split
**Goal**: 722-line GameStateManager broken into focused modules; engagement tracking consolidated; animation timing derived from frameCount
**Depends on**: Phase 2
**Research**: Unlikely (internal refactoring)
**Plans**: TBD

Plans:
- [ ] 03-01: Extract combat execution logic into dedicated module
- [ ] 03-02: Extract state transition logic and consolidate engagement tracking
- [ ] 03-03: Derive animation timing from frameCount instead of hardcoded values

### Phase 4: Renderer Refactor
**Goal**: 663-line Renderer split into focused modules; hex visibility cached; flood-fill regions pre-computed on area load
**Depends on**: Phase 1
**Research**: Unlikely (internal refactoring, standard caching patterns)
**Plans**: TBD

Plans:
- [ ] 04-01: Extract hex grid rendering into dedicated module
- [ ] 04-02: Extract UI overlay rendering
- [ ] 04-03: Add hex visibility caching and pre-compute flood-fill regions

### Phase 5: Supporting File Splits
**Goal**: CombatUILog (453 lines) and InputHandler (419 lines) split into focused, single-responsibility modules
**Depends on**: Phase 1
**Research**: Unlikely (internal refactoring)
**Plans**: TBD

Plans:
- [ ] 05-01: Split CombatUILog into log engine and formatting/tag system
- [ ] 05-02: Split InputHandler into exploration input and combat input handlers

### Phase 6: Bug Fixes & Validation
**Goal**: Race condition fixed, area.json validated on load, consistent error handling, DI wiring validated
**Depends on**: Phase 3
**Research**: Unlikely (internal bug fixes, standard validation patterns)
**Plans**: TBD

Plans:
- [ ] 06-01: Fix MovementSystem setTimeout race condition
- [ ] 06-02: Add area.json schema validation in AreaManager
- [ ] 06-03: Add DI validation and consistent error handling strategy

### Phase 7: Performance Optimization
**Goal**: Pathfinding results cached with invalidation; AI distance calculations memoized per turn
**Depends on**: Phase 4
**Research**: Unlikely (standard memoization/caching patterns)
**Plans**: TBD

Plans:
- [ ] 07-01: Cache pathfinding results with obstacle-change invalidation
- [ ] 07-02: Memoize AI distance calculations per turn

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Constants & Utilities | 2/2 | Complete | 2026-02-16 |
| 2. CombatSystem Pipeline | 2/3 | In Progress | - |
| 3. GameStateManager Split | 0/3 | Not started | - |
| 4. Renderer Refactor | 0/3 | Not started | - |
| 5. Supporting File Splits | 0/2 | Not started | - |
| 6. Bug Fixes & Validation | 0/3 | Not started | - |
| 7. Performance Optimization | 0/2 | Not started | - |
