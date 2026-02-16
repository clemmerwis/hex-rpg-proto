# Codebase Structure

**Analysis Date:** 2026-02-15

## Directory Layout

```
hex-rpg-proto/
├── rpg.html                    # Main game entry point
├── character-creation.html     # Character creation UI (standalone)
├── CLAUDE.md                   # Project documentation for Claude Code
├── Dockerfile                  # Docker container config (nginx:alpine)
├── docker-compose.yml          # Docker compose for local dev (port 8080)
├── .gitignore                  # Whitelist-style git ignore
│
├── js/                         # Game logic modules (ES6)
│   ├── Game.js                 # Central orchestrator (409 lines)
│   ├── GameStateManager.js     # State machine (722 lines)
│   ├── Renderer.js             # Canvas rendering (663 lines)
│   ├── InputHandler.js         # Input processing (419 lines)
│   ├── CombatUILog.js          # Combat log UI (453 lines)
│   ├── CombatSystem.js         # Combat resolution (300 lines)
│   ├── AISystem.js             # Enemy AI (250 lines)
│   ├── MovementSystem.js       # Movement/animation (245 lines)
│   ├── AreaManager.js          # Area loading/NPCs (284 lines)
│   ├── UIManager.js            # DOM management (160 lines)
│   ├── Pathfinding.js          # A* algorithm (139 lines)
│   ├── Logger.js               # Logging system (141 lines)
│   ├── AssetManager.js         # Sprite loading (126 lines)
│   ├── CharacterFactory.js     # Character creation (95 lines)
│   ├── HexGrid.js              # Hex math (70 lines)
│   ├── CharacterCreation.js    # Character creation system (767 lines)
│   ├── const.js                # Constants & config (643 lines)
│   └── utils.js                # Utility functions (9 lines)
│
├── css/
│   └── styles.css              # Game UI styling
│
├── sprites/                    # Character sprite sheets
│   ├── KnightBasic/            # Base knight (idle, walk, run, attack, etc.)
│   ├── KnightSwordShield/      # Sword+shield variant
│   ├── KnightAdvCombat/        # Advanced combat animations
│   └── .../                    # Other sprite sets
│       └── dir1-dir8/          # 8-directional facing subdirectories
│
├── areas/                      # Discrete game maps
│   └── bridge_crossing/
│       ├── area.json           # Area definition (blocked hexes, NPCs, dimensions)
│       └── background.jpg      # Background image
│
├── docs/                       # Documentation
│   ├── reference.md            # Architecture reference (controls, data structures)
│   └── endgame-backend.md      # Backend integration plans
│
├── mdplans/                    # Planning documents
│   └── current/                # Active plans
│       ├── combat-development-roadmap.md
│       └── combatsystem-refactoring-plan.md
│
└── .planning/                  # GSD planning files (auto-managed)
    └── codebase/               # Codebase analysis documents
```

## Directory Purposes

**js/**
- Purpose: All game logic as ES6 modules
- Contains: 18 .js files, one class/system per file
- Key files: `Game.js` (orchestrator), `GameStateManager.js` (state machine), `const.js` (config)

**sprites/**
- Purpose: Character sprite sheets organized by set and direction
- Contains: PNG sprite sheets (256x256 frame size)
- Structure: `sprites/{SpriteSetName}/{dir1-dir8}/{Animation}_dir{N}.png`

**areas/**
- Purpose: Discrete game maps (BG-style area transitions)
- Contains: One subdirectory per area with `area.json` + `background.jpg`
- Key files: `bridge_crossing/area.json` (current playable area)

**docs/**
- Purpose: Architecture and design documentation
- Contains: Reference docs for controls, data structures, debug features

**mdplans/**
- Purpose: Development planning documents (non-GSD)
- Contains: Combat roadmap and refactoring plans

## Key File Locations

**Entry Points:**
- `rpg.html` - Main game (imports `js/Game.js`)
- `character-creation.html` - Character creation (imports `js/CharacterCreation.js`)

**Configuration:**
- `js/const.js` - Game constants, sprite sets, weapons, armor, NPC templates, stat formulas
- `docker-compose.yml` - Docker dev environment
- `Dockerfile` - nginx:alpine container

**Core Logic:**
- `js/GameStateManager.js` - State machine (exploration/combat states)
- `js/CombatSystem.js` - Attack resolution, damage pipeline
- `js/AISystem.js` - Enemy decision-making
- `js/MovementSystem.js` - Movement interpolation and animation

**World:**
- `js/HexGrid.js` - Hex coordinate math
- `js/Pathfinding.js` - A* on hex grids
- `js/AreaManager.js` - Area loading and NPC instantiation

**Rendering:**
- `js/Renderer.js` - Canvas drawing pipeline
- `js/CombatUILog.js` - Combat log with semantic tag formatting

**Documentation:**
- `CLAUDE.md` - Project guidance for Claude Code
- `docs/reference.md` - Comprehensive architecture reference

## Naming Conventions

**Files:**
- PascalCase.js for modules (`Game.js`, `HexGrid.js`, `GameStateManager.js`)
- camelCase.js for config/utility (`const.js`, `utils.js`)
- kebab-case for non-JS files (`area.json`, `docker-compose.yml`)

**Directories:**
- camelCase for code directories (`js/`, `css/`)
- PascalCase for sprite sets (`KnightBasic/`, `KnightSwordShield/`)
- snake_case for areas (`bridge_crossing/`)
- Direction subdirs: `dir1` through `dir8`

**Special Patterns:**
- One class per file, filename matches class name
- `const.js` is the exception (exports multiple constants/functions)

## Where to Add New Code

**New Game System:**
- Implementation: `js/{SystemName}.js`
- Wire dependencies: Add to `js/Game.js` constructor
- Constants: Add to `js/const.js`

**New Area:**
- Create: `areas/{area_id}/`
- Add: `area.json` (schema in docs/reference.md) + `background.jpg`
- Load via: `areaManager.loadArea('area_id', 'spawn_point')`

**New Character Animations:**
- Sprite sheets: `sprites/{SpriteSetName}/{dir1-dir8}/`
- Config: Add to `SPRITE_SETS` in `js/const.js`
- Triggers: Update in `js/MovementSystem.js` or `js/GameStateManager.js`

**New Combat Mechanics:**
- Formulas: `js/const.js` (calculation functions)
- Resolution: `js/CombatSystem.js`
- AI behavior: `js/AISystem.js`
- Log formatting: `js/CombatUILog.js`

**New UI Elements:**
- DOM: Add to `rpg.html`
- Cache refs: `js/UIManager.js`
- Styling: `css/styles.css`

## Special Directories

**.planning/**
- Purpose: GSD planning system auto-managed files
- Source: Generated by `/gsd:*` commands
- Committed: Yes

**mdplans/**
- Purpose: Manual planning documents (combat roadmap, refactoring plans)
- Source: Hand-written development plans
- Committed: Yes

**assets-influx/**
- Purpose: Asset development staging
- Source: New assets being prepared for use
- Committed: Varies

---

*Structure analysis: 2026-02-15*
*Update when directory structure changes*
