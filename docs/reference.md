# Project Reference

Detailed reference material for the RPG prototype. For architectural guidance and development instructions, see [CLAUDE.md](../CLAUDE.md).

## Character Data Structure

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

## Coordinate Systems

Three coordinate systems in use:
1. **Canvas coordinates** - Mouse position relative to canvas element
2. **World coordinates** - Pixel coordinates in the game world (before zoom/camera)
3. **Hex coordinates** - Axial (q, r) coordinates for grid logic

Conversion flow: canvas → world (factor in camera/zoom) → hex (use hexGrid.pixelToHex).

## Rendering Order

Layers rendered in this order:
1. Background image
2. Hex grid (if enabled via checkbox)
3. Characters (sorted by Y position for proper overlap)
4. UI overlays (nameplates, health bars)

## Debug Features

In-game debug panel shows:
- Mouse position (world coordinates)
- Current hex (q, r coordinates)
- Asset loading status
- Camera position
- PC facing direction
- Current animation state

### Grid Toggle
Checkbox in debug panel enables/disables hex grid overlay for easier debugging.

## Keyboard Controls

| Key | Action |
|-----|--------|
| **1-6** | Trigger different animations |
| **7** | Spawn random enemy near player |
| **Shift+Space** | Toggle combat mode |
| **Space** | Skip turn (during combat) |
| **Arrow keys** | Camera scrolling |
| **Click** | Move character (exploration) or select hex (combat) |
| **Edge scrolling** | Mouse near canvas edges |

## Area System

The game uses a Baldur's Gate-style area system where the world is divided into discrete areas, each with its own pre-rendered background image and dimensions.

### Area Structure

```
areas/
  bridge_crossing/
    area.json           <- Area definition
    background.jpg      <- Background image
  forest_path/
    area.json
    background.jpg
```

### Area Definition Schema

```javascript
{
    "id": "bridge_crossing",           // Unique area identifier
    "name": "Stone Bridge",            // Display name
    "background": "background.jpg",    // Filename (relative to area folder)
    "width": 1920,                     // Area width in pixels
    "height": 1080,                    // Area height in pixels

    // Hexes that cannot be walked on
    "blocked": [
        {"q": 0, "r": 0, "type": "water"},
        {"q": 1, "r": 0, "type": "cliff"}
    ],

    // Named spawn points for character placement
    "spawns": {
        "default": {"q": 5, "r": -5},
        "north": {"q": 3, "r": -8},
        "south": {"q": 7, "r": -2}
    },

    // Transitions to other areas
    "exits": [
        {
            "id": "north_exit",
            "hexes": [{"q": 0, "r": -10}, {"q": 1, "r": -10}],
            "target": "forest_path",   // Target area ID
            "spawn": "south"           // Spawn point in target area
        }
    ],

    // Area-specific NPCs (optional)
    "npcs": [
        {
            "templateId": "bandit",
            "hexQ": 3, "hexR": -7,
            "name": "Bandit"
        }
    ]
}
```

### Area Loading Flow

1. Load area definition JSON
2. Load background image (cached for revisits)
3. Set world bounds to area dimensions
4. Rebuild/resize hex grid to fit new dimensions
5. Apply blocked hexes to pathfinding
6. Place characters at spawn point
7. Update camera bounds

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Native sizing** | Each area defines its own pixel dimensions; hex grid adapts |
| **Blocked hexes** | Terrain like water, cliffs, walls that block movement |
| **Exits** | Hex(es) that trigger transitions to other areas |
| **Spawns** | Named positions for placing characters when entering |
| **Area caching** | Definitions and images cached after first load |

### AreaManager API

```javascript
// Load and switch to an area
await areaManager.loadArea('bridge_crossing', 'default');

// Check for exit at character position
const exit = areaManager.getExitAt(pc.hexQ, pc.hexR);
if (exit) {
    await areaManager.transition(exit.targetArea, exit.targetSpawn);
}

// Check if a hex is blocked
const blocked = areaManager.isBlocked(q, r);

// Get current background image
const bg = areaManager.getBackground();

// Get current area dimensions
const { width, height } = areaManager.getDimensions();
```
