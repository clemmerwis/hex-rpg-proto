# Testing Patterns

**Analysis Date:** 2026-02-15

## Test Framework

**No automated testing infrastructure exists.**

- No test framework installed (no Jest, Vitest, Mocha, etc.)
- No test files (*.test.js, *.spec.js) in codebase
- No `__tests__/` directories
- No package.json (so no test scripts)
- No CI pipeline to run tests

## Current Testing Approach

**Manual browser testing:**

1. Run Docker container: `docker compose up`
2. Open http://localhost:8080 in browser
3. Refresh browser after code changes
4. Check browser console for runtime errors
5. Use built-in Logger system for debug output
6. Use `window.game` console access for state inspection

**Debug features available:**
- Logger with DEBUG/INFO/COMBAT/WARNING/ERROR levels
- Hex marker mode for map editing (InputHandler)
- Debug rendering toggles for hex grid, blocked hexes, pathfinding
- `window.game` exposed for console debugging
- `window.characterCreator` exposed for character creation debugging

## Test Coverage

**No coverage tracking** - No automated tests to measure coverage for.

**Critical untested areas:**
- Combat damage calculation formulas (`js/CombatSystem.js`)
- Pathfinding algorithm correctness (`js/Pathfinding.js`)
- State machine transitions (`js/GameStateManager.js`)
- Character stat calculations (`js/const.js`)
- Hex coordinate math (`js/HexGrid.js`)

## Future Testing Considerations

**Good candidates for unit testing (pure functions):**
- `js/const.js`: `calculateMaxHP()`, `calculateDamage()`, `calculateAttackRating()`, `calculateCSC()`
- `js/HexGrid.js`: `hexToPixel()`, `pixelToHex()`, `hexDistance()`, `getNeighbors()`
- `js/Pathfinding.js`: `findPath()`

**Would require mocking:**
- `js/CombatSystem.js`: Depends on hexGrid, getCharacterAtHex, gameStateManager
- `js/AISystem.js`: Depends on hexGrid, pathfinding, gameStateManager
- `js/MovementSystem.js`: Depends on hexGrid, game loop timing

**Integration test candidates:**
- Full combat turn cycle (input -> execution -> resolution)
- Area loading and NPC instantiation
- Character movement along pathfinding routes

---

*Testing analysis: 2026-02-15*
*Update when test patterns change*
