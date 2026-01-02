# Endgame Backend Architecture

Notes on scaling the hex RPG prototype to a SaaS product.

## Current State

- Vanilla JavaScript with HTML5 Canvas API
- All state client-side (in-memory)
- No backend, no persistence

## Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Canvas game (no page refreshes)                 │   │
│  │ Laravel Echo for WebSocket connection           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Digital Ocean + Ploi                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Laravel App (Droplet)                            │  │
│  │ ├─ Sanctum (SPA auth, token-based)               │  │
│  │ ├─ REST API controllers (game actions)           │  │
│  │ ├─ Reverb (WebSockets, Laravel 11+)              │  │
│  │ └─ Queues (background jobs if needed)            │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ MySQL / PostgreSQL                               │  │
│  │ ├─ users (Laravel default)                       │  │
│  │ ├─ characters                                    │  │
│  │ ├─ character_inventories                         │  │
│  │ ├─ world_instances (per-user world state)        │  │
│  │ ├─ npcs, quests, quest_progress                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Redis (for Reverb WS + cache + sessions)         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Laravel Stack

| Component | Tool |
|-----------|------|
| Auth | Sanctum (SPA tokens) |
| API | `routes/api.php` + Controllers |
| WebSockets | Reverb (native Laravel 11+) |
| Broadcasting | Laravel Echo (JS client) |
| DB | Eloquent models |
| Cache/Sessions | Redis |
| Queue | Redis + Horizon (optional) |

## Data Sync Approaches

### Option A: REST + Client-Side Battle Cache (Simpler)

```
Combat starts → client runs battle locally →
battle ends → POST /api/combat-result with outcome →
server validates & persists
```

One API call per battle, not per turn. Good for single-player.

### Option B: WebSockets via Laravel Reverb (Real-time)

```
Combat action → broadcast to server →
server validates → broadcasts new state back →
client updates
```

Needed if:
- Multiplayer
- Server-authoritative anti-cheat matters
- Real-time world events

## Database Schema (Core Tables)

```
users (Laravel default)
  - id, email, password, etc.

characters
  - id
  - user_id
  - name
  - area_id (current area)
  - hex_q, hex_r (position)
  - stats (JSON or normalized)
  - created_at, updated_at

character_inventories
  - id
  - character_id
  - item_id
  - quantity
  - slot (equipped position or null)

world_instances (per-user world state)
  - id
  - user_id
  - area_id
  - state_data (JSON: opened chests, dead NPCs, etc.)

npcs
  - id
  - area_id
  - npc_type
  - default_hex_q, default_hex_r
  - dialogue_key
  - is_enemy

quests
  - id
  - name
  - description
  - stages (JSON)

quest_progress
  - id
  - character_id
  - quest_id
  - current_stage
  - completed_at
```

## Cost Estimate (5,000 Users)

### Assumptions

- 5,000 paying users at $9/month
- Average 3.5 hours play per day per user
- Peak concurrent: ~1,500-2,000 users
- Turn-based = low message frequency

### Infrastructure

| Component | Spec | Cost/month |
|-----------|------|------------|
| App Servers (x2) | 4GB RAM, 2 vCPU each | $96 |
| Load Balancer | DigitalOcean LB | $12 |
| Managed PostgreSQL | 4GB RAM | $60 |
| Managed Redis | 1GB (Reverb + cache) | $25 |
| Spaces + CDN | Asset storage | $10 |
| Ploi | Multi-server plan | $20 |
| Backups/Monitoring | — | $15 |
| **Total** | | **~$240/month** |

With buffer for spikes: **$300-400/month**

### Profit Margin

```
Revenue:           $45,000/month
Infrastructure:      -$350/month  (0.8%)
Stripe fees:       -$1,350/month  (3%)
Ploi:                -$20/month
───────────────────────────────────
Gross:            ~$43,280/month
```

Infrastructure is ~1% of revenue.

### Scaling Notes

- Reverb handles thousands of connections per server for low-frequency messaging
- Turn-based is ideal — no 60fps state sync needed
- At 10,000+ users: add another app server ($48) and bump DB tier (+$40)
- Scales nearly linearly at low marginal cost

## Why Canvas is Correct

Canvas vs DOM was evaluated. Canvas wins for this game because:

- Many animated sprites (performance)
- Smooth interpolated movement
- Hex grid overlay rendering
- Pathfinding visualization
- Camera/viewport scrolling
- Custom visual effects

## Why Vanilla JS vs Phaser

Phaser was considered but not adopted because:

- Codebase already well-structured with good separation
- Hex grid support isn't native to Phaser (would need custom code anyway)
- Already built: asset loading, sprite animation, pathfinding, movement, state machine, AI
- Switching would be a rewrite with questionable benefit
- For prototyping/learning, vanilla gives more understanding

Phaser would make sense for a fresh start on a larger game with physics, particles, complex scenes.
