# Phase 2 Refactoring Risk Analysis

**Date**: 2026-01-05
**Status**: Planning Phase

## Risk Assessment Summary

| Issue | Description | Risk Level | Lines Saved | Complexity | Recommendation |
|-------|-------------|------------|-------------|------------|----------------|
| #6 | State Check Consolidation | **VERY LOW** | ~15 | Low | **DO FIRST** |
| #2 | Hex Drawing Helpers | **MEDIUM** | ~70 | Medium | Do Second |
| #4 | UIManager Extraction | **MEDIUM-HIGH** | ~60 | High | Do Last |

---

## Issue #6: State Check Consolidation (LOWEST RISK)

### Overview
Consolidate four similar state check methods in `GameStateManager.js` into a single flexible method.

### Current Implementation

**Location**: `js/GameStateManager.js:479-494`

```javascript
canPlayerMove() {
    return this.currentState === GAME_STATES.EXPLORATION;
}

isInCombat() {
    return this.currentState === GAME_STATES.COMBAT_INPUT ||
           this.currentState === GAME_STATES.COMBAT_EXECUTION;
}

isInCombatInput() {
    return this.currentState === GAME_STATES.COMBAT_INPUT;
}

isInCombatExecution() {
    return this.currentState === GAME_STATES.COMBAT_EXECUTION;
}
```

### Current Usage Analysis

**Total Usages**: 4 external call sites

1. **Renderer.js:229** - `isInCombatInput()`
   ```javascript
   const inCombatInput = this.gameStateManager?.isInCombatInput();
   ```

2. **Renderer.js:231** - `isInCombatExecution()`
   ```javascript
   const inCombatExecution = this.gameStateManager?.isInCombatExecution();
   ```

3. **MovementSystem.js:177** - `isInCombat()`
   ```javascript
   if (character.currentAnimation === 'idle' && this.gameStateManager.isInCombat()) {
   ```

4. **InputHandler.js:134** - `canPlayerMove()`
   ```javascript
   if (!this.gameStateManager.canPlayerMove()) {
   ```

### Risk Analysis

**Risk Level**: VERY LOW ⭐

**Why Low Risk**:
- Only 4 external call sites to update
- Simple boolean logic, no side effects
- Easy to test (just verify state comparisons)
- No impact on rendering or combat logic
- Backwards compatible (can keep old methods as aliases)

**Potential Issues**:
- None identified (this is a pure logic refactor)

### Proposed Refactor Options

#### Option A: Single Variadic Method (Flexible)

```javascript
// New consolidated method
isInState(...states) {
    return states.includes(this.currentState);
}

// Keep old methods as aliases for backwards compatibility
canPlayerMove() {
    return this.isInState(GAME_STATES.EXPLORATION);
}

isInCombat() {
    return this.isInState(GAME_STATES.COMBAT_INPUT, GAME_STATES.COMBAT_EXECUTION);
}

isInCombatInput() {
    return this.isInState(GAME_STATES.COMBAT_INPUT);
}

isInCombatExecution() {
    return this.isInState(GAME_STATES.COMBAT_EXECUTION);
}
```

**Usage Example**:
```javascript
// More flexible than before
if (this.gameStateManager.isInState(GAME_STATES.COMBAT_INPUT, GAME_STATES.COMBAT_EXECUTION)) {
    // In combat
}
```

**Pros**:
- Fully backwards compatible
- Adds flexibility without breaking changes
- Can gradually migrate call sites
- No risk of breaking existing code

**Cons**:
- Doesn't actually remove the old methods (no line reduction)
- Slightly more verbose at call sites

---

#### Option B: Direct Replacement (DRY but Breaking)

```javascript
// Remove all old methods, only keep new one
isInState(...states) {
    return states.includes(this.currentState);
}
```

**Usage Example**:
```javascript
// Before
if (!this.gameStateManager.canPlayerMove()) { ... }

// After
if (!this.gameStateManager.isInState(GAME_STATES.EXPLORATION)) { ... }
```

**Pros**:
- True DRY principle
- Reduces method count by 3
- More flexible for future use

**Cons**:
- Less readable at call sites (lose semantic method names)
- Requires updating 4 call sites
- More verbose (need to import GAME_STATES at call sites)

---

#### Option C: Hybrid Approach (Recommended)

Keep most readable methods, consolidate only the redundant ones:

```javascript
// Keep semantic methods
canPlayerMove() {
    return this.currentState === GAME_STATES.EXPLORATION;
}

// Add flexible helper for multiple states
isInAnyState(...states) {
    return states.includes(this.currentState);
}

// Simplify isInCombat using new helper
isInCombat() {
    return this.isInAnyState(GAME_STATES.COMBAT_INPUT, GAME_STATES.COMBAT_EXECUTION);
}

// Keep these for readability
isInCombatInput() {
    return this.currentState === GAME_STATES.COMBAT_INPUT;
}

isInCombatExecution() {
    return this.currentState === GAME_STATES.COMBAT_EXECUTION;
}
```

**Pros**:
- No breaking changes
- Adds flexibility for future use
- Keeps readable method names
- Only removes ~3 lines but adds useful utility

**Cons**:
- Minimal line reduction (not worth the effort?)

---

### Recommendation

**Verdict**: **Option A or Skip This Refactor**

**Reasoning**:
- Current code is already quite readable
- The duplication is minimal and semantic
- Option A adds flexibility without risk, but doesn't reduce lines
- Option B achieves DRY but reduces readability
- Option C is middle ground but doesn't provide much value

**Conclusion**: This refactor is **OPTIONAL** and should only be done if you value the flexibility of `isInState()` for future use cases. The current implementation is perfectly acceptable.

---

## Issue #2: Hex Drawing Helpers (MEDIUM RISK)

### Overview
Extract repeated hex polygon path drawing code in `Renderer.js` into reusable helper methods.

### Risk Analysis

**Risk Level**: MEDIUM ⚠️

**Why Medium Risk**:
- **Touches rendering code** (visual regressions are easy to miss)
- **6 different call sites** to refactor
- Each call site has slightly different styling needs
- Canvas context state management can be tricky
- Need careful testing of all hex rendering modes

**Potential Issues**:
1. **Context State Leakage**: Canvas context state (fillStyle, strokeStyle) might not be properly saved/restored
2. **Visual Regressions**: Subtle rendering bugs (colors, transparency, borders)
3. **Performance**: Adding function calls in rendering hot path
4. **Edge Cases**: Special rendering modes might break (marked hexes, selected hexes, etc.)

### Current Duplication

**Locations** (6 instances):
1. `Renderer.js:175-186` - Base grid hex outline
2. `Renderer.js:211-218` - Blocked hex overlay
3. `Renderer.js:299-309` - Faction border fill
4. `Renderer.js:394-407` - Hover highlight
5. `Renderer.js:410-424` - Selected hex
6. `Renderer.js:427-441` - Marked hex (for editing)

**Pattern** (repeated 6 times):
```javascript
this.ctx.beginPath();
hexPoints.forEach((point, i) => {
    if (i === 0) {
        this.ctx.moveTo(point.x, point.y);
    } else {
        this.ctx.lineTo(point.x, point.y);
    }
});
this.ctx.closePath();
// Then fill/stroke with different styles
```

### Proposed Implementation

**New Helper Methods**:
```javascript
// Create hex path (doesn't render, just sets up the path)
_createHexPath(hexPoints) {
    this.ctx.beginPath();
    hexPoints.forEach((point, i) => {
        if (i === 0) {
            this.ctx.moveTo(point.x, point.y);
        } else {
            this.ctx.lineTo(point.x, point.y);
        }
    });
    this.ctx.closePath();
}

// Fill and/or stroke a hex with given styles
_renderHex(hexPoints, fillStyle, strokeStyle, lineWidth) {
    this._createHexPath(hexPoints);

    if (fillStyle) {
        this.ctx.fillStyle = fillStyle;
        this.ctx.fill();
    }

    if (strokeStyle) {
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.lineWidth = lineWidth || 1;
        this.ctx.stroke();
    }
}
```

**Simplified Call Sites**:
```javascript
// Before (7 lines)
this.ctx.beginPath();
hexPoints.forEach((point, i) => {
    if (i === 0) this.ctx.moveTo(point.x, point.y);
    else this.ctx.lineTo(point.x, point.y);
});
this.ctx.closePath();
this.ctx.fillStyle = "rgba(33, 150, 243, 0.25)";
this.ctx.fill();

// After (1 line)
this._renderHex(hexPoints, "rgba(33, 150, 243, 0.25)");
```

### Testing Requirements

**Must Verify** (manual testing):
1. Base grid rendering (white hex outlines)
2. Blocked hexes overlay (dark overlay when hovering)
3. Faction borders (colored fills and borders)
4. Hover highlights (blue glow on adjacent hexes)
5. Selected hex (light blue fill)
6. Marked hexes (orange fill for editing mode)
7. Gradient borders between factions (shared edges)

**Expected Line Reduction**: ~70 lines

---

## Issue #4: UIManager Extraction (HIGHEST RISK)

### Overview
Extract UI update logic from `Game.js:658-715` into a separate `UIManager` class.

### Risk Analysis

**Risk Level**: MEDIUM-HIGH 🔴

**Why High Risk**:
- **Touches game state management** (core orchestration)
- **Complex callback dependencies** (Game → GameStateManager → UIManager)
- **DOM manipulation** (must ensure elements exist)
- **State synchronization** (UI must stay in sync with game state)
- **57 lines of tightly coupled code**

**Potential Issues**:
1. **Race Conditions**: UI updates might happen out of order
2. **Stale References**: UIManager might reference old game state
3. **Missing Elements**: DOM elements might not exist during initialization
4. **Callback Hell**: Complex callback chains between Game, GameStateManager, UIManager
5. **Testing Difficulty**: UI code is hard to test without DOM

### Current Implementation

**Location**: `Game.js:658-715` (57 lines)

**Current Pattern**:
```javascript
updateGameStateUI() {
    const elements = this.elements;
    const currentState = this.gameStateManager.currentState;

    if (currentState === GAME_STATES.COMBAT_INPUT) {
        // Update combat input UI
        elements.stateIndicator.textContent = 'COMBAT - INPUT PHASE';
        elements.stateIndicator.className = 'state-indicator state-combat';
        // ... many more DOM updates ...
    } else if (currentState === GAME_STATES.COMBAT_EXECUTION) {
        // Update combat execution UI
        // ... many more DOM updates ...
    } else {
        // Update exploration UI
        // ... some DOM updates ...
    }
}
```

### Proposed Implementation

**New File**: `js/UIManager.js`

```javascript
export class UIManager {
    constructor(elements) {
        this.elements = elements;
    }

    updateForCombatInput(gameStateManager, game) {
        this.elements.stateIndicator.textContent = 'COMBAT - INPUT PHASE';
        this.elements.stateIndicator.className = 'state-indicator state-combat';
        // ... rest of combat input UI updates
    }

    updateForCombatExecution(gameStateManager, game) {
        // ... combat execution UI updates
    }

    updateForExploration() {
        // ... exploration UI updates
    }
}
```

**Challenges**:
1. **Dependency Injection**: UIManager needs references to Game, GameStateManager
2. **Callback Registration**: GameStateManager's `onStateChange` callback needs to call UIManager
3. **Initialization Order**: Must ensure DOM elements exist before UIManager is created
4. **State Coupling**: UIManager needs access to game state (PC, NPCs, turn number, etc.)

**Expected Line Reduction**: ~60 lines (moving code, not removing duplication)

---

## Final Recommendation

### Implementation Order

1. **Skip Issue #6** (State Check Consolidation)
   - Current code is fine and readable
   - Minimal value from refactoring
   - Only do if you want the flexibility of `isInState()`

2. **Do Issue #2 NEXT** (Hex Drawing Helpers)
   - Medium risk but high value (70 lines saved)
   - Clear duplication pattern
   - Good test: visual inspection of all hex rendering modes
   - Can be done incrementally (one hex type at a time)

3. **Do Issue #4 LAST** (UIManager Extraction)
   - Highest risk due to state management complexity
   - Benefits: separation of concerns, testability
   - Requires careful callback management
   - Should wait until after Issue #2 is stable

### Next Steps

**If proceeding with Issue #2**:
1. Create `_createHexPath()` helper method
2. Create `_renderHex()` helper method
3. Refactor one hex drawing method at a time
4. Test visually after each change
5. Verify all 6 rendering modes work correctly

**Testing Checklist for Issue #2**:
- [ ] Base hex grid renders correctly
- [ ] Blocked hexes show dark overlay when hovering
- [ ] Faction borders show correct colors
- [ ] Hover highlights work on adjacent hexes
- [ ] Selected hex shows light blue fill
- [ ] Marked hexes show orange fill
- [ ] Gradient borders between factions render correctly
- [ ] No visual regressions or flickering

---

**End of Risk Analysis**
