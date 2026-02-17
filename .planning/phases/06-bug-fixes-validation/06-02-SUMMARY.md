---
phase: 06-bug-fixes-validation
plan: 02
subsystem: area-loading
tags: [vanilla-js, validation, area-manager, schema]

# Dependency graph
requires:
  - phase: 01-constants-utilities plan 01
    provides: Centralized constants
provides:
  - Area.json schema validation at load time
  - Descriptive error messages for required field failures
  - Warning messages for optional field issues
affects: [06-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [schema-validation, fail-fast-on-load]

key-files:
  created: []
  modified: [js/AreaManager.js]

key-decisions:
  - "Throw on required fields, warn on optional — invalid areas never cached but optional issues don't block loading"

patterns-established:
  - "Area schema validation: required fields throw, optional fields warn with areaId + field index for debugging"

issues-created: []
duration: 3min
completed: 2026-02-17
---

# Phase 6 Plan 2: Add area.json Schema Validation in AreaManager

**Added schema validation to area.json loading with descriptive error messages for required and optional fields**

## Performance

- **Duration:** 3min
- **Tasks:** 2 auto (combined into 1 commit — same file)
- **Files modified:** 1

## Accomplishments

- Created `validateAreaDefinition(areaDef, areaId)` method with required field validation (id, name, background, width, height) and optional field validation (blocked, spawns, npcs, exits)
- Required field failures throw descriptive errors with area ID, field name, and expected type
- Optional field issues logged as warnings with area ID and array index
- Validation runs before caching — invalid area definitions are never stored
- Added null/non-object guard for empty or malformed JSON responses
- Improved NPC template warnings to include area ID and index for easier debugging

## Task Commits

1. **Tasks 1+2: Schema validation + integration** - `933eca4` (feat)

## Files Created/Modified

- `js/AreaManager.js` - Added validateAreaDefinition() method, integrated into loadAreaDefinition(), improved NPC template warnings

## Decisions Made

None — followed plan as specified.

## Deviations from Plan

Combined Task 1 and Task 2 into a single commit since both modify the same file and are tightly coupled.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 06-03-PLAN.md (DI validation and consistent error handling).

---
*Phase: 06-bug-fixes-validation*
*Completed: 2026-02-17*
