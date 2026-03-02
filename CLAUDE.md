# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For detailed reference (controls, data structures, debug features): see [docs/reference.md](docs/reference.md).

## GitHub API Access
**IMPORTANT**: When accessing GitHub repositories, use the GitHub REST API directly with the personal access token.
- **DO NOT** use GitHub MCP or `gh` CLI
- **DO** use curl or WebFetch with API endpoints

**Access Token Location**: `~/.claude/github_token`

**Usage Example**:
```bash
# Read token
GITHUB_TOKEN=$(cat ~/.claude/github_token)

# Use with API
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user/repos
```

## Planning System (GSD) (Auto Task Runner)
This project uses the [Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) planning system. Planning files are stored in `.planning/` directory.

- **Read freely**: Reference `.planning/` files for context on project roadmap, current phase, and implementation plans
- **Do not write**: Let GSD commands (`/gsd:*`) handle all writes to `.planning/` files

## mdplans my personal manual planning system

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
For detailed architecture docs (data structures, code patterns, dependency trees): see `.claude-marked/hex-rpg-proto/index/`

Note! Tab size 4 for most files (especially js files)

### Module System
ES6 modules with dependency injection pattern. All modules in `js/` directory:

- **Game.js** - Main orchestrator, init, DI, game loop
- **GameStateManager.js** - State machine (EXPLORATION, COMBAT_INPUT, COMBAT_EXECUTION)
- **HexGrid.js** - Axial hex coordinates (q, r), pixel/hex conversions
- **Renderer.js** - Canvas rendering (bg, grid, characters, UI)
- **InputHandler.js** - Mouse/keyboard input, edge scrolling
- **MovementSystem.js** - Queue-based interpolated movement, animation states
- **Pathfinding.js** - A* pathfinding on hex grid
- **AISystem.js** - Enemy AI decision making
- **AssetManager.js** - Async sprite/image loading
- **AreaManager.js** - Area loading, transitions, blocked hexes, spawns
- **const.js** - All constants, formulas, weapons, armor, factions, NPC templates

### Configuration Rule
**IMPORTANT**: When adding new configurable values, add them to const.js rather than hardcoding.

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
