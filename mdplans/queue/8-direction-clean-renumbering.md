# Option B: Clean 8-Direction Renumbering

**Status:** Queued for future implementation
**Priority:** Medium (architectural improvement)
**Effort:** Medium-High (6-8 hours)
**Risk:** Medium

## Goal

Renumber all facing directions from the current inconsistent mapping to a clean sequential dir1-8 system (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°).

## Current State Problems

The existing direction system is architecturally inconsistent:
- **Current mapping**: dir1=120°, dir2=180°, dir3=240°, dir5=300°, dir6=0°, dir7=60°
- **Missing**: dir4 and dir8 (not used in 6-direction system)
- **Problem**: Non-sequential numbering makes code harder to understand
- **Bug**: Game.js initializes PC with `facing: 'dir8'` which doesn't exist in 6-direction system

## Proposed Clean Mapping

```javascript
// Sequential clockwise from East (0°)
dir1 = 0°     // East
dir2 = 45°    // Southeast
dir3 = 90°    // South
dir4 = 135°   // Southwest
dir5 = 180°   // West
dir6 = 225°   // Northwest
dir7 = 270°   // North
dir8 = 315°   // Northeast
```

**Benefits:**
- Intuitive sequential numbering
- Easy mental model: dir1 starts at 0°, each increment adds 45°
- Standard game engine convention
- Clean slate for future development

## Implementation Plan

### Phase 1: Verify Sprite Angle Mapping

**CRITICAL FIRST STEP**: Determine what angles the sprite artist intended for dir1-8.

1. Create test scene that displays all 8 knight directions side-by-side
2. Visually inspect or load in-game to identify which sprite faces which direction
3. Document actual sprite→angle mapping
4. Options if sprites don't match proposed mapping:
   - Rename sprite files to match new convention
   - OR adjust code mapping to match sprites (less ideal)

**Files to inspect:**
- `sprites/KnightBasic/Idle/Knight_Idle_dir*.png` (visual inspection)
- `sprites/KnightBasic/Idle/Knight_Idle_dir*.json` (metadata has `"direction": 0-7`)

### Phase 2: Update Core Direction Functions

**File:** `js/const.js`

#### 1. Update `OPPOSITE_DIRECTION` mapping (lines 439-443)

```javascript
// Current (6 directions)
const OPPOSITE_DIRECTION = {
    dir1: 'dir5', dir5: 'dir1',  // 120° ↔ 300°
    dir2: 'dir6', dir6: 'dir2',  // 180° ↔ 0°
    dir3: 'dir7', dir7: 'dir3'   // 240° ↔ 60°
};

// New (8 directions, sequential)
const OPPOSITE_DIRECTION = {
    dir1: 'dir5', dir5: 'dir1',  // 0° ↔ 180° (E ↔ W)
    dir2: 'dir6', dir6: 'dir2',  // 45° ↔ 225° (SE ↔ NW)
    dir3: 'dir7', dir7: 'dir3',  // 90° ↔ 270° (S ↔ N)
    dir4: 'dir8', dir8: 'dir4'   // 135° ↔ 315° (SW ↔ NE)
};
```

#### 2. Rewrite `getFacingFromDelta()` (lines 450-461)

```javascript
// Current (6 directions, 60° segments)
export function getFacingFromDelta(dx, dy) {
    if (dx === 0 && dy === 0) return 'dir6'; // Default
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = (angle + 360) % 360;
    // 6 segments of 60° each, centered on hex directions
    if (angle >= 330 || angle < 30) return 'dir6';   // 0°
    else if (angle < 90) return 'dir7';              // 60°
    else if (angle < 150) return 'dir1';             // 120°
    else if (angle < 210) return 'dir2';             // 180°
    else if (angle < 270) return 'dir3';             // 240°
    else return 'dir5';                              // 300°
}

// New (8 directions, 45° segments, sequential)
export function getFacingFromDelta(dx, dy) {
    if (dx === 0 && dy === 0) return 'dir1'; // Default to East
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = (angle + 360) % 360;

    // 8 segments of 45° each, centered on 8-way directions
    if (angle >= 337.5 || angle < 22.5) return 'dir1';   // 0° (E)
    else if (angle < 67.5) return 'dir2';                // 45° (SE)
    else if (angle < 112.5) return 'dir3';               // 90° (S)
    else if (angle < 157.5) return 'dir4';               // 135° (SW)
    else if (angle < 202.5) return 'dir5';               // 180° (W)
    else if (angle < 247.5) return 'dir6';               // 225° (NW)
    else if (angle < 292.5) return 'dir7';               // 270° (N)
    else return 'dir8';                                  // 315° (NE)
}
```

#### 3. Update `rotateFacing()` (lines 490-497)

```javascript
// Current (6 directions)
export function rotateFacing(facing, clockwise, steps = 1) {
    const order = ['dir6', 'dir7', 'dir1', 'dir2', 'dir3', 'dir5'];
    const idx = order.indexOf(facing);
    if (idx === -1) return facing;
    const offset = clockwise ? steps : (6 - (steps % 6)) % 6;
    const newIdx = (idx + offset) % 6;
    return order[newIdx];
}

// New (8 directions, sequential)
export function rotateFacing(facing, clockwise, steps = 1) {
    const order = ['dir1', 'dir2', 'dir3', 'dir4', 'dir5', 'dir6', 'dir7', 'dir8'];
    const idx = order.indexOf(facing);
    if (idx === -1) return facing;
    const offset = clockwise ? steps : (8 - (steps % 8)) % 8;
    const newIdx = (idx + offset) % 8;
    return order[newIdx];
}
```

### Phase 3: Update Character Initialization

**File:** `js/Game.js`

Update all hardcoded facing values (lines 43, 88, 130, 172, 214, 256):

```javascript
// Example conversions (depends on desired starting directions)
// OLD → NEW
facing: 'dir8' → facing: 'dir8'  // (if dir8 becomes 315° NE)
facing: 'dir4' → facing: 'dir4'  // (if dir4 becomes 135° SW)
facing: 'dir5' → facing: 'dir5'  // 300° → 180° (now means West instead of NE)
facing: 'dir3' → facing: 'dir6'  // 240° (NW) → 225° (NW, close match)
facing: 'dir6' → facing: 'dir1'  // 0° (E) → 0° (E, same)
facing: 'dir2' → facing: 'dir5'  // 180° (W) → 180° (W, same)
```

**Important:** Actual conversions depend on:
1. What the sprites actually represent (Phase 1)
2. What direction you want each character to face initially

### Phase 4: Update Documentation

**Files to update:**

1. **CLAUDE.md** (line ~88):
   ```markdown
   # OLD
   - Sprites use 8-directional facing (dir1-dir8) with separate sprite sheets per direction

   # NEW
   - Sprites use 8-directional facing (dir1-8) in 45° increments clockwise from East:
     dir1=0° (E), dir2=45° (SE), dir3=90° (S), dir4=135° (SW),
     dir5=180° (W), dir6=225° (NW), dir7=270° (N), dir8=315° (NE)
   ```

2. **docs/reference.md** (Direction section):
   - Update all direction angle references
   - Fix comment that says "only 6 directions" (now using all 8)
   - Update flanking examples

3. **js/const.js comments** (lines 437-443):
   ```javascript
   // OLD
   // Only 6 directions used - matches hex grid neighbors (no pure N/S movement)
   // Hex angles: 0°→dir6, 60°→dir7, 120°→dir1, 180°→dir2, 240°→dir3, 300°→dir5

   // NEW
   // 8 directions for precise facing, even during hex-restricted combat movement
   // Sequential clockwise from East: dir1=0°, dir2=45°, dir3=90°, dir4=135°,
   // dir5=180°, dir6=225°, dir7=270°, dir8=315°
   // Opposite pairs: dir1↔dir5, dir2↔dir6, dir3↔dir7, dir4↔dir8
   ```

### Phase 5: Sprite File Renaming (if needed)

**Only if sprite angles don't match new mapping:**

Option A: Rename sprite files
```bash
# Example: if current dir1.png faces 120° but we want dir1=0°
# Need to map old files to new numbering
mv Knight_Idle_dir6.png Knight_Idle_dir1.png  # 0° stays dir1
mv Knight_Idle_dir7.png Knight_Idle_dir2.png  # 60°→45° (close enough)
# ... etc for all animations and sprite sets
```

Option B: Add sprite mapping layer in AssetManager.js
```javascript
// Map logical directions to physical sprite files
const SPRITE_DIR_MAPPING = {
    dir1: 'dir6',  // Want 0°, sprite file is named dir6
    dir2: 'dir7',  // Want 45°, sprite file is named dir7
    // ... etc
};
```

**Recommendation:** Only do this if absolutely necessary. Prefer adjusting code to match sprites.

## Testing Checklist

- [ ] Visual: Load game, verify all 8 character facings display correct sprites
- [ ] Rotation: Press ArrowLeft/Right, verify smooth clockwise/counter-clockwise rotation
- [ ] Movement: Move characters, verify they face movement direction correctly
- [ ] Combat: Enter combat, attack enemies, verify attackers face targets
- [ ] Flanking: Position enemy behind character, verify flanking detection works
- [ ] Edge cases: Test dx=0/dy=0, test all 8 cardinal/diagonal angles
- [ ] NPCs: Verify all NPC facing initializations display correctly
- [ ] PC: Verify player character sprite renders on game start
- [ ] All sprite sets: Test with KnightBasic, KnightSwordShield, KnightSword

## Risk Mitigation

1. **Branch before starting:** Create feature branch for clean rollback
2. **Test in isolation:** Create minimal test scene with 8 static knights
3. **Incremental validation:** Test each function change independently
4. **Sprite verification first:** Don't proceed with code until sprite angles confirmed
5. **Backup plan:** Keep Option A implementation ready if Option B proves too complex

## Files Modified

**Core changes:**
- `js/const.js` (3 functions + 1 constant)
- `js/Game.js` (6 facing initialization values)

**Documentation:**
- `CLAUDE.md`
- `docs/reference.md`

**Possibly sprites** (only if mapping doesn't match):
- All sprite PNG/JSON files in `sprites/KnightBasic/`, `sprites/KnightSword/`, `sprites/KnightSwordShield/`

## Success Criteria

- [ ] All 8 directions work in combat and exploration
- [ ] Direction numbering is sequential dir1-8 = 0°-315° in 45° increments
- [ ] No visual glitches or wrong-facing sprites
- [ ] Flanking mechanics still work correctly
- [ ] Code is more maintainable and understandable
- [ ] PC sprite renders correctly on game start (fixes existing bug)

## Estimated Effort

- **Phase 1** (Sprite verification): 1-2 hours
- **Phase 2** (Core functions): 2-3 hours
- **Phase 3** (Character init): 30 minutes
- **Phase 4** (Documentation): 1 hour
- **Phase 5** (Sprite renaming): 2-4 hours (if needed)
- **Testing**: 2-3 hours

**Total:** 6-13 hours (depending on sprite compatibility)

## Why Not Do This Now?

This is the "right" long-term solution, but Option A (minimal change) achieves the same functional goal with less risk:
- Option A: 3-4 hours, low risk
- Option B: 6-13 hours, medium risk

**Recommendation:** Ship Option A first, then evaluate if the inconsistent numbering is actually causing maintenance problems. If not, Option B may be unnecessary technical debt payoff.

## Related Issues

- Fixes bug where PC starts with `facing: 'dir8'` in 6-direction system
- Improves code readability for future developers
- Standardizes direction convention across codebase
- Makes documentation clearer and more intuitive
