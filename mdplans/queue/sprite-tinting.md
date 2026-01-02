# Per-Character Sprite Tinting

## Overview
Add per-character color tinting using canvas multiply/source-atop compositing. Each character can have a unique tint color applied to their sprite at render time.

## Technique
Canvas compositing with `globalCompositeOperation`:
1. Draw sprite frame to offscreen canvas
2. Set composite mode to `'source-atop'` (tints while preserving transparency)
3. Fill with tint color at reduced opacity
4. Draw result to main canvas

**Why source-atop over multiply**: Multiply darkens significantly. Source-atop with partial opacity gives a more natural tint that preserves original brightness.

## Files to Modify

### 1. const.js
Add default tint colors to FACTIONS (optional fallback):
```javascript
FACTIONS: {
    pc:      { name: "PC", tintColor: null, ... },        // no tint (original)
    pc_ally: { name: "Companion", tintColor: "#4169E1", ... }, // blue tint
    bandit:  { name: "Bandit", tintColor: "#8B0000", ... },    // dark red
    guard:   { name: "Guard", tintColor: "#DAA520", ... }      // goldenrod
}
```

### 2. Game.js - Character Creation
Add `tintColor` property to characters:
```javascript
pc: {
    // ... existing properties
    tintColor: null,  // null = no tint, or "#RRGGBB"
}

enemy: {
    // ... existing properties
    tintColor: "#8B0000",  // dark red tint
}
```

### 3. Renderer.js - Core Implementation

**Add offscreen canvas** (initialize once):
```javascript
// In constructor or init
this.tintCanvas = document.createElement('canvas');
this.tintCtx = this.tintCanvas.getContext('2d');
this.tintCanvas.width = GAME_CONSTANTS.SPRITE_FRAME_SIZE;  // 256
this.tintCanvas.height = GAME_CONSTANTS.SPRITE_FRAME_SIZE; // 256
```

**Add tinting method**:
```javascript
getTintedFrame(sprite, frameX, frameY, frameSize, tintColor, tintOpacity = 0.4) {
    const ctx = this.tintCtx;
    ctx.clearRect(0, 0, frameSize, frameSize);

    // Draw the sprite frame
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sprite, frameX, frameY, frameSize, frameSize, 0, 0, frameSize, frameSize);

    // Apply tint
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tintColor;
    ctx.globalAlpha = tintOpacity;
    ctx.fillRect(0, 0, frameSize, frameSize);
    ctx.globalAlpha = 1.0;

    return this.tintCanvas;
}
```

**Modify drawCharacter()** (~line 530):
```javascript
// After calculating frameX, frameY, before ctx.drawImage:
let sourceImage = sprite;
let srcX = frameX;
let srcY = frameY;

if (character.tintColor) {
    sourceImage = this.getTintedFrame(sprite, frameX, frameY, frameSize, character.tintColor);
    srcX = 0;
    srcY = 0;
}

this.ctx.drawImage(
    sourceImage,
    srcX, srcY, frameSize, frameSize,
    drawX, drawY, frameSize, frameSize
);
```

## Optional Enhancements

### Tint Opacity Per Character
Add `tintOpacity` property (0.0-1.0) for fine control:
```javascript
character.tintColor = "#FFD700";
character.tintOpacity = 0.3;  // subtle gold tint
```

### Faction Fallback
If character has no tintColor, fall back to faction default:
```javascript
const tint = character.tintColor ?? FACTIONS[character.faction]?.spriteTint ?? null;
```

### Performance: Cached Tinted Sprites
For many characters with same tint, cache results:
```javascript
// Cache key: spriteSet + direction + animation + frame + tintColor
this.tintCache = new Map();
```
Not needed initially - per-frame tinting is fast enough for reasonable character counts.

## Implementation Order

1. Add `tintCanvas` and `tintCtx` to Renderer constructor
2. Add `getTintedFrame()` method to Renderer
3. Modify `drawCharacter()` to use tinting when `character.tintColor` is set
4. Add `tintColor` property to test character in Game.js
5. Test with different colors
6. (Optional) Add faction default tints to const.js

## Testing
- Set player `tintColor: null` (original appearance)
- Set one enemy `tintColor: "#8B0000"` (dark red)
- Set another enemy `tintColor: "#4B0082"` (indigo)
- Verify transparency preserved, animations work, performance acceptable
