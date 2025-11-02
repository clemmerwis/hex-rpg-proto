# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a hex-grid based isometric RPG prototype built with vanilla JavaScript (ES6 modules). The game features turn-based tactical combat on a hexagonal grid with smooth character movement, pathfinding, and an AI system for enemy behavior.

## Development Commands

### Running the Application
```bash
# Using Docker (recommended)
docker-compose up

# Access at http://localhost:8080
```

The application runs in an nginx container serving static files. No build step required - JavaScript modules are loaded natively by the browser.

### Development Workflow
- Edit files locally; Docker volume mount reflects changes immediately
- Refresh browser to see updates (no hot reload)
- Check browser console for runtime errors and debug logs

## Architecture Overview

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

### Character Data Structure
All characters (PC and NPCs) share this structure:
```javascript
{
    hexQ, hexR,              // Current hex position
    pixelX, pixelY,          // Current pixel position (for smooth movement)
    facing,                  // Direction facing (dir1-dir8)
    currentAnimation,        // Current animation state (idle, walk, run, etc.)
    animationFrame,          // Current frame in animation
    faction,                 // 'player', 'enemy', 'ally', 'neutral'
    health, maxHealth,
    movementQueue,           // Array of hex targets for pathfinding
    isMoving,                // Boolean movement state
    moveSpeed,               // ms per hex movement
    currentMoveTimer         // Movement interpolation timer
}
```

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
- **ANIMATION_CONFIGS** - Sprite sheet layouts (cols, rows, frameCount) for each animation
- **FACTIONS** - Faction colors and nameplate styling

**IMPORTANT**: When adding new configurable values, add them to const.js rather than hardcoding.

## Key Implementation Details

### Sprite System
- Sprites use 8-directional facing (dir1-dir8) with separate sprite sheets per direction
- Animation frames stored in JSON files at `sprites/KnightBasic/`, `sprites/KnightAdvCombat/`, etc.
- Frame size: 256x256 pixels (SPRITE_FRAME_SIZE constant)

### Dependency Injection
Modules don't import each other directly. Game.js creates all modules and injects dependencies via `setDependencies()` methods. This prevents circular dependencies and makes testing easier.

### Coordinate Systems
Three coordinate systems in use:
1. **Canvas coordinates** - Mouse position relative to canvas element
2. **World coordinates** - Pixel coordinates in the game world (before zoom/camera)
3. **Hex coordinates** - Axial (q, r) coordinates for grid logic

Always convert through appropriate methods: canvas → world (factor in camera/zoom) → hex (use hexGrid.pixelToHex).

### Rendering Order
Layers rendered in this order:
1. Background image
2. Hex grid (if enabled via checkbox)
3. Characters (sorted by Y position for proper overlap)
4. UI overlays (nameplates, health bars)

## Common Tasks

### Adding New Character Animations
1. Add sprite sheets to `sprites/` directory with dir1-dir8 variants
2. Add animation config to `ANIMATION_CONFIGS` in const.js
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

## Debug Features

In-game debug panel shows:
- Mouse position (world coordinates)
- Current hex (q, r coordinates)
- Asset loading status
- Camera position
- PC facing direction
- Current animation state

### Keyboard Controls
- **1-6**: Trigger different animations
- **7**: Spawn random enemy near player
- **Shift+Space**: Toggle combat mode
- **Space**: Skip turn (during combat)
- **Arrow keys**: Camera scrolling
- **Click**: Move character (exploration) or select hex (combat)
- **Edge scrolling**: Mouse near canvas edges

### Grid Toggle
Checkbox in debug panel enables/disables hex grid overlay for easier debugging.
