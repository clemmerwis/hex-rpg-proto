# Technology Stack

**Analysis Date:** 2026-02-15

## Languages

**Primary:**
- JavaScript (ES6 modules) - All game logic (~5,895 lines across 18 files in `js/`)

**Secondary:**
- HTML5 - Entry points (`rpg.html`, `character-creation.html`)
- CSS3 - UI styling (`css/styles.css`)
- JSON - Area definitions (`areas/*/area.json`), sprite metadata

## Runtime

**Environment:**
- Browser-based - Vanilla ES6 modules loaded natively (no bundler/transpiler)
- Docker + nginx:alpine - Static file serving via `Dockerfile` and `docker-compose.yml`
- Port 8080 - Local dev access at http://localhost:8080

**Package Manager:**
- None - Zero npm/yarn dependencies, no package.json
- No lockfiles - Entirely vanilla JavaScript

## Frameworks

**Core:**
- None - Pure vanilla JavaScript with custom dependency injection pattern

**Testing:**
- None - No test framework (manual browser testing only)

**Build/Dev:**
- None - No webpack, Vite, Rollup, Babel, or TypeScript
- No build step required - ES6 modules served directly by nginx

## Key Dependencies

**Critical:**
- No external packages - Everything is vanilla JavaScript
- Browser Canvas API - All rendering via `<canvas>` element
- Browser Fetch API - Area JSON loading in `js/AreaManager.js`
- Browser localStorage - Character creation persistence in `js/CharacterCreation.js`

**Infrastructure:**
- nginx:alpine - Static file web server (`Dockerfile`)
- Docker Compose - Local development environment (`docker-compose.yml`)

## Configuration

**Environment:**
- No environment variables required
- No .env files
- `.claude-config.md` - Claude-specific local config (gitignored)

**Build:**
- No build configuration files
- `.gitignore` - Whitelist approach (allows only specific file types)

**Game:**
- `js/const.js` - Centralized game constants (HEX_SIZE, WORLD_WIDTH, MOVEMENT_SPEED, etc.)
- `areas/*/area.json` - Per-area definitions (blocked hexes, NPCs, spawn points, dimensions)

## Platform Requirements

**Development:**
- Any platform with Docker (Windows/macOS/Linux)
- Docker + Docker Compose for nginx container
- Browser with ES6 module support
- No additional tooling required

**Production:**
- Docker container with nginx:alpine
- Static file serving only (no server-side logic)
- No version-specific requirements beyond modern browser

---

*Stack analysis: 2026-02-15*
*Update after major dependency changes*
