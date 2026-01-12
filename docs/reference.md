# Project Reference

Detailed reference material for the RPG prototype. For architectural guidance and development instructions, see [CLAUDE.md](../CLAUDE.md).

## Character Data Structure

All characters (PC and NPCs) share this structure:
```javascript
{
    // Position
    hexQ, hexR,                    // Axial hex coordinates
    pixelX, pixelY,                // Rendered pixel position
    targetPixelX, targetPixelY,    // Movement interpolation targets

    // Animation
    facing,                        // Direction (dir1, dir2, dir3, dir5, dir6, dir7 - 6 hex directions)
    currentAnimation,              // Animation state (idle, walk, run, attack, jump, die, impact, idle2)
    animationFrame,                // Current frame index
    animationTimer,                // Timer for frame progression

    // Identity
    name,                          // Display name
    faction,                       // Faction key: 'pc', 'pc_ally', 'bandit', 'guard'
    spriteSet,                     // Sprite set key: 'baseKnight', 'swordShieldKnight', 'swordKnight'

    // Stats (10 stats, 60 total points, min 3 / max 10 per stat)
    stats: {
        str, int,                  // Power (Physical/Cerebral)
        dex, per,                  // Prowess (Physical/Cerebral)
        con, will,                 // Resistance (Physical/Cerebral)
        beauty, cha,               // Appearance (Physical/Cerebral)
        instinct, wis              // Spirit (Physical/Cerebral)
    },

    // Equipment
    equipment: {
        mainHand,                  // Weapon key ('unarmed', 'shortSword', 'longSword', etc.)
        offHand,                   // Shield or null ('smallShield', 'largeShield')
        armor                      // Armor key ('none', 'leather', 'scale', 'brigandine', 'chain', 'plate')
    },

    // Skills (all range 1-10)
    skills: {
        block, dodge,              // Defense skills
        unarmed, shortSword, longSword, shortSpear, longSpear, shortBlunt, longBlunt,  // Weapon skills
        criticalStrike, criticalDefense  // Critical skills
    },

    // Health
    health, maxHealth,             // Current and max HP
    hpBufferMax,                   // Temp HP per attacker (Instinct * WillMultiplier)
    hpBufferByAttacker,            // Map<attacker, remaining buffer>

    // Combat State
    isDefeated,                    // Boolean - character defeated
    mode,                          // 'aggressive' or 'neutral' (AI behavior)
    enemies,                       // Set<character> - hostile targets
    lastAttackedBy,                // Reference to last attacker

    // Engagement (multi-opponent tracking)
    engagedBy,                     // Set<character> - who is engaging this character
    engagedMax,                    // Max simultaneous engagements (Cerebral Presence / 6)

    // Movement
    movementQueue,                 // Array of hex targets
    isMoving,                      // Boolean - currently moving
    moveSpeed,                     // ms per hex (default 300)
    currentMoveTimer               // Current interpolation progress
}
```

## Faction System

Factions define visual styling and hostility. Defined in `const.js`:

| Faction Key | Name | Tint Color | Nameplate Color |
|-------------|------|------------|-----------------|
| `pc` | PC | #4CAF50 (green) | #00ff00 |
| `pc_ally` | Companion | #4169E1 (blue) | #6495ED |
| `bandit` | Bandit | #B22222 (red) | #cc3333 |
| `guard` | Guard | #FF9800 (orange) | #ffaa44 |

**Hostility Rules:**
- Same faction = allies (can accidentally hit with friendly fire, but not target)
- Attacking any character makes you mutual enemies
- Enemies are shared across same-faction characters

## Stats & Combat Calculations

### Stat System
- 10 stats in 5 categories (Physical/Cerebral pairs)
- Each stat: min 3, max 10
- Total points per character: 60

### Stat Bonuses

**Constitution Bonus (additive HP modifier):**
| Con | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-----|---|---|---|---|---|---|---|---|
| Bonus | -4 | -2 | 0 | +1 | +2 | +4 | +6 | +8 |

**Multiplier Scale (used by Str, Will):**
| Stat | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|------|---|---|---|---|---|---|---|---|
| Mult | 1.0 | 1.25 | 1.5 | 1.75 | 2.0 | 2.25 | 2.5 | 3.0 |

### Derived Values
```javascript
maxHealth = ceil((15 + CON_BONUS[con]) * MULTIPLIER[str])
hpBufferMax = ceil(instinct * MULTIPLIER[will])
engagedMax = floor((per + wis + int) / 6)  // Cerebral Presence
```

### Combat Formulas

**Attack Rating:**
```
attackR = (weaponSkill * 5) + (str * 3) + (dex * 2) + weapon.attackR
```

**Defense Rating:**
```
defenseR = (skill * 5) + (dex * 3) + (instinct * 2) + equipment.defenseR + 5
// Uses block skill if shield, dodge skill otherwise
// +5 base defense bonus makes hitting slightly harder
```

**To-Hit Chance:**
```
THC = ((attackR - defenseR) + (50 - evasionBonus)) / 100
// evasionBonus reduces base hit chance (from equipment passives)
```

**Critical Strike Ratings:**
```
CSA_R = (criticalStrike * 5) + (int * 3) + (str * 2)
CSD_R = (criticalDefense * 5) + (dex * 3) + (per * 2) + instinct
CSC = ((CSA_R - CSD_R) + 50) / 100
```

**Damage Calculation:**
1. Base: `weapon.base + ceil(weapon.force * MULTIPLIER[str]) + attackType.damageMod`
2. Critical Hit: Multiply by 2, then by weapon.critMultiplier if present
3. Flanking Check: Attacker behind defender OR defender over-engaged (at max capacity)
4. Armor Defense: `effectiveDR = flanking ? floor(armor.defense * armor.flankingDefense) : armor.defense`
5. Subtract DR: `damage = max(0, damage - effectiveDR)`
6. Resistance/Vulnerability: If damage > 0, multiply by 0.5 (resistant) or 1.5 (vulnerable)

### Speed & Turn Order

**Move Speed (movement phase):**
```
moveSpeed = armor.mobility - str  // Lower = faster
```

**Action Speed (attack phase):**
```
actionSpeed = weapon.speed + shield.speed (if not 2h) + attackType.speedMod - dex
```

**Speed Tiers:**
| Tier | Speed Range | Name |
|------|-------------|------|
| 1 | 0-20 | 1/4 (fastest) |
| 2 | 21-40 | 2/4 |
| 3 | 41-55 | 3/4 |
| 4 | 56+ | 4/4 (slowest) |

**Initiative (tiebreaker within tier):**
```
initiative = will + instinct  // Higher goes first
```

### HP Buffer System
Each attacker must deplete a character's buffer individually before dealing real HP damage. Represents stamina/composure that resets per-opponent.

## Equipment

### Weapons
| Weapon | Base | Type | Force | Speed | Grip | Special |
|--------|------|------|-------|-------|------|---------|
| Unarmed | 2 | concussive | 1 | 16 | two | evasionBonus: 5, bypasses buffer |
| Short Spear | 3 | piercing | 1 | 19 | one | vulnerableEnhancementLight |
| Short Sword | 4 | slash | 2 | 18 | one | bleedingLight |
| Short Blunt | 6 | blunt | 3 | 20 | one | armorDamageEnhancementLight |
| Long Sword | 8 | slash | 4 | 20 | two | bleedingHeavy |
| Long Spear | 6 | piercing | 4 | 20 | two | vulnerableEnhancementHeavy |
| Long Blunt | 10 | blunt | 6 | 21 | two | armorDamageEnhancementHeavy |
| Small Shield | 1 | blunt | 2 | 17 | off | defenseR: 4 |
| Large Shield | 1 | blunt | 3 | 20 | off | defenseR: 8 |

**Grip types:** `one` (mainHand only), `two` (both hands), `off` (offHand only)

### Attack Types
| Type | Speed Mod | Damage Mod |
|------|-----------|------------|
| Light | +12 | +0 |
| Heavy | +22 | +10 |

### Armor
| Armor | Defense | Mobility | Resistant | Vulnerable | Flank Def |
|-------|---------|----------|-----------|------------|-----------|
| None | 0 | 20 | - | - | 1.0 |
| Leather | 6 | 20 | piercing | blunt | 1.5 |
| Scale | 8 | 25 | slash | piercing | 0.0 |
| Brigandine | 10 | 23 | piercing, slash | blunt | 0.5 |
| Chain | 10 | 28 | slash | blunt, piercing | 0.25 |
| Plate | 12 | 30 | slash, blunt | piercing | 0.75 |

## Keyboard Controls

### Universal Controls
| Key | Action |
|-----|--------|
| **Arrow keys / WASD** | Pan camera |
| **Shift+Space** | Toggle combat mode |
| **Tab** (hold) | Show all character nameplates |

### Exploration Mode
| Key | Action |
|-----|--------|
| **1-6** | Trigger animations (idle, walk, run, attack, jump, die) |
| **8** | Debug: log character positions to console |
| **Click** | Move to clicked hex (pathfinding) |

### Combat Input Phase
| Key | Action |
|-----|--------|
| **1** | Activate Light Attack mode |
| **2** | Activate Heavy Attack mode |
| **Enter** | Repeat last attack (same direction + type) |
| **Space** | Skip turn (wait) |
| **Arrow Left** | Rotate facing counter-clockwise (60°) |
| **Arrow Right** | Rotate facing clockwise (60°) |
| **Ctrl+Arrow** | Rotate facing 2 steps (120°) |
| **Click adjacent hex** | Move to hex (normal) or attack hex (attack mode) |

### Edge Scrolling
Mouse near canvas edges scrolls camera.

## Combat System Flow

### Game States
1. **EXPLORATION** - Free movement, click anywhere to pathfind
2. **COMBAT_INPUT** - Turn-based input, select actions
3. **COMBAT_EXECUTION** - Sequential action resolution

### Combat Execution Order

**Move Phase:**
1. Filter characters with MOVE actions
2. Sort by moveSpeed (armor.mobility - str), then initiative
3. Execute moves sequentially with animation
4. Real-time occupancy check (move cancelled if target occupied)

**Action Phase:**
1. Filter characters with ATTACK actions
2. Sort by actionSpeed (weapon + shield + light attack modifier - dex), then initiative
   - Note: Sorting uses light attack speed for all characters regardless of chosen attack type
3. Execute attacks sequentially
4. Apply damage through buffer → health
5. Defeated characters play die animation

### Engagement System
- Characters track who is engaging them (`engagedBy` Set)
- Capacity limited by `engagedMax` (Cerebral Presence / 6)
- Flanking applies when defender at max engagement and attacker not in engagedBy
- Cleared when characters separate (non-adjacent)

### Combat Timing (const.js)
```javascript
COMBAT_PHASE_TRANSITION: 100   // ms between move and action phases
COMBAT_ATTACK_WINDUP: 100      // ms before attack resolves
COMBAT_ATTACK_RECOVERY: 500    // ms after attack before next character
```

## Debug Features

### Debug Panel
- Mouse position (world coordinates)
- Current hex (q, r)
- Asset loading status
- Camera position
- PC facing direction
- Current animation state

### Grid Toggle
Checkbox enables/disables hex grid overlay.

### Hex Marker Mode
Debug checkbox for map editing:
- Click hexes to mark/unmark as blocked
- Pre-populates with existing blocked hexes
- **Export Hexes** - outputs JSON to console
- **Clear Hexes** - removes all marks
- Disabled during combat

### Dev Logging
Set `DEV_LOG = true` in GameStateManager.js or AISystem.js for detailed combat logs with `[COMBAT DEV]` prefix.

## Sprite System

### Sprite Sets
Three sprite sets available, each with 8-directional variants:

| Set Key | Folder | Used By |
|---------|--------|---------|
| baseKnight | KnightBasic | Hero, Guards |
| swordShieldKnight | KnightSwordShield | Companion |
| swordKnight | KnightSword | Bandits |

### Animations
| Animation | Frames | Speed | Notes |
|-----------|--------|-------|-------|
| idle | 17 | 120ms | Looping |
| walk | 11-13 | default | Looping |
| run | 8 | default | Looping |
| attack | 15 | default | oneShot |
| jump | 9-11 | default | Looping |
| die | 16-27 | 60ms | oneShot, holds final |
| impact | 9 | default | oneShot |
| idle2 | 25 | 142ms | oneShot |

- Default speed: 17ms per frame (ANIMATION_SPEED)
- Frame size: 256x256 pixels
- Directions: dir1, dir2, dir3, dir5, dir6, dir7 (6 hex directions)

## Coordinate Systems

1. **Canvas coordinates** - Mouse position relative to canvas element
2. **World coordinates** - Pixel position in game world (before zoom/camera)
3. **Hex coordinates** - Axial (q, r) for grid logic

Conversion: canvas → world (factor camera/zoom) → hex (hexGrid.pixelToHex)

## Direction System

Only 6 directions matching hex grid neighbors:
```
dir6 = 0°   (East)
dir7 = 60°  (Southeast)
dir1 = 120° (Southwest)
dir2 = 180° (West)
dir3 = 240° (Northwest)
dir5 = 300° (Northeast)
```

Opposites: dir1↔dir5, dir2↔dir6, dir3↔dir7

## Area System

Baldur's Gate-style discrete areas with pre-rendered backgrounds.

### Area Structure
```
areas/
  bridge_crossing/
    area.json           <- Area definition
    background.jpg      <- Background image
```

### Area Definition Schema
```javascript
{
    "id": "bridge_crossing",
    "name": "Stone Bridge",
    "background": "background.jpg",
    "width": 1920,
    "height": 1080,
    "blocked": [{"q": 0, "r": 0, "type": "water"}],
    "spawns": {"default": {"q": 5, "r": -5}},
    "exits": [{
        "id": "north_exit",
        "hexes": [{"q": 0, "r": -10}],
        "target": "forest_path",
        "spawn": "south"
    }],
    "npcs": [{"templateId": "bandit", "hexQ": 3, "hexR": -7, "name": "Bandit"}]
}
```

### AreaManager API
```javascript
await areaManager.loadArea('bridge_crossing', 'default');
const exit = areaManager.getExitAt(pc.hexQ, pc.hexR);
const blocked = areaManager.isBlocked(q, r);
const bg = areaManager.getBackground();
const { width, height } = areaManager.getDimensions();
```
