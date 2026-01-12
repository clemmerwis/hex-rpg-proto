# Architecture

**Analysis Date:** 2026-01-12

## Pattern Overview

**Overall:** Monolithic Single-Page Application with Modular System Architecture

**Key Characteristics:**
- Vanilla JavaScript ES6 modules with dependency injection
- Canvas-based 2D rendering (no framework)
- Explicit state machine for game states (EXPLORATION, COMBAT_INPUT, COMBAT_EXECUTION)
- Layered architecture with clear separation of concerns

## Layers

**Presentation Layer:**
- Purpose: Render game world and handle UI updates
- Contains: `js/Renderer.js`, `js/UIManager.js`, `js/CombatUILog.js`
- Depends on: Game state (read-only), HexGrid for coordinate conversions
- Used by: Game loop for frame rendering

**Input/Control Layer:**
- Purpose: Process user input and translate to game actions
- Contains: `js/InputHandler.js`
- Depends on: GameStateManager for action validation
- Used by: Browser event system, Game.js

**Game State Layer:**
- Purpose: Manage state transitions, turn order, combat phases
- Contains: `js/GameStateManager.js`
- Depends on: All gameplay systems
- Used by: InputHandler, Game loop

**Gameplay Systems Layer:**
- Purpose: Core game mechanics and logic
- Contains:
  - `js/MovementSystem.js` - Character movement interpolation
  - `js/CombatSystem.js` - Attack resolution, damage calculation
  - `js/AISystem.js` - Enemy decision making
  - `js/Pathfinding.js` - A* hex grid pathfinding
  - `js/AreaManager.js` - Map loading, blocked hex management
- Depends on: HexGrid, configuration from const.js
- Used by: GameStateManager, InputHandler

**Utility & Data Layer:**
- Purpose: Shared utilities and configuration
- Contains:
  - `js/const.js` - All game constants, formulas, sprite configs
  - `js/CharacterFactory.js` - Character object creation
  - `js/Logger.js` - Structured logging system
  - `js/utils.js` - Helper functions
- Depends on: Nothing (pure utilities)
- Used by: All other layers

**Core Grid & Asset Layer:**
- Purpose: Fundamental abstractions
- Contains:
  - `js/HexGrid.js` - Axial hex coordinate system
  - `js/AssetManager.js` - Sprite/image loading
- Depends on: Nothing
- Used by: All systems needing hex math or assets

## Data Flow

**Exploration Mode (Click to Move):**

1. User clicks on canvas (`InputHandler.js`)
2. Click converted to hex coordinates (`HexGrid.hexToPixel()`)
3. Pathfinding calculates route (`Pathfinding.findPath()`)
4. Waypoints queued in character (`character.movementQueue`)
5. MovementSystem interpolates position each frame
6. Renderer draws character at interpolated position

**Combat Mode (Turn-Based):**

1. Player triggers combat (Shift+Space) → `GameStateManager.enterCombat()`
2. **COMBAT_INPUT Phase:**
   - Player selects adjacent hex → `GameStateManager.selectPlayerMoveTarget()`
   - AI calculates moves → `AISystem.getAIAction()`
   - All actions queued in `characterActions` Map
3. **COMBAT_EXECUTION Phase:**
   - Characters sorted by speed → `GameStateManager.sortBySpeed()`
   - Move phase: Sequential movement via `MovementSystem`
   - Action phase: Sequential attacks via `CombatSystem.executeAttack()`
4. Return to COMBAT_INPUT or EXPLORATION

**State Management:**
- Character state: position, health, equipment, animation
- Game state: `Game.state` object with pc, npcs, assets
- Combat state: `GameStateManager.characterActions`, queues
- All state in-memory, no persistence

## Key Abstractions

**Character Object:**
- Purpose: Represents any game entity (player or NPC)
- Examples: Created by `CharacterFactory.createCharacter()`
- Pattern: Plain object with position, stats, equipment, state
- Key properties: `hexQ/hexR`, `pixelX/pixelY`, `movementQueue`, `enemies` Set

**Game State Machine:**
- Purpose: Control game flow between modes
- Examples: `GAME_STATES.EXPLORATION`, `GAME_STATES.COMBAT_INPUT`, `GAME_STATES.COMBAT_EXECUTION`
- Pattern: Explicit state transitions with enter/exit callbacks
- Location: `js/GameStateManager.js`

**Dependency Injection:**
- Purpose: Avoid circular imports, enable testing
- Examples: `module.setDependencies({ hexGrid, pathfinding, ... })`
- Pattern: Game.js creates all modules, injects dependencies post-construction
- Location: All modules have `setDependencies()` or constructor injection

## Entry Points

**Browser Entry:**
- Location: `rpg.html` (line 58: `import { Game } from './js/Game.js'`)
- Triggers: Page load
- Responsibilities: Load HTML, initialize canvas, start Game

**Game Orchestrator:**
- Location: `js/Game.js`
- Triggers: Instantiation from rpg.html
- Responsibilities: Create all modules, inject dependencies, run game loop

**Initialization Flow:**
```
Game.constructor()
  → setupCanvas()
  → initializeModules()       # Create all systems
  → setupCallbacks()          # Wire event handlers
  → init() [async]            # Load area, assets
  → gameLoop()                # RequestAnimationFrame loop
```

## Error Handling

**Strategy:** Log errors and attempt graceful degradation

**Patterns:**
- Asset loading: Fallback to placeholder circles if sprite missing
- Area loading: Throw error (app crashes if area unavailable)
- Movement callbacks: Try/catch with console.error (continues without callback)

## Cross-Cutting Concerns

**Logging:**
- `Logger.js` provides structured logging with levels
- Combat events logged to in-game UI via `CombatUILog.js`
- Debug info displayed in HTML overlay

**Validation:**
- Hex bounds checking in GameStateManager
- Character occupancy validation before moves
- No formal schema validation (JSON trusted)

**Configuration:**
- All magic numbers in `js/const.js`
- Game balance (HP, damage, speed) via GAME_CONSTANTS
- Sprite configs in SPRITE_SETS

---

*Architecture analysis: 2026-01-12*
*Update when major patterns change*
