# Technology Stack

**Analysis Date:** 2026-01-12

## Languages

**Primary:**
- JavaScript (ES6+) - All application code (`js/*.js`)

**Secondary:**
- HTML5 - Entry points (`rpg.html`, `character-creation.html`)
- CSS3 - Styling (`css/styles.css`)
- JSON - Configuration and data (`areas/*/area.json`)

## Runtime

**Environment:**
- Browser-based (Chrome, Firefox, Safari)
- No Node.js runtime (pure client-side)
- No version files (.nvmrc, .python-version)

**Package Manager:**
- None - No npm, yarn, or package.json
- Vanilla JavaScript with no external dependencies
- ES6 modules loaded natively by browser

## Frameworks

**Core:**
- None - Vanilla JavaScript with Canvas API for rendering

**Testing:**
- None detected - No test framework configured

**Build/Dev:**
- None - No bundler (Webpack, Vite, etc.)
- Docker + nginx for local development server (`Dockerfile`, `docker-compose.yml`)

## Key Dependencies

**Critical:**
- Canvas 2D API - All game rendering (`js/Renderer.js`)
- Fetch API - Loading area JSON definitions (`js/AreaManager.js`)
- ES6 Modules - Native module system, no bundling

**Infrastructure:**
- nginx:alpine - Static file server (`Dockerfile`)
- Docker Compose - Local development (`docker-compose.yml`)

## Configuration

**Environment:**
- No environment variables required
- No .env files used
- Machine-specific config in `.claude-config.md` (gitignored)

**Build:**
- No build step required
- Files served directly by nginx
- Live reload via Docker volume mount

**Game Configuration:**
- `js/const.js` - All game constants, formulas, sprite configs
- `areas/*/area.json` - Map definitions, blocked hexes, spawns

## Platform Requirements

**Development:**
- Any platform with Docker
- No external dependencies beyond Docker
- Run: `docker compose -p $project_name up`
- Access: http://localhost:8080

**Production:**
- Static file hosting (any server with nginx, Apache, etc.)
- No build artifacts - serve source files directly
- Could deploy to Vercel, Netlify, GitHub Pages

---

*Stack analysis: 2026-01-12*
*Update after major dependency changes*
