# Codebase Concerns

**Analysis Date:** 2026-01-12

## Tech Debt

**Large file sizes:**
- Issue: `js/GameStateManager.js` (705 lines) handles state machine, AI triggers, engagement, and combat phases
- Why: Organic growth during prototype development
- Impact: Hard to navigate, maintain, and test
- Fix approach: Split into state machine core, combat orchestrator, and engagement system

**Large file sizes (continued):**
- Issue: `js/Renderer.js` (634 lines) handles grid, characters, UI, faction borders
- Why: All rendering consolidated in one place
- Impact: Difficult to modify one rendering aspect without reading entire file
- Fix approach: Extract HexGridRenderer, CharacterRenderer, UIOverlayRenderer

**Console logging in production code:**
- Issue: Multiple `console.log()` calls scattered throughout
- Files: `js/AreaManager.js`, `js/MovementSystem.js`, `js/InputHandler.js`, `js/CombatUILog.js`
- Why: Development debugging left in place
- Impact: Console pollution, inconsistent with Logger system
- Fix approach: Replace with Logger calls or remove entirely

## Known Bugs

**No confirmed bugs detected**
- Codebase appears stable for prototype purposes
- Potential race condition noted below (not confirmed as bug)

## Security Considerations

**Minimal security surface:**
- Risk: Low - single-player local game with no persistence
- Current mitigation: No user input stored, no backend
- Recommendations: If adding backend, validate all JSON schemas

**JSON loading without validation:**
- Risk: Area JSON files loaded and used without schema validation
- Files: `js/AreaManager.js` (line 48 fetch)
- Current mitigation: Trusted local files only
- Recommendations: Add JSON schema validation if loading from external sources

## Performance Bottlenecks

**Pathfinding algorithm:**
- Problem: `getLowestFScore()` iterates entire openSet linearly
- File: `js/Pathfinding.js` (lines 65-79)
- Measurement: Not profiled, but O(n) per iteration
- Cause: Array scan instead of heap data structure
- Improvement path: Use binary heap for O(log n) extraction

**Blocked hex flood-fill:**
- Problem: `getConnectedBlockedHexes()` recomputes flood-fill during rendering
- File: `js/Renderer.js` (lines 52-77)
- Measurement: Not profiled, called per blocked hex
- Cause: Cache exists but invalidation logic is subtle
- Improvement path: Pre-compute on area load, invalidate only when blocked hexes change

**Keyboard scrolling overhead:**
- Problem: `updateKeyboardScrolling()` calls callback every frame even when not scrolling
- File: `js/InputHandler.js` (lines 262-277)
- Measurement: Minimal impact but unnecessary work
- Cause: No early exit check for zero scroll values
- Improvement path: Add `if (scrollX === 0 && scrollY === 0) return;` guard

## Fragile Areas

**State machine transitions:**
- File: `js/GameStateManager.js` (entire file)
- Why fragile: Complex interdependencies between combat phases
- Common failures: Incorrect state after interrupted combat
- Safe modification: Trace full state transition paths before changes
- Test coverage: None - high priority for testing

**Combat execution timing:**
- File: `js/CombatSystem.js` (lines 310-342)
- Why fragile: Two-stage setTimeout during attack execution
- Common failures: Character defeat during windup could conflict with attack resolution
- Safe modification: Add defensive checks for character validity at each stage
- Test coverage: None

**Movement callback handling:**
- File: `js/MovementSystem.js` (lines 125-130)
- Why fragile: Callback Map overwrites if same character moves twice
- Common failures: Previous callback lost without warning
- Safe modification: Add warning or queue callbacks per character
- Test coverage: None

## Scaling Limits

**In-memory game state:**
- Current capacity: All characters and state in JS memory
- Limit: Browser memory (~1GB typical)
- Symptoms at limit: Page crash or slowdown
- Scaling path: Not applicable for single-player prototype

**Sprite assets:**
- Current capacity: All sprites loaded into memory
- Limit: ~50-100 sprite sets before memory pressure
- Symptoms at limit: Slow loading, memory warnings
- Scaling path: Lazy loading, sprite atlas, streaming

## Dependencies at Risk

**No external dependencies:**
- All code is vanilla JavaScript
- No npm packages to become outdated
- Risk: Browser API changes (Canvas, ES Modules)
- Mitigation: Target evergreen browsers, avoid experimental APIs

## Missing Critical Features

**Test suite:**
- Problem: Zero test coverage for complex systems
- Current workaround: Manual browser testing
- Blocks: Confident refactoring, regression prevention
- Implementation complexity: Medium (add Vitest, write priority tests)

**Save/Load system:**
- Problem: No game state persistence
- Current workaround: Start fresh each session
- Blocks: Meaningful progression, game sessions
- Implementation complexity: Medium (add localStorage or backend)

**Error recovery:**
- Problem: Asset loading failures can leave game in broken state
- File: `js/Game.js` (lines 248-271 - no try/catch in init)
- Current workaround: Refresh page
- Blocks: Graceful degradation
- Implementation complexity: Low (add error handling and retry logic)

## Test Coverage Gaps

**Pathfinding (High Priority):**
- What's not tested: A* algorithm correctness, edge cases
- File: `js/Pathfinding.js`
- Risk: Path calculation bugs hard to detect visually
- Priority: High
- Difficulty to test: Low - pure algorithm, no DOM

**Combat formulas (High Priority):**
- What's not tested: Damage calculations, hit chance, critical strikes
- File: `js/const.js` (calculateDamage, calculateAttackRating, etc.)
- Risk: Balance issues, incorrect math
- Priority: High
- Difficulty to test: Low - pure functions

**State machine transitions (High Priority):**
- What's not tested: EXPLORATION ↔ COMBAT state flow
- File: `js/GameStateManager.js`
- Risk: Edge cases cause stuck states
- Priority: High
- Difficulty to test: Medium - needs mocked dependencies

**HexGrid coordinate conversions (Medium Priority):**
- What's not tested: hexToPixel, pixelToHex, hexDistance
- File: `js/HexGrid.js`
- Risk: Visual misalignment, pathfinding errors
- Priority: Medium
- Difficulty to test: Low - pure math functions

**Renderer output (Low Priority):**
- What's not tested: Canvas drawing correctness
- File: `js/Renderer.js`
- Risk: Visual bugs
- Priority: Low
- Difficulty to test: High - requires visual regression or canvas mocking

## Code Quality Notes

**Non-seeded randomness:**
- Issue: `Math.random()` used without RNG seeding
- Files: `js/GameStateManager.js` (line 87), `js/CombatSystem.js` (lines 58, 79)
- Impact: Combat encounters not reproducible for testing/balancing
- Fix approach: Implement seeded RNG system

**Optional chaining masking bugs:**
- Issue: Defensive `?.` operators hide initialization failures
- Files: `js/Renderer.js` (lines 62-63), `js/GameStateManager.js` (line 122)
- Impact: Silent failures instead of early detection
- Fix approach: Assert dependencies at initialization

---

*Concerns audit: 2026-01-12*
*Update as issues are fixed or new ones discovered*
