# Coding Conventions

**Analysis Date:** 2026-01-12

## Naming Patterns

**Files:**
- PascalCase.js for class modules (`GameStateManager.js`, `CombatSystem.js`)
- lowercase.js for utility/config (`const.js`, `utils.js`)
- No test files (pattern would be `*.test.js` if added)

**Functions:**
- camelCase for all methods (`executeAttack()`, `updateMovement()`)
- No special prefix for async functions
- Handler pattern: `on{Event}` for callbacks (`onCameraUpdate`, `onShowGridChange`)
- Setup pattern: `setup{Thing}()` for initialization (`setupCanvas()`, `setupCallbacks()`)

**Variables:**
- camelCase for variables (`hexGrid`, `combatSystem`)
- UPPER_SNAKE_CASE for constants (`GAME_STATES`, `MOVEMENT_SPEED`)
- No underscore prefix for private members (uses module scope instead)

**Types:**
- PascalCase for classes (`class Renderer`, `class GameStateManager`)
- No TypeScript, no interfaces defined
- JSDoc comments for parameter documentation

**Hex Coordinates:**
- `q` and `r` for axial hex coordinates
- `hexQ`, `hexR` for character hex position
- `pixelX`, `pixelY` for rendered pixel position

## Code Style

**Formatting:**
- Tab indentation (size 4)
- No Prettier or auto-formatter configured
- Line length: ~100-120 characters typical
- Semicolons required

**Quotes:**
- Single quotes for strings (`'exploration'`)
- Double quotes in JSDoc (`@param {string} name`)
- Template literals for interpolation (`` `Turn ${turnNumber}` ``)

**Braces:**
- K&R style (opening brace on same line)
- Always use braces for control flow (even single-line)

**Linting:**
- No ESLint or linter configured
- Manual code review for consistency

## Import Organization

**Order:**
1. External imports (none - vanilla JS)
2. Relative imports from const.js first
3. Other module imports alphabetically

**Grouping:**
- No blank lines between imports (grouped as single block)
- Destructured imports preferred (`import { GAME_STATES, COMBAT_ACTIONS }`)

**Path Aliases:**
- None - all relative paths (`./GameStateManager.js`)

**Example:**
```javascript
import { GAME_CONSTANTS, FACTIONS, getAnimationConfig } from "./const.js";
import { GAME_STATES, COMBAT_ACTIONS } from "./GameStateManager.js";
import { HexGrid } from './HexGrid.js';
```

## Error Handling

**Patterns:**
- Try/catch at callback execution points
- Console.error for logging (no external error tracking)
- Graceful fallbacks where possible (e.g., placeholder sprites)

**Error Types:**
- Throw on critical failures (area loading, missing required elements)
- Log and continue for non-critical (sprite loading, callback errors)
- No custom error classes

**Example:**
```javascript
try {
    callback();
} catch (error) {
    console.error('MovementSystem: Callback error', error);
}
```

## Logging

**Framework:**
- Custom `Logger.js` class with levels
- Console.log/console.error for development
- `CombatUILog.js` for in-game combat events

**Patterns:**
- Prefix logs with component: `[CombatUILog] Initializing...`
- Structured combat events with semantic tokens (`{{hit}}`, `{{miss}}`)

**When to Log:**
- Initialization completion
- State transitions
- Combat events (attacks, damage, defeats)
- Errors and warnings

## Comments

**When to Comment:**
- JSDoc for public methods with @param/@returns
- Inline comments for complex algorithms
- TODO comments for planned improvements

**JSDoc/TSDoc:**
- Used for public API documentation
- @param tags with types in braces
- No @returns for void functions

**Example:**
```javascript
/**
 * Setup drag and drop functionality (header as drag handle)
 */
setupDragAndDrop() {
```

**TODO Comments:**
- Format: `// TODO: description` or `// Future: description`
- No linked issues (no issue tracker)

## Function Design

**Size:**
- Functions typically 10-50 lines
- Complex methods extracted to helper functions
- Large files split into logical sections

**Parameters:**
- Max ~4 parameters typical
- Options objects not used (inline parameters)
- Destructuring in function bodies, not signatures

**Return Values:**
- Explicit returns
- Return early for guard clauses
- Array/object returns for complex data

## Module Design

**Exports:**
- Named exports for all public symbols
- One class per file (plus related constants)
- No default exports

**Pattern:**
```javascript
export class GameStateManager {
    // ...
}
export const GAME_STATES = {
    EXPLORATION: 'EXPLORATION',
    // ...
};
```

**Dependency Injection:**
- Constructor injection for required dependencies
- `setDependencies()` method for post-construction injection
- Prevents circular imports

**Example:**
```javascript
class MovementSystem {
    constructor() {
        this.hexGrid = null;
        this.pathfinding = null;
    }

    setDependencies({ hexGrid, pathfinding }) {
        this.hexGrid = hexGrid;
        this.pathfinding = pathfinding;
    }
}
```

---

*Convention analysis: 2026-01-12*
*Update when patterns change*
