# Codebase Structure

**Analysis Date:** 2026-01-12

## Directory Layout

```
hex-rpg-proto/
├── js/                     # Game logic modules (ES6)
├── css/                    # Styling
├── areas/                  # Discrete game maps (Baldur's Gate style)
│   └── bridge_crossing/   # Example area
├── sprites/                # Character sprite assets
│   ├── KnightBasic/       # Base knight sprites
│   ├── KnightSwordShield/ # Equipment variant
│   └── KnightSword/       # Another variant
├── docs/                   # Documentation
├── mdplans/                # Development planning (GSD workflow)
│   ├── complete/
│   ├── current/
│   └── queue/
├── .planning/              # Internal planning directory
├── rpg.html                # Main game entry point
├── character-creation.html # Character creation UI
├── Dockerfile              # Docker container config
└── docker-compose.yml      # Compose file for dev
```

## Directory Purposes

**js/**
- Purpose: All game logic modules (ES6)
- Contains: 16 JavaScript modules
- Key files:
  - `Game.js` - Main orchestrator, game loop
  - `GameStateManager.js` - State machine (EXPLORATION/COMBAT)
  - `Renderer.js` - Canvas rendering
  - `const.js` - All configuration and constants
- Subdirectories: None (flat structure)

**css/**
- Purpose: Styling for HTML UI
- Contains: `styles.css` - All styles
- Subdirectories: None

**areas/**
- Purpose: Discrete game maps (BG-style)
- Contains: Folder per area with area.json + background.jpg
- Key files: `bridge_crossing/area.json` (example area definition)
- Subdirectories: One per area ID

**sprites/**
- Purpose: Character sprite sheets
- Contains: 6-directional sprite sheets per animation
- Key files: `{SpriteSet}/{Animation}/dir{N}.png`
- Subdirectories: One per sprite set (KnightBasic, KnightSwordShield, etc.)

**docs/**
- Purpose: Developer documentation
- Contains: `reference.md` (data structures, APIs, debug features)
- Key files: `endgame-backend.md` (future backend plan)
- Subdirectories: None

**mdplans/**
- Purpose: Development planning (GSD workflow)
- Contains: Plan documents organized by status
- Subdirectories: `complete/`, `current/`, `queue/`

## Key File Locations

**Entry Points:**
- `rpg.html` - Main HTML file, imports `js/Game.js`
- `character-creation.html` - Separate character creation UI

**Configuration:**
- `js/const.js` - Game constants, sprite configs, formulas
- `docker-compose.yml` - Docker development setup
- `Dockerfile` - nginx:alpine container definition

**Core Logic:**
- `js/Game.js` - Application bootstrap and game loop
- `js/GameStateManager.js` - Combat/exploration state machine
- `js/CombatSystem.js` - Attack resolution and damage
- `js/MovementSystem.js` - Character movement interpolation
- `js/Pathfinding.js` - A* pathfinding for hex grids

**Rendering:**
- `js/Renderer.js` - Canvas drawing (characters, grid, UI)
- `js/UIManager.js` - DOM manipulation abstraction
- `js/CombatUILog.js` - In-game combat log display

**Data:**
- `js/CharacterFactory.js` - Character object creation
- `js/AreaManager.js` - Map loading and NPC spawning
- `js/AssetManager.js` - Sprite/image loading

**Testing:**
- None - No test files present

**Documentation:**
- `CLAUDE.md` - Instructions for Claude Code
- `docs/reference.md` - Data structures reference

## Naming Conventions

**Files:**
- PascalCase.js - ES6 class modules (`GameStateManager.js`, `HexGrid.js`)
- lowercase.js - Utility modules (`const.js`, `utils.js`)
- kebab-case.html - HTML files (`character-creation.html`)
- UPPERCASE.md - Important docs (`CLAUDE.md`, `README.md`)

**Directories:**
- lowercase - All directories (`js/`, `css/`, `areas/`)
- snake_case - Area IDs (`bridge_crossing/`)
- PascalCase - Sprite sets (`KnightBasic/`, `KnightSwordShield/`)

**Special Patterns:**
- `dir{1-8}.png` - Directional sprite variants
- `area.json` - Area definition in each area folder
- `background.jpg` - Background image in each area folder

## Where to Add New Code

**New Game System:**
- Primary code: `js/{SystemName}.js`
- Integration: Import in `js/Game.js`, inject dependencies
- Config: Add constants to `js/const.js`

**New UI Component:**
- Implementation: `js/UI{ComponentName}.js`
- Styling: Add to `css/styles.css`
- HTML: Add elements to `rpg.html`

**New Area/Map:**
- Definition: `areas/{area_id}/area.json`
- Background: `areas/{area_id}/background.jpg`
- Schema: See `docs/reference.md` for area.json structure

**New Sprite Set:**
- Assets: `sprites/{SpriteSet}/{Animation}/dir{1-8}.png`
- Config: Add to `SPRITE_SETS` in `js/const.js`

**New Character Template:**
- Definition: Add to `NPC_TEMPLATES` in `js/const.js`
- Usage: Reference by key in area.json NPCs

**Utilities:**
- Shared helpers: `js/utils.js`
- Game constants: `js/const.js`

## Special Directories

**.planning/**
- Purpose: GSD workflow planning documents
- Source: Created by planning tools
- Committed: Yes

**mdplans/**
- Purpose: Development phase plans
- Source: Manual planning documents
- Committed: Yes

**sprites/Items/**
- Purpose: Unused item sprites
- Source: Asset files
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-12*
*Update when directory structure changes*
