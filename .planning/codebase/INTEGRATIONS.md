# External Integrations

**Analysis Date:** 2026-02-15

## APIs & External Services

**Not detected** - This is a 100% client-side game with zero external API integrations.

**Future planned:**
- Backend API for NPC templates - documented migration points in:
  - `js/AreaManager.js` line 12: "Future: NPC templates fetched from backend API"
  - `js/const.js` line 477: "Future: Templates fetched from backend API GET /api/npcs/:templateId"
  - `js/Game.js` line 65: "Future: Templates will be fetched from backend API instead of const.js"
- Migration strategy: Only `AreaManager.instantiateNPCs()` and `const.js` lookups need changes

## Data Storage

**Browser localStorage:**
- Used in `js/CharacterCreation.js` for persistent character creation data
- Keys: character stats, equipment selections, template data

**In-memory state:**
- All runtime game state stored in JavaScript objects
- Character positions, health, combat state - lost on page refresh

**Static JSON files:**
- Area definitions loaded via fetch from `areas/{area_id}/area.json`
- NPC templates defined in `js/const.js` NPC_TEMPLATES object

**No database** - No MongoDB, PostgreSQL, Firebase, or any backend database

## Authentication & Identity

**Not detected** - Single-player prototype with no user accounts or auth

## Monitoring & Observability

**Error Tracking:**
- None - Browser console only

**Analytics:**
- None

**Logs:**
- Custom `js/Logger.js` with dual output (console + in-game combat log)
- Log levels: DEBUG, INFO, COMBAT, WARNING, ERROR

## CI/CD & Deployment

**Hosting:**
- Docker container with nginx:alpine
- Local development only (no production deployment configured)

**CI Pipeline:**
- None - No GitHub Actions or other CI

## Environment Configuration

**Development:**
- No env vars required
- Docker volume mount for live file updates
- Manual browser refresh (no hot reload)

**Production:**
- Not configured (prototype stage)

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None

---

*Integration audit: 2026-02-15*
*Update when adding/removing external services*
