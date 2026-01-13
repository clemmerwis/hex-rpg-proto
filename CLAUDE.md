# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For detailed reference (controls, data structures, debug features): see [docs/reference.md](docs/reference.md).

**Note**: Local machine-specific configuration (API tokens, etc.) is stored in `.claude-config.md` (gitignored).

## Planning System (GSD)

This project uses the [Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) planning system. Planning files are stored in `.planning/` directory.

- **Read freely**: Reference `.planning/` files for context on project roadmap, current phase, and implementation plans
- **Do not write**: Let GSD commands (`/gsd:*`) handle all writes to `.planning/` files

## Project Overview

This is a hex-grid based isometric RPG prototype built with vanilla JavaScript (ES6 modules). The game features turn-based tactical combat on a hexagonal grid with smooth character movement, pathfinding, and an AI system for enemy behavior

### Running the Application (Usually it's already running if you are working on it!)
```bash
# Using Docker (recommended)
docker compose -p $project_name up

# Access at http://localhost:8080
```

The application runs in an nginx container serving static files. No build step required - JavaScript modules are loaded natively by the browser.

### Development Workflow
- Edit files locally; Docker volume mount reflects changes immediately
- Refresh browser to see updates (no hot reload)
- Check browser console for runtime errors and debug logs

## Architecture Overview
Note! Tab size 4 for most files (especially js files)

### Module System
The codebase uses ES6 modules with dependency injection pattern. All modules are in `js/` directory:

- **Game.js** - Main orchestrator, initializes all systems and manages the game loop
- **GameStateManager.js** - State machine handling EXPLORATION, COMBAT_INPUT, and COMBAT_EXECUTION states
- **HexGrid.js** - Hexagonal coordinate system (axial coordinates) with pixel/hex conversions
- **Renderer.js** - Canvas-based rendering of background, hex grid, characters, and UI elements
- **InputHandler.js** - Mouse and keyboard input with edge scrolling and combat input handling
- **MovementSystem.js** - Smooth interpolated movement between hexes, animation state management
- **Pathfinding.js** - A* pathfinding for hex grids with obstacle avoidance
- **AISystem.js** - AI decision making for enemy characters (currently greedy movement toward player)
- **AssetManager.js** - Asynchronous sprite and image loading with progress tracking
- **AreaManager.js** - Area loading, transitions, blocked hexes, and spawn points (BG-style discrete maps)
- **const.js** - Centralized configuration (GAME_CONSTANTS, ANIMATION_CONFIGS, FACTIONS)

### State Management Pattern
The game uses a state machine with three core states:
1. **EXPLORATION** - Free movement, click to move anywhere with pathfinding
2. **COMBAT_INPUT** - Turn-based input phase, click adjacent hex to select move
3. **COMBAT_EXECUTION** - Sequential execution of all character actions

State transitions are managed by GameStateManager, which coordinates between input, movement, and AI systems.

### Hexagonal Grid System
Uses **axial coordinate system** (q, r) for hex positions. Key conversion functions:
- `hexToPixel(q, r)` - Convert hex coords to world pixel position
- `pixelToHex(x, y)` - Convert pixel position to hex coords
- `hexDistance(hex1, hex2)` - Calculate distance between hexes
- `getNeighbors(hex)` - Get 6 adjacent hexes

Characters store both hex position (`hexQ`, `hexR`) and pixel position (`pixelX`, `pixelY`) for smooth interpolated movement.

### Movement System
Movement uses a queue-based interpolation system:
1. Pathfinding generates array of hex waypoints
2. Waypoints added to `character.movementQueue`
3. `MovementSystem.updateMovement()` interpolates between current hex and first waypoint
4. On completion, shifts queue and continues to next waypoint
5. When queue empty, character returns to idle

### Combat System Flow
1. **Toggle Combat** (Shift+Space) → Enters COMBAT_INPUT state
2. **Input Phase** - Player clicks adjacent hex, AI enemies calculate moves
3. **Execution Phase** - Characters move sequentially, occupancy checks prevent conflicts
4. **Turn Increment** → Returns to COMBAT_INPUT for next turn

Combat actions execute in queue order with real-time occupancy validation (if target hex becomes occupied, move is cancelled).

### Configuration System
All magic numbers centralized in `const.js`:
- **GAME_CONSTANTS** - Movement speed, animation timing, world dimensions, scroll speeds, pathfinding limits
- **SPRITE_SETS** - Sprite sheet layouts (cols, rows, frameCount) for each animation per sprite set
- **FACTIONS** - Faction colors and nameplate styling

**IMPORTANT**: When adding new configurable values, add them to const.js rather than hardcoding.

## Key Implementation Details

### Sprite System
- Sprites use 6-directional facing (dir1, dir2, dir3, dir5, dir6, dir7) matching hex grid directions
- Animation frames stored in sprite sheets at `sprites/KnightBasic/`, `sprites/KnightAdvCombat/`, etc.
- Frame size: 256x256 pixels (SPRITE_FRAME_SIZE constant)

### Dependency Injection
Modules don't import each other directly. Game.js creates all modules and injects dependencies via `setDependencies()` methods. This prevents circular dependencies and makes testing easier.

## Common Tasks

### Adding New Character Animations
1. Add sprite sheets to `sprites/` directory with dir1, dir2, dir3, dir5, dir6, dir7 variants
2. Add sprite set and animation configs to `SPRITE_SETS` in const.js
3. Update animation triggers in MovementSystem or InputHandler

### Modifying Combat Behavior
- AI logic: Edit `AISystem.getAIAction()`
- Turn order: Modify `GameStateManager.enterCombatExecution()`
- Action validation: Update `GameStateManager.selectPlayerMoveTarget()`

### Adding New Game States
1. Add state constant to GAME_STATES in GameStateManager.js
2. Add state transition logic in `GameStateManager.setState()`
3. Update input handling in InputHandler for new state
4. Add UI updates in `Game.updateGameStateUI()`

### Adjusting Game Balance
Edit values in `const.js`:
- Movement speed: `MOVEMENT_SPEED`
- Pathfinding range: `PATHFINDING_MAX_DISTANCE`
- Animation timing: `ANIMATION_SPEED`
- World size: `WORLD_WIDTH`, `WORLD_HEIGHT`
- Hex grid size: `HEX_SIZE`

### Adding New Areas
1. Create folder `areas/{area_id}/`
2. Add `area.json` with area definition (see [docs/reference.md](docs/reference.md) for schema)
3. Add `background.jpg` (area dimensions match image native size)
4. Define blocked hexes, spawn points, and exits to other areas
5. Load via `areaManager.loadArea('area_id', 'spawn_point')`
