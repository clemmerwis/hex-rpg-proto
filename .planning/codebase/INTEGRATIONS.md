# External Integrations

**Analysis Date:** 2026-01-12

## APIs & External Services

**Payment Processing:**
- Not applicable - No payment system

**Email/SMS:**
- Not applicable - No messaging system

**External APIs:**
- None currently implemented
- Comments in `js/AreaManager.js` indicate planned backend API:
  ```
  // Future: NPC templates fetched from backend API (only this file changes)
  // Repository Pattern: Lookup template (NOW: const.js, FUTURE: API fetch)
  ```

## Data Storage

**Databases:**
- None - All data in-memory during session
- No persistent storage implemented

**File Storage:**
- Local JSON files for area definitions (`areas/*/area.json`)
- Loaded via Fetch API: `fetch(\`areas/${areaId}/area.json\`)`
- Sprite sheets stored as static assets (`sprites/*/`)

**Caching:**
- Sprite caching in `AssetManager.js` (in-memory)
- Blocked hex flood-fill caching in `Renderer.js`
- No persistent cache (localStorage, IndexedDB)

## Authentication & Identity

**Auth Provider:**
- None - Single-player local game

**OAuth Integrations:**
- None

## Monitoring & Observability

**Error Tracking:**
- Browser console only
- Custom `Logger.js` system for structured logging
- No external error tracking (Sentry, etc.)

**Analytics:**
- None

**Logs:**
- Browser console.log/console.error
- In-game combat log UI (`CombatUILog.js`)
- Debug display in HTML overlay

## CI/CD & Deployment

**Hosting:**
- Docker container with nginx (local development)
- No production deployment configured

**CI Pipeline:**
- None configured
- No GitHub Actions, tests, or automated checks

## Environment Configuration

**Development:**
- Required env vars: None
- Secrets location: N/A
- Run: `docker compose -p $project_name up`
- Access: http://localhost:8080

**Staging:**
- Not configured

**Production:**
- Not configured
- Architecture supports static hosting anywhere

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Future Integration Points

Based on code comments and architecture:

1. **NPC Template API** (`js/AreaManager.js`)
   - Currently: Templates in `js/const.js`
   - Future: `GET /api/npcs/:templateId`
   - Repository pattern designed for seamless migration

2. **Area Loading API** (`js/AreaManager.js`)
   - Currently: Local JSON fetch
   - Future: Could fetch from API without code changes

3. **Save/Load System** (not implemented)
   - Architecture supports adding localStorage or backend persistence
   - Character and game state cleanly separated

---

*Integration audit: 2026-01-12*
*Update when adding/removing external services*
