# Coding Conventions

**Analysis Date:** 2026-02-15

## Naming Patterns

**Files:**
- PascalCase for module files (`Game.js`, `HexGrid.js`, `GameStateManager.js`)
- camelCase for config/utility (`const.js`, `utils.js`)
- One class per file, filename matches class name

**Functions:**
- camelCase for all functions and methods (`calculateMaxHP()`, `hexToPixel()`, `executeAttack()`)
- No special prefix for async functions
- Descriptive verb-noun names (`findPath()`, `getNeighbors()`, `sortBySpeed()`)

**Variables:**
- camelCase for variables and properties (`hexQ`, `pixelX`, `currentAnimation`, `isMoving`)
- UPPER_SNAKE_CASE for constants (`GAME_CONSTANTS`, `GAME_STATES`, `HEX_SIZE`, `WEAPONS`)

**Types/Classes:**
- PascalCase for class names (`Game`, `Renderer`, `HexGrid`, `CombatSystem`)
- No TypeScript - plain JavaScript classes

## Code Style

**Formatting:**
- Tab indentation (size 4) - consistent across all files
- No Prettier or auto-formatter configured
- No enforced line length (some long lines exist)

**Quotes:**
- Double quotes for strings throughout (`"./HexGrid.js"`, `"exploration"`, `"move"`)
- Single quotes NOT used

**Semicolons:**
- Always present on all statements

**Linting:**
- No ESLint or other linter configured

## Import Organization

**Order:**
1. `const.js` imports (configuration, formulas, data)
2. Other game system imports (by dependency order)

**Style:**
- Named exports only: `export class ClassName {}`, `export function name() {}`, `export const CONST = {}`
- No default exports (exception: `CharacterCreation.js` exports instance)
- Relative paths with `./` prefix required
- `.js` extension always included in import paths

## Error Handling

**Patterns:**
- Try-catch at initialization boundaries (`Game.init()`)
- Guard clauses with early returns throughout
- Defensive null checks for optional properties
- Movement callbacks wrapped in try-catch

**Error Types:**
- Thrown errors for critical failures (asset loading, area loading)
- Console warnings for non-critical issues (missing NPC templates)
- Silent returns for expected edge cases (empty hex attacks)

## Logging

**Framework:**
- Custom `js/Logger.js` with dual output (console + in-game UI)
- Levels: DEBUG, INFO, COMBAT, WARNING, ERROR

**Patterns:**
- `logger.combat()` for combat events with semantic tags
- `logger.debug()` for system internals (AI decisions, buffer states)
- `logger.warn()` for warnings (friendly fire, missing data)
- Semantic tag system: `{{char:name}}`, `{{hit}}`, `{{dmg}}`, `{{miss}}`, etc.

## Comments

**When to Comment:**
- JSDoc blocks for public methods with `@param` and `@returns`
- Inline comments explaining "why" for non-obvious logic
- Formula documentation (THC, CSC, damage pipeline)
- Future architecture notes ("Future: NPC templates fetched from backend API")

**Style:**
- `/** ... */` for method documentation
- `//` for inline explanations
- No TODO/FIXME convention (none currently in codebase)

## Function Design

**Size:**
- No strict limit, but some functions are very large (executeAttack: ~200 lines)
- Refactoring plan exists for largest functions (`mdplans/current/combatsystem-refactoring-plan.md`)

**Parameters:**
- Default parameters used (`attackType = 'light'`, `actionsMap = null`)
- Guard clauses and early returns preferred
- Arrow functions for callbacks to preserve `this` context

**Async:**
- async/await for initialization (`Game.init()`, `AreaManager.loadArea()`)
- Callbacks for inter-module communication (`onMovementComplete`, `onStateChange`)

## Module Design

**Exports:**
- Named exports only (classes, constants, functions)
- One primary class per module file

**Dependency Injection:**
- No direct imports between game systems
- All dependencies injected via `setDependencies()` methods
- `Game.js` is the central wiring hub
- Prevents circular dependencies

**Initialization:**
- Modules created in `Game.js` constructor
- Dependencies injected after all modules created
- `init()` methods for async setup (asset loading, area loading)

---

*Convention analysis: 2026-02-15*
*Update when patterns change*
