# Codebase Concerns

**Analysis Date:** 2026-02-15

## Tech Debt

**Large monolithic files:**
- Issue: Several files exceed 600 lines with too many responsibilities
- Files: `js/CharacterCreation.js` (767), `js/GameStateManager.js` (722), `js/Renderer.js` (663), `js/const.js` (643), `js/CombatUILog.js` (453)
- Impact: Hard to navigate, multiple reasons to change
- Fix approach: Existing refactoring plan at `mdplans/current/combatsystem-refactoring-plan.md`; similar plans needed for GameStateManager and Renderer

**CombatSystem.executeAttack() monolith:**
- Issue: Single method handles 18+ responsibilities in ~200 lines
- File: `js/CombatSystem.js` lines 19-220
- Impact: Hard to test, modify, or understand damage pipeline
- Fix approach: Detailed 6-batch refactoring plan exists at `mdplans/current/combatsystem-refactoring-plan.md`

**Manual dependency injection wiring:**
- Issue: `Game.js` manually creates all modules and injects dependencies with no validation
- File: `js/Game.js` lines 105-245
- Impact: Easy to forget a dependency; no error if one is missing until runtime
- Fix approach: Add validation in setDependencies() methods or use a container pattern

**Configuration partially scattered:**
- Issue: Most constants in `const.js` but some hardcoded elsewhere
- Files: `js/CombatUILog.js` lines 7-35 (tag definitions), `js/Game.js` lines 20-31 (canvas config)
- Impact: Have to search multiple files when tuning values
- Fix approach: Move remaining magic numbers to `const.js`

## Known Bugs

**Race condition in movement callbacks:**
- Symptoms: Multiple movements completing same frame may fire callbacks out of order
- Trigger: Fast combat execution with multiple characters moving simultaneously
- File: `js/MovementSystem.js` lines 110-117 (setTimeout 0 for async callback)
- Root cause: setTimeout(0) doesn't guarantee execution order
- Workaround: Self-heals because each callback is independent

**Area transitions not wired up:**
- Symptoms: `AreaManager.transition()` and `getExitAt()` exist but nothing calls them
- Trigger: Player stepping on exit hexes does nothing
- File: `js/AreaManager.js` lines 217-247 (transition/exit methods exist)
- Root cause: Feature partially implemented - no InputHandler or Game.js code triggers transitions

## Security Considerations

**No significant security concerns** - Single-player offline game with no auth, no user data, no external APIs.

## Performance Bottlenecks

**Hex visibility recalculated every frame:**
- Problem: Nested loop calculates visible hexes each render frame
- File: `js/Renderer.js` lines 155-169
- Cause: No caching; recalculates even when camera hasn't moved
- Improvement: Cache visible hexes and invalidate only on camera pan

**Flood-fill on blocked hex hover:**
- Problem: Flood-fill algorithm runs when hovering blocked hexes
- File: `js/Renderer.js` lines 57-81
- Cause: Connected region computed per-hover (cached per hex key, but expensive initial computation)
- Improvement: Pre-compute connected regions on area load

**Pathfinding not cached:**
- Problem: A* recomputed every time a character moves, even for identical paths
- File: `js/Pathfinding.js` lines 13-62
- Improvement: Memoize recent results, invalidate when obstacles change

**AI distance calculations repeated:**
- Problem: `findNearestSameFaction()` iterates all characters and calculates distance
- File: `js/AISystem.js` lines 131-147
- Improvement: Build distance matrix once per turn

## Fragile Areas

**Attack animation timing hardcoded:**
- Why fragile: Three hardcoded timeouts in combat execution must match sprite frame counts
- File: `js/GameStateManager.js` lines 322-359
- Common failures: If animation frame counts change, timings desync
- Safe modification: Should derive timing from actual animation frameCount

**Engagement tracking split across files:**
- Why fragile: Two code paths manage engagements independently
- Files: `js/GameStateManager.js` lines 438-449 (tryEstablishEngagement), `js/CombatSystem.js` line 126 (canEngageBack)
- Common failures: One updated without the other leads to inconsistency
- Safe modification: Should be single canonical source

**Blocked hex string key convention:**
- Why fragile: Hexes stored as strings `${q},${r}` for Set lookups
- File: `js/Pathfinding.js` line 21 and throughout
- Common failures: Any code storing hex differently silently fails lookups
- Safe modification: Use a shared hex key function

## Missing Critical Features

**No area JSON schema validation:**
- Problem: `area.json` files parsed without validation
- File: `js/AreaManager.js` lines 48-52
- Current workaround: Errors surface downstream when accessing undefined properties
- Blocks: Adding new areas is error-prone

**No game save/load:**
- Problem: All state lost on page refresh
- Current workaround: None - game restarts from initial state
- Impact: Expected for prototype but limits playtesting longer sessions

**No error recovery for asset loading:**
- Problem: If any sprite fails to load, game halts entirely
- File: `js/Game.js` lines 248-283
- Blocks: No partial recovery or retry mechanism

## Test Coverage Gaps

**Zero automated test coverage:**
- What's not tested: Everything - no test infrastructure exists
- Risk: Formula changes, refactoring, or new features could silently break combat math
- Priority: Medium (pure calculation functions in `const.js` and `HexGrid.js` are best candidates)
- Difficulty: Low for pure functions; medium for systems requiring mocks

---

*Concerns audit: 2026-02-15*
*Update as issues are fixed or new ones discovered*
