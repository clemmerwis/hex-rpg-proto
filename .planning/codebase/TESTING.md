# Testing Patterns

**Analysis Date:** 2026-01-12

## Test Framework

**Runner:**
- None configured
- No Jest, Vitest, Mocha, or other test framework

**Assertion Library:**
- Not applicable

**Run Commands:**
```bash
# No test commands available
# Tests would need to be added
```

## Test File Organization

**Location:**
- No test files exist
- Suggested pattern: `js/*.test.js` (co-located with source)

**Naming:**
- Not applicable (no tests)
- Suggested: `{ModuleName}.test.js`

**Structure:**
```
js/
  Game.js
  Game.test.js        # Would go here
  Pathfinding.js
  Pathfinding.test.js # Would go here
```

## Test Structure

**Suite Organization:**
- Not applicable (no tests)

**Suggested Pattern:**
```javascript
// Using Vitest (recommended for ES modules)
import { describe, it, expect } from 'vitest';
import { HexGrid } from './HexGrid.js';

describe('HexGrid', () => {
  describe('hexDistance', () => {
    it('should return 0 for same hex', () => {
      const grid = new HexGrid();
      expect(grid.hexDistance({q: 0, r: 0}, {q: 0, r: 0})).toBe(0);
    });

    it('should return 1 for adjacent hexes', () => {
      const grid = new HexGrid();
      expect(grid.hexDistance({q: 0, r: 0}, {q: 1, r: 0})).toBe(1);
    });
  });
});
```

## Mocking

**Framework:**
- Not applicable

**What Would Need Mocking:**
- Canvas 2D context (for Renderer tests)
- DOM elements (for InputHandler tests)
- Fetch API (for AreaManager tests)
- RequestAnimationFrame (for game loop tests)

## Fixtures and Factories

**Test Data:**
- Not applicable

**Suggested Approach:**
```javascript
// Factory for test characters
function createTestCharacter(overrides = {}) {
  return {
    hexQ: 0,
    hexR: 0,
    pixelX: 0,
    pixelY: 0,
    stats: { str: 5, dex: 5, con: 5, ... },
    health: 100,
    maxHealth: 100,
    ...overrides
  };
}

// Factory for test areas
function createTestArea(overrides = {}) {
  return {
    id: 'test_area',
    name: 'Test Area',
    width: 1920,
    height: 1080,
    blocked: [],
    spawnPoints: [{ id: 'default', q: 0, r: 0 }],
    ...overrides
  };
}
```

## Coverage

**Requirements:**
- None (no tests exist)

**Priority Areas for Coverage:**
1. `Pathfinding.js` - A* algorithm correctness
2. `CombatSystem.js` - Damage calculations, hit/miss logic
3. `HexGrid.js` - Coordinate conversions
4. `GameStateManager.js` - State transitions
5. Combat formula functions in `const.js`

## Test Types

**Unit Tests:**
- Not implemented
- Candidates: HexGrid, Pathfinding, combat formulas in const.js

**Integration Tests:**
- Not implemented
- Candidates: Combat flow (GameStateManager + CombatSystem + MovementSystem)

**E2E Tests:**
- Not implemented
- Would require Playwright or similar for Canvas testing

## Common Patterns

**Async Testing:**
- AreaManager.loadArea() returns Promise
- AssetManager.loadAllSprites() returns Promise

```javascript
// Example async test pattern
it('should load area definition', async () => {
  const area = await areaManager.loadArea('test_area', 'spawn1');
  expect(area.id).toBe('test_area');
});
```

**Error Testing:**
```javascript
it('should throw on missing area', async () => {
  await expect(areaManager.loadArea('nonexistent'))
    .rejects.toThrow('Failed to load area');
});
```

**Canvas Testing:**
- Would require mocking canvas context
- Consider visual regression testing for renderer

## Manual Testing

**Current Approach:**
- Manual browser testing
- Debug overlay with camera position, animation info
- Console logging for state transitions
- Hex marker mode for validating blocked hexes

**Debug Features:**
- Show grid checkbox
- Hex marker export to clipboard
- Combat log UI
- Console debug output

**How to Test Manually:**
```bash
# Start dev server
docker compose -p hex-rpg up

# Open http://localhost:8080
# Use browser DevTools console
# Check debug overlay for state info
```

## Recommended Test Setup

If adding tests, suggest:

**1. Install Vitest:**
```json
// package.json (would need to create)
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "jsdom": "^24.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

**2. Configure Vitest:**
```javascript
// vitest.config.js
export default {
  test: {
    environment: 'jsdom',
    globals: true
  }
}
```

**3. Priority Test Files:**
- `js/HexGrid.test.js` - Coordinate math
- `js/Pathfinding.test.js` - A* algorithm
- `js/const.test.js` - Combat formulas
- `js/CombatSystem.test.js` - Attack resolution

---

*Testing analysis: 2026-01-12*
*Update when test patterns change*
