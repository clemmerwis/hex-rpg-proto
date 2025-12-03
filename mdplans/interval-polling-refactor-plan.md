# Interval Polling Refactor: Event-Based Callbacks Plan

## Executive Summary

Replace the fragile setInterval polling in GameStateManager's combat execution with an event-based callback system. This refactor will make movement completion detection immediate, eliminate timing bugs, and provide a foundation for future combat mechanics.

---

## Current Implementation Analysis

### Location
`js/GameStateManager.js` lines 148-169

### Current Code
```javascript
executeAction(character, action) {
    if (action.action === 'move') {
        const targetHex = action.target;
        const occupant = this.getCharacterAtHex(targetHex.q, targetHex.r);

        if (occupant && occupant !== character) {
            console.log(`Move cancelled: target hex (${targetHex.q}, ${targetHex.r}) occupied`);
            this.currentExecutionIndex++;
            this.executeNextAction();
            return;
        }

        character.movementQueue = [targetHex];

        let checkCount = 0;
        const checkMovementComplete = setInterval(() => {
            checkCount++;
            if (!character.isMoving) {
                clearInterval(checkMovementComplete);
                this.currentExecutionIndex++;
                this.executeNextAction();
            }

            if (checkCount > 100) {
                clearInterval(checkMovementComplete);
                console.error('Movement timeout');
                this.currentExecutionIndex++;
                this.executeNextAction();
            }
        }, GAME_CONSTANTS.COMBAT_CHECK_INTERVAL);
    } else {
        this.currentExecutionIndex++;
        this.executeNextAction();
    }
}
```

### Problems with Current Approach

1. **Polling Overhead**
   - Checks every 50ms (COMBAT_CHECK_INTERVAL) whether movement is complete
   - Wastes CPU cycles on repeated checks
   - Delays response by up to 50ms after movement completes

2. **Race Conditions**
   - If movement completes between polls, detection is delayed
   - Multiple interval timers may stack if execution logic changes
   - No guarantee intervals clear properly if state changes mid-execution

3. **Timeout Hardcoding**
   - 100 iterations × 50ms = 5 second timeout
   - Magic number (100) not in const.js
   - Timeout may fire prematurely for valid slow movement
   - Error handling just logs and continues (no recovery)

4. **Memory Leaks**
   - If GameStateManager is destroyed mid-interval, interval may persist
   - No cleanup on state transition out of COMBAT_EXECUTION
   - Intervals reference closures over character objects

5. **Testing Difficulty**
   - Hard to unit test because of time-dependent behavior
   - Cannot easily mock/stub timing
   - Async behavior makes tests flaky

6. **Lack of Composability**
   - Cannot chain multiple actions with dependencies
   - Cannot await movement completion in other contexts
   - Callback hell if we add more async actions (attacks, abilities)

---

## Event-Based Design

### Architecture

Implement a **callback registry** pattern where MovementSystem notifies listeners when movement completes.

### Key Components

1. **MovementSystem Enhancement**
   - Add callback support for movement completion
   - Call registered callbacks when `character.isMoving` becomes false
   - Support one-time callbacks (automatically unregister after firing)

2. **GameStateManager Integration**
   - Register callback before starting movement
   - Callback advances to next action in execution queue
   - Clean callback registration (no leaks)

3. **Error Handling**
   - Callbacks receive success/failure status
   - Timeout still exists but as failsafe only
   - Proper error propagation

---

## Detailed Implementation Plan

### Phase 1: Add Callback Support to MovementSystem

**File:** `js/MovementSystem.js`

**Changes:**

1. Add callback registry to constructor:
```javascript
constructor() {
    this.movementCompleteCallbacks = new Map(); // character -> callback
}
```

2. Add callback registration method:
```javascript
/**
 * Register a callback to fire when character completes movement
 * @param {Object} character - Character to watch
 * @param {Function} callback - Function to call on completion (receives success boolean)
 */
onMovementComplete(character, callback) {
    if (!character) {
        console.error('MovementSystem.onMovementComplete: Invalid character');
        return;
    }

    if (this.movementCompleteCallbacks.has(character)) {
        console.warn('MovementSystem.onMovementComplete: Overwriting existing callback');
    }

    this.movementCompleteCallbacks.set(character, callback);
}
```

3. Add callback removal method:
```javascript
/**
 * Remove movement complete callback for character
 * @param {Object} character - Character to stop watching
 */
removeMovementCallback(character) {
    this.movementCompleteCallbacks.delete(character);
}
```

4. Modify `updateCharacterMovement` to fire callbacks:

**Current logic (lines 75-77):**
```javascript
if (character.movementQueue.length === 0) {
    character.isMoving = false;
}
```

**New logic:**
```javascript
if (character.movementQueue.length === 0) {
    character.isMoving = false;

    // Fire movement complete callback if registered
    if (this.movementCompleteCallbacks.has(character)) {
        const callback = this.movementCompleteCallbacks.get(character);
        this.movementCompleteCallbacks.delete(character); // One-time callback

        // Call asynchronously to avoid blocking movement update
        setTimeout(() => {
            try {
                callback(true); // true = success
            } catch (error) {
                console.error('MovementSystem: Callback error', error);
            }
        }, 0);
    }
}
```

5. Add cleanup method for state transitions:
```javascript
/**
 * Clear all movement callbacks (call when exiting combat, etc.)
 */
clearAllCallbacks() {
    this.movementCompleteCallbacks.clear();
}
```

**Testing considerations:**
- Test callback fires when queue empties
- Test callback doesn't fire if character still has queued moves
- Test callback is one-time (doesn't fire twice)
- Test callback cleans up after firing
- Test multiple characters with independent callbacks

---

### Phase 2: Update GameStateManager to Use Callbacks

**File:** `js/GameStateManager.js`

**Changes:**

1. Inject MovementSystem dependency:

**Current constructor (line 17):**
```javascript
constructor(state, hexGrid, getCharacterAtHex) {
    this.state = state;
    this.hexGrid = hexGrid;
    this.getCharacterAtHex = getCharacterAtHex;
    this.aiSystem = new AISystem(hexGrid, getCharacterAtHex);
    // ...
}
```

**New constructor:**
```javascript
constructor(state, hexGrid, getCharacterAtHex, movementSystem) {
    this.state = state;
    this.hexGrid = hexGrid;
    this.getCharacterAtHex = getCharacterAtHex;
    this.movementSystem = movementSystem; // NEW DEPENDENCY
    this.aiSystem = new AISystem(hexGrid, getCharacterAtHex);
    // ...
}
```

2. Replace interval polling with callback:

**Current executeAction method (lines 143-169):**
```javascript
executeAction(character, action) {
    if (action.action === 'move') {
        const targetHex = action.target;
        const occupant = this.getCharacterAtHex(targetHex.q, targetHex.r);

        if (occupant && occupant !== character) {
            console.log(`Move cancelled: target hex (${targetHex.q}, ${targetHex.r}) occupied`);
            this.currentExecutionIndex++;
            this.executeNextAction();
            return;
        }

        character.movementQueue = [targetHex];

        let checkCount = 0;
        const checkMovementComplete = setInterval(() => {
            checkCount++;
            if (!character.isMoving) {
                clearInterval(checkMovementComplete);
                this.currentExecutionIndex++;
                this.executeNextAction();
            }

            if (checkCount > 100) {
                clearInterval(checkMovementComplete);
                console.error('Movement timeout');
                this.currentExecutionIndex++;
                this.executeNextAction();
            }
        }, GAME_CONSTANTS.COMBAT_CHECK_INTERVAL);
    } else {
        this.currentExecutionIndex++;
        this.executeNextAction();
    }
}
```

**New executeAction method:**
```javascript
executeAction(character, action) {
    if (action.action === 'move') {
        const targetHex = action.target;
        const occupant = this.getCharacterAtHex(targetHex.q, targetHex.r);

        // Validate target hex is not occupied
        if (occupant && occupant !== character) {
            console.log(`Move cancelled: target hex (${targetHex.q}, ${targetHex.r}) occupied`);
            this.currentExecutionIndex++;
            this.executeNextAction();
            return;
        }

        // Start movement
        character.movementQueue = [targetHex];

        // Register callback for movement completion
        this.movementSystem.onMovementComplete(character, (success) => {
            if (success) {
                console.log(`Movement complete for character at (${character.hexQ}, ${character.hexR})`);
            } else {
                console.error('Movement failed or timed out');
            }

            // Advance to next action
            this.currentExecutionIndex++;
            this.executeNextAction();
        });

        // Optional: Add failsafe timeout (safety net only, shouldn't normally trigger)
        const timeoutId = setTimeout(() => {
            // Check if callback already fired (character no longer has callback registered)
            if (this.movementSystem.movementCompleteCallbacks.has(character)) {
                console.error('Movement timeout - forcing completion');
                this.movementSystem.removeMovementCallback(character);

                // Force movement stop
                character.isMoving = false;
                character.movementQueue = [];

                // Advance to next action
                this.currentExecutionIndex++;
                this.executeNextAction();
            }
        }, GAME_CONSTANTS.MOVEMENT_TIMEOUT); // Add new constant: 5000ms

    } else if (action.action === 'wait') {
        // Wait action completes immediately
        console.log(`${character.faction} character waiting at (${character.hexQ}, ${character.hexR})`);
        this.currentExecutionIndex++;
        this.executeNextAction();
    } else {
        // Unknown action
        console.warn(`Unknown action type: ${action.action}`);
        this.currentExecutionIndex++;
        this.executeNextAction();
    }
}
```

3. Add cleanup when exiting combat:

**Current setState method (line 185):**
```javascript
setState(newState) {
    this.currentState = newState;
    console.log('Game state changed to:', newState);
}
```

**New setState method:**
```javascript
setState(newState) {
    // Clean up callbacks when leaving combat execution
    if (this.currentState === this.GAME_STATES.COMBAT_EXECUTION
        && newState !== this.GAME_STATES.COMBAT_EXECUTION) {
        this.movementSystem.clearAllCallbacks();
        console.log('Cleared movement callbacks on state exit');
    }

    this.currentState = newState;
    console.log('Game state changed to:', newState);
}
```

---

### Phase 3: Update Game.js to Wire Dependencies

**File:** `js/Game.js`

**Changes:**

**Current GameStateManager initialization (line 69):**
```javascript
this.gameStateManager = new GameStateManager(
    this.state,
    this.hexGrid,
    this.getCharacterAtHex.bind(this)
);
```

**New initialization:**
```javascript
this.gameStateManager = new GameStateManager(
    this.state,
    this.hexGrid,
    this.getCharacterAtHex.bind(this),
    this.movementSystem  // Add MovementSystem dependency
);
```

**Note:** This requires MovementSystem to be initialized before GameStateManager. Check current initialization order in Game.js constructor.

**Current order (lines 49-70):**
```javascript
this.hexGrid = new HexGrid(GAME_CONSTANTS.HEX_SIZE);
this.pathfinding = new Pathfinding(this.hexGrid, this.getCharacterAtHex.bind(this));
this.gameStateManager = new GameStateManager(...);
this.movementSystem = new MovementSystem(this.hexGrid);
```

**Required order:**
```javascript
this.hexGrid = new HexGrid(GAME_CONSTANTS.HEX_SIZE);
this.pathfinding = new Pathfinding(this.hexGrid, this.getCharacterAtHex.bind(this));
this.movementSystem = new MovementSystem(this.hexGrid);  // MOVE UP
this.gameStateManager = new GameStateManager(
    this.state,
    this.hexGrid,
    this.getCharacterAtHex.bind(this),
    this.movementSystem  // NOW AVAILABLE
);
```

---

### Phase 4: Update const.js

**File:** `js/const.js`

**Changes:**

Remove obsolete constant:
```javascript
COMBAT_CHECK_INTERVAL: 50,  // DELETE THIS LINE
```

Add new failsafe constant:
```javascript
MOVEMENT_TIMEOUT: 5000,  // Failsafe timeout for movement (ms), should never trigger in normal operation
```

**Line location:** Add to GAME_CONSTANTS object (~line 15)

---

### Phase 5: Testing & Validation

#### Manual Testing Checklist

1. **Basic Movement**
   - [ ] Enter combat mode (Shift+Space)
   - [ ] Select adjacent hex to move
   - [ ] Verify character moves smoothly
   - [ ] Verify next character's turn begins immediately after movement completes
   - [ ] Check console for "Movement complete" logs

2. **Wait Action**
   - [ ] Enter combat, press Space to skip turn
   - [ ] Verify turn advances immediately (no delay)

3. **Occupancy Conflict**
   - [ ] Two characters target same hex
   - [ ] First character moves successfully
   - [ ] Second character's move cancels immediately
   - [ ] Verify turn advances without delay

4. **Multiple Enemies**
   - [ ] Spawn 5+ enemies (press 7 multiple times)
   - [ ] Enter combat
   - [ ] Verify all enemies move in sequence with no delays
   - [ ] Check for memory leaks (no stacking intervals)

5. **State Transition**
   - [ ] Start combat
   - [ ] Exit combat mid-execution (Shift+Space)
   - [ ] Verify callbacks are cleaned up
   - [ ] Re-enter combat, verify system still works

6. **Long-Distance Movement**
   - [ ] Set up character far from target
   - [ ] Enter combat, select move
   - [ ] Verify long interpolation completes correctly
   - [ ] Verify timeout doesn't fire prematurely

#### Automated Testing

Create `tests/MovementSystem.test.js`:

```javascript
// Test callback registration
test('onMovementComplete registers callback', () => {
    const movementSystem = new MovementSystem(mockHexGrid);
    const character = { isMoving: true };
    const callback = jest.fn();

    movementSystem.onMovementComplete(character, callback);

    expect(movementSystem.movementCompleteCallbacks.has(character)).toBe(true);
});

// Test callback fires on completion
test('callback fires when movement completes', () => {
    const movementSystem = new MovementSystem(mockHexGrid);
    const character = {
        isMoving: true,
        movementQueue: [{ q: 1, r: 0 }],
        hexQ: 0, hexR: 0,
        pixelX: 0, pixelY: 0
    };
    const callback = jest.fn();

    movementSystem.onMovementComplete(character, callback);

    // Simulate movement completion
    character.movementQueue = [];
    movementSystem.updateCharacterMovement(character, 16, mockAnimations);

    // Wait for async callback
    setTimeout(() => {
        expect(callback).toHaveBeenCalledWith(true);
    }, 10);
});

// Test callback is one-time
test('callback only fires once', () => {
    const movementSystem = new MovementSystem(mockHexGrid);
    const character = { isMoving: true, movementQueue: [] };
    const callback = jest.fn();

    movementSystem.onMovementComplete(character, callback);

    // Trigger completion twice
    movementSystem.updateCharacterMovement(character, 16, mockAnimations);
    movementSystem.updateCharacterMovement(character, 16, mockAnimations);

    setTimeout(() => {
        expect(callback).toHaveBeenCalledTimes(1);
    }, 10);
});

// Test cleanup
test('clearAllCallbacks removes all callbacks', () => {
    const movementSystem = new MovementSystem(mockHexGrid);
    const char1 = { isMoving: true };
    const char2 = { isMoving: true };

    movementSystem.onMovementComplete(char1, jest.fn());
    movementSystem.onMovementComplete(char2, jest.fn());

    expect(movementSystem.movementCompleteCallbacks.size).toBe(2);

    movementSystem.clearAllCallbacks();

    expect(movementSystem.movementCompleteCallbacks.size).toBe(0);
});
```

#### Performance Testing

1. **Baseline (current interval approach):**
   - Spawn 10 enemies
   - Enter combat
   - Measure time from turn start to turn complete
   - Count setInterval calls in profiler

2. **After refactor (callback approach):**
   - Same test scenario
   - Measure time improvement
   - Verify no setInterval calls except failsafe timeout

**Expected results:**
- 50-100ms faster turn execution per character
- Zero polling overhead in profiler
- Immediate turn transitions (within 1 frame)

---

## Edge Cases & Error Handling

### Edge Case 1: Character Removed During Movement

**Scenario:** Character is defeated or removed from game while moving

**Current behavior:** Interval keeps polling deleted object (memory leak)

**New behavior:**
- MovementSystem holds weak references or checks existence
- Callback doesn't fire if character no longer in game state
- Timeout cleanup still runs

**Implementation:**
```javascript
onMovementComplete(character, callback) {
    this.movementCompleteCallbacks.set(character, {
        callback: callback,
        characterId: character.id  // Assume characters have unique IDs
    });
}

// In updateCharacterMovement:
if (this.movementCompleteCallbacks.has(character)) {
    const callbackData = this.movementCompleteCallbacks.get(character);

    // Verify character still exists in game (add validation function)
    if (this.isCharacterValid(character)) {
        callbackData.callback(true);
    } else {
        console.warn('Character removed before movement complete');
    }

    this.movementCompleteCallbacks.delete(character);
}
```

### Edge Case 2: State Transition Mid-Movement

**Scenario:** User exits combat (Shift+Space) while character is moving

**Current behavior:** Interval may continue polling, turn advancement fails

**New behavior:**
- setState clears all callbacks
- Movements continue (exploration mode) but no turn advancement
- Failsafe timeout cleans up

**Already handled by Phase 2, Step 3**

### Edge Case 3: Rapid State Transitions

**Scenario:** Enter combat, exit, re-enter quickly

**Current behavior:** Multiple interval timers may stack

**New behavior:**
- Each state transition clears callbacks
- New combat creates fresh callback registrations
- No stacking possible

**Already handled by Phase 2, Step 3**

### Edge Case 4: Callback Throws Exception

**Scenario:** Bug in GameStateManager causes callback to throw

**Current behavior:** Would propagate and crash interval

**New behavior:**
- Try-catch in callback invocation (already in Phase 1, Step 4)
- Error logged, execution continues
- Turn advancement happens (fail-safe to failing-open)

### Edge Case 5: Multiple Overlapping Callbacks

**Scenario:** Dev error - callback registered twice for same character

**Current behavior:** N/A

**New behavior:**
- Warning logged (already in Phase 1, Step 2)
- Old callback overwritten
- First completion fires the most recent callback

---

## Rollback Strategy

If critical bugs are discovered after merge:

### Rollback Checklist

1. **Revert Git Commit**
   ```bash
   git revert <commit-hash>
   ```

2. **Restore Original Code**
   - GameStateManager.executeAction: Restore setInterval polling
   - Remove MovementSystem callback methods
   - Remove MovementSystem dependency from GameStateManager constructor
   - Restore Game.js initialization order
   - Restore COMBAT_CHECK_INTERVAL constant

3. **Test Rollback**
   - Verify combat still works with old system
   - Check for any orphaned callback references

### Partial Rollback (Keep Callback Infrastructure)

If only GameStateManager integration has bugs:
- Keep MovementSystem callback methods
- Revert GameStateManager.executeAction only
- Keep using intervals temporarily
- Fix bug, then re-integrate

---

## Success Criteria

This refactor is successful if:

1. **Functional Requirements**
   - [ ] Combat execution advances turns immediately when movement completes
   - [ ] No timing delays between character actions
   - [ ] All existing combat features still work (occupancy checks, wait action, turn cycling)
   - [ ] State transitions don't leak callbacks or cause errors

2. **Performance Requirements**
   - [ ] Zero setInterval polling during normal operation
   - [ ] Turn execution 50ms+ faster per character
   - [ ] No memory leaks over 100+ combat turns
   - [ ] Failsafe timeout never triggers in normal gameplay

3. **Code Quality Requirements**
   - [ ] No magic numbers (all constants in const.js)
   - [ ] Clear error handling and logging
   - [ ] Follows existing code style
   - [ ] Maintains dependency injection pattern
   - [ ] Well-commented for future developers

4. **Extensibility Requirements**
   - [ ] Easy to add callbacks for other async actions (attacks, abilities)
   - [ ] Pattern is reusable for future systems (animation completion, pathfinding)
   - [ ] Doesn't block future combat enhancements

---

## Future Enhancements (Out of Scope)

Once this refactor is complete, consider:

1. **Promise-Based Movement**
   - Return Promise from movement initiation
   - Async/await in GameStateManager
   - Chain multiple actions with .then()

2. **Event Emitter Pattern**
   - MovementSystem extends EventEmitter
   - Subscribe to 'movementComplete', 'movementStart', 'movementCancelled'
   - Multiple listeners per event

3. **Action Queue System**
   - Abstract action execution into reusable queue
   - Each action (move, attack, ability) returns Promise
   - Queue automatically advances when actions resolve

4. **Animation State Machine**
   - Similar callback pattern for animation completion
   - Transition from 'walk' to 'attack' to 'idle'
   - Sync combat actions with animation timing

---

## Summary

This refactor eliminates fragile interval polling in favor of immediate event-based callbacks. The changes are localized to MovementSystem and GameStateManager, with minimal impact on other modules. The new system is faster, more maintainable, and provides a foundation for future combat mechanics.

**Estimated Effort:** 2-4 hours
**Risk Level:** Low (easy to rollback, well-isolated changes)
**Impact:** High (fixes core timing issues, enables future features)
