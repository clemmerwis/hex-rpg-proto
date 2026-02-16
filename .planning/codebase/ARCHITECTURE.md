# Architecture

**Analysis Date:** 2026-02-15

## Pattern Overview

**Overall:** Modular ES6 Browser Game with Dependency Injection

**Key Characteristics:**
- Single-page browser application (canvas-based game)
- ES6 module system with no circular imports
- Dependency injection via `setDependencies()` pattern
- State machine for game mode management
- Callback-based inter-module communication
- All modules instantiated and wired in central orchestrator

## Layers

**Presentation Layer:**
- Purpose: Canvas rendering, DOM UI management, combat log display
- Contains: `js/Renderer.js` (663 lines), `js/UIManager.js` (160 lines), `js/CombatUILog.js` (453 lines)
- Depends on: Game Logic layer for state, HexGrid for coordinate conversion
- Used by: Game loop (called every frame)

**Game Logic & State Layer:**
- Purpose: State machine, combat resolution, game orchestration
- Contains: `js/GameStateManager.js` (722 lines), `js/CombatSystem.js` (300 lines), `js/Game.js` (409 lines)
- Depends on: Character layer, World layer, Configuration layer
- Used by: Input layer (user actions), Presentation layer (state queries)

**Character & Movement Layer:**
- Purpose: Character creation, movement interpolation, AI decision-making
- Contains: `js/MovementSystem.js` (245 lines), `js/CharacterFactory.js` (95 lines), `js/AISystem.js` (250 lines)
- Depends on: World layer (pathfinding, hex grid), Configuration layer
- Used by: Game Logic layer

**Input & Interaction Layer:**
- Purpose: Mouse/keyboard input processing, edge scrolling, hex selection
- Contains: `js/InputHandler.js` (419 lines)
- Depends on: HexGrid for coordinate conversion
- Used by: Game Logic layer (via callbacks)

**World & Navigation Layer:**
- Purpose: Hex coordinate math, pathfinding, area loading
- Contains: `js/HexGrid.js` (70 lines), `js/Pathfinding.js` (139 lines), `js/AreaManager.js` (284 lines)
- Depends on: Configuration layer only (HexGrid has zero dependencies)
- Used by: All other layers

**Assets & Configuration Layer:**
- Purpose: Sprite loading, centralized constants, structured logging
- Contains: `js/AssetManager.js` (126 lines), `js/const.js` (643 lines), `js/Logger.js` (141 lines)
- Depends on: Nothing (foundation layer)
- Used by: All other layers

## Data Flow

**Game Loop (requestAnimationFrame):**

1. Calculate delta time (capped to MAX_DELTA_TIME 100ms)
2. `MovementSystem.updateMovement(deltaTime)` - interpolate character positions
3. `MovementSystem.updateAnimations(deltaTime)` - advance sprite frames
4. `InputHandler.updateKeyboardScrolling()` - camera movement
5. `CombatUILog.update()` - combat log UI (if in combat)
6. `Game.render()` - draw everything to canvas

**Combat Turn Cycle:**

1. EXPLORATION -> COMBAT_INPUT (Shift+Space toggle)
2. Player selects move target or attack target
3. AI characters calculate actions via `AISystem.getAIAction()`
4. All inputs collected -> COMBAT_EXECUTION
5. Move phase: characters move in speed order
6. Action phase: characters attack in speed order
7. Return to COMBAT_INPUT (next turn)

**State Management:**
- `Game.state` holds characters (pc + npcs), assets, area reference
- `GameStateManager` owns combat state (turn number, character actions, execution queues)
- Characters are plain objects with dual position (hex coords + pixel coords)
- No centralized store - state distributed across module instances

## Key Abstractions

**State Machine (GameStateManager):**
- Purpose: Manage EXPLORATION / COMBAT_INPUT / COMBAT_EXECUTION transitions
- Location: `js/GameStateManager.js`
- Pattern: Finite state machine with sub-phases (move, action) in execution

**Dependency Injection:**
- Purpose: Prevent circular imports between modules
- Pattern: `Game.js` creates all modules, then calls `setDependencies()` on each
- Examples: `Renderer.setDependencies({...})`, `InputHandler.setDependencies({...})`

**Character Factory:**
- Purpose: Fully initialize character objects with no null/undefined state
- Location: `js/CharacterFactory.js`
- Pattern: Factory function returning plain objects with all Maps/Sets pre-allocated

**Movement Queue:**
- Purpose: Smooth interpolated movement along hex waypoints
- Location: `js/MovementSystem.js`
- Pattern: Queue-based with per-frame interpolation and completion callbacks

**Area Repository:**
- Purpose: Load area definitions and instantiate NPCs
- Location: `js/AreaManager.js`
- Pattern: Repository with future API migration path documented

## Entry Points

**Main Game:**
- Location: `rpg.html` -> imports `js/Game.js`
- Triggers: Browser page load
- Responsibilities: Instantiate Game, call `game.init()`, expose `window.game` for debugging

**Character Creation:**
- Location: `character-creation.html` -> imports `js/CharacterCreation.js`
- Triggers: Browser page load
- Responsibilities: Character stat allocation, equipment selection, localStorage persistence

## Error Handling

**Strategy:** Try-catch at initialization boundaries, defensive null checks throughout

**Patterns:**
- `Game.init()` wraps async initialization in try-catch, renders error to canvas on failure
- `AreaManager.loadAreaDefinition()` catches JSON fetch failures
- `AssetManager.loadSprite()` handles image load errors
- Guard clauses with early returns throughout (especially in GameStateManager)
- Movement callbacks wrapped in try-catch with `setTimeout(0)` for async safety

## Cross-Cutting Concerns

**Logging:**
- Custom `js/Logger.js` with dual output (console + in-game)
- Levels: DEBUG, INFO, COMBAT, WARNING, ERROR
- Combat log uses semantic tags (`{{char:name}}`, `{{hit}}`, `{{dmg}}`) for rich formatting
- Injected into CombatSystem, GameStateManager, AISystem

**Configuration:**
- `js/const.js` centralizes all game constants, weapon/armor data, NPC templates, stat formulas
- Per CLAUDE.md: new configurable values must go in const.js, not hardcoded

**Delta Time:**
- Capped to 100ms to handle tab backgrounding gracefully
- Applied to movement interpolation and animation frame advancement

---

*Architecture analysis: 2026-02-15*
*Update when major patterns change*
