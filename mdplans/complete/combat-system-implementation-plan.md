# CombatSystem.js Implementation Plan

## Executive Summary

Create a new `CombatSystem.js` module to handle damage calculation, attack resolution, and combat effects. This module will integrate with the existing combat flow in GameStateManager and enable ATTACK actions alongside existing MOVE/WAIT actions.

---

## Architecture Overview

### Module Responsibilities

**CombatSystem.js** will handle:
1. Damage calculation with attack/defense mechanics
2. Hit/miss/critical strike resolution
3. Health modification and character defeat detection
4. Combat logging and event reporting
5. Integration with animation system for attack/die animations

**Does NOT handle:**
- Turn order (GameStateManager responsibility)
- Action execution flow (GameStateManager responsibility)
- AI decision making (AISystem responsibility)
- Animation frame updates (MovementSystem responsibility)

---

## Current System Analysis

### Character Data Structure (Game.js lines 35-97)

**Current properties:**
```javascript
{
    hexQ, hexR,                    // Position
    pixelX, pixelY,
    movementQueue, isMoving,
    facing, currentAnimation,
    animationFrame, animationTimer,
    name, health, maxHealth,
    faction                        // 'player', 'enemy', 'ally', 'neutral'
}
```

**Missing combat stats:**
- attack (base damage)
- defense (damage reduction)
- accuracy (hit chance)
- critChance (critical strike chance)
- critMultiplier (damage multiplier on crit)

### Action System (GameStateManager.js)

**Current actions:**
```javascript
COMBAT_ACTIONS = {
    MOVE: 'move',
    WAIT: 'wait'
}
```

**Action structure:**
```javascript
{ action: 'move', target: { q: 5, r: -3 } }
{ action: 'wait', target: null }
```

**Execution pattern:**
- Sequential processing via `executeNextAction()`
- Callback-based completion (movement callbacks, setTimeout)
- Recursive call to `executeNextAction()` after each action completes

---

## Implementation Plan

### Phase 1: Define Combat Stats

**File:** `js/const.js`

Add combat stat configurations:

```javascript
// After FACTIONS definition (line 67)

// Combat Stats
export const COMBAT_STATS = {
    // Base stats for different character types
    player: {
        attack: 15,
        defense: 8,
        accuracy: 0.85,        // 85% hit chance
        critChance: 0.15,      // 15% critical strike chance
        critMultiplier: 1.5    // 50% bonus damage on crit
    },
    enemy: {
        attack: 12,
        defense: 5,
        accuracy: 0.75,
        critChance: 0.10,
        critMultiplier: 1.3
    },
    ally: {
        attack: 13,
        defense: 7,
        accuracy: 0.80,
        critChance: 0.12,
        critMultiplier: 1.4
    },
    neutral: {
        attack: 10,
        defense: 6,
        accuracy: 0.70,
        critChance: 0.05,
        critMultiplier: 1.2
    }
};

// Damage calculation constants
export const DAMAGE_CONSTANTS = {
    BASE_DAMAGE_VARIANCE: 0.2,     // ±20% random variance
    MIN_DAMAGE: 1,                  // Minimum damage dealt
    DEFENSE_REDUCTION_FACTOR: 0.5,  // Each defense point reduces damage by 0.5
    MISS_DAMAGE: 0                  // Damage dealt on miss
};
```

**Testing:** Ensure constants are exported and importable.

---

### Phase 2: Update Character Initialization

**File:** `js/Game.js`

**Location:** Character definitions (lines 35-97)

Add combat stats to PC:
```javascript
pc: {
    // ... existing properties ...
    health: 85,
    maxHealth: 100,
    faction: 'player',

    // NEW: Combat stats
    attack: COMBAT_STATS.player.attack,
    defense: COMBAT_STATS.player.defense,
    accuracy: COMBAT_STATS.player.accuracy,
    critChance: COMBAT_STATS.player.critChance,
    critMultiplier: COMBAT_STATS.player.critMultiplier,

    movementQueue: [],
    // ...
}
```

Add combat stats to NPCs:
```javascript
npcs: [
    {
        // ... existing properties ...
        faction: 'ally',

        // NEW: Combat stats
        attack: COMBAT_STATS.ally.attack,
        defense: COMBAT_STATS.ally.defense,
        accuracy: COMBAT_STATS.ally.accuracy,
        critChance: COMBAT_STATS.ally.critChance,
        critMultiplier: COMBAT_STATS.ally.critMultiplier,
        // ...
    },
    {
        faction: 'enemy',

        // NEW: Combat stats
        attack: COMBAT_STATS.enemy.attack,
        defense: COMBAT_STATS.enemy.defense,
        accuracy: COMBAT_STATS.enemy.accuracy,
        critChance: COMBAT_STATS.enemy.critChance,
        critMultiplier: COMBAT_STATS.enemy.critMultiplier,
        // ...
    }
]
```

**Also update `spawnEnemy()` method** (around line 290) to include combat stats:
```javascript
spawnEnemy() {
    const enemy = {
        // ... existing properties ...
        faction: 'enemy',

        // NEW: Combat stats
        attack: COMBAT_STATS.enemy.attack,
        defense: COMBAT_STATS.enemy.defense,
        accuracy: COMBAT_STATS.enemy.accuracy,
        critChance: COMBAT_STATS.enemy.critChance,
        critMultiplier: COMBAT_STATS.enemy.critMultiplier,

        movementQueue: [],
        // ...
    };
    this.state.npcs.push(enemy);
}
```

**Testing:** Load game, inspect PC and NPC objects in console to verify stats exist.

---

### Phase 3: Create CombatSystem Module

**File:** `js/CombatSystem.js` (NEW FILE)

**Full implementation:**

```javascript
import { DAMAGE_CONSTANTS } from './const.js';

export class CombatSystem {
    constructor(hexGrid, getCharacterAtHex, movementSystem) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.movementSystem = movementSystem;

        // Combat event callbacks
        this.onCombatEvent = null;  // For logging combat events
    }

    /**
     * Execute an attack from attacker to defender
     * @param {Object} attacker - Attacking character
     * @param {Object} defender - Defending character
     * @returns {Object} Combat result: { hit, critical, damage, defenderDefeated }
     */
    executeAttack(attacker, defender) {
        if (!attacker || !defender) {
            console.error('CombatSystem.executeAttack: Invalid attacker or defender');
            return { hit: false, critical: false, damage: 0, defenderDefeated: false };
        }

        // Determine if attack hits
        const hit = this.rollHit(attacker.accuracy);

        if (!hit) {
            const result = {
                hit: false,
                critical: false,
                damage: 0,
                defenderDefeated: false
            };

            this.logCombatEvent(attacker, defender, result);
            return result;
        }

        // Determine if attack is critical
        const critical = this.rollCritical(attacker.critChance);

        // Calculate damage
        const damage = this.calculateDamage(attacker, defender, critical);

        // Apply damage
        const defenderDefeated = this.applyDamage(defender, damage);

        const result = {
            hit: true,
            critical: critical,
            damage: damage,
            defenderDefeated: defenderDefeated
        };

        this.logCombatEvent(attacker, defender, result);
        return result;
    }

    /**
     * Roll to determine if attack hits
     * @param {Number} accuracy - Hit chance (0-1)
     * @returns {Boolean} True if hit
     */
    rollHit(accuracy) {
        return Math.random() < accuracy;
    }

    /**
     * Roll to determine if attack is critical
     * @param {Number} critChance - Critical chance (0-1)
     * @returns {Boolean} True if critical
     */
    rollCritical(critChance) {
        return Math.random() < critChance;
    }

    /**
     * Calculate damage dealt
     * @param {Object} attacker - Attacking character
     * @param {Object} defender - Defending character
     * @param {Boolean} critical - Is this a critical strike?
     * @returns {Number} Damage amount
     */
    calculateDamage(attacker, defender, critical) {
        // Base damage = attacker's attack stat
        let damage = attacker.attack;

        // Apply critical multiplier
        if (critical) {
            damage *= attacker.critMultiplier;
        }

        // Apply random variance (±20%)
        const variance = 1 + (Math.random() * 2 - 1) * DAMAGE_CONSTANTS.BASE_DAMAGE_VARIANCE;
        damage *= variance;

        // Apply defender's defense (each defense point reduces damage by 0.5)
        const defenseReduction = defender.defense * DAMAGE_CONSTANTS.DEFENSE_REDUCTION_FACTOR;
        damage = Math.max(DAMAGE_CONSTANTS.MIN_DAMAGE, damage - defenseReduction);

        // Round to integer
        return Math.round(damage);
    }

    /**
     * Apply damage to character
     * @param {Object} character - Character receiving damage
     * @param {Number} damage - Damage amount
     * @returns {Boolean} True if character was defeated
     */
    applyDamage(character, damage) {
        character.health -= damage;
        character.health = Math.max(0, character.health);  // Clamp to 0

        const defeated = character.health <= 0;

        if (defeated) {
            this.handleCharacterDefeat(character);
        }

        return defeated;
    }

    /**
     * Handle character defeat
     * @param {Object} character - Defeated character
     */
    handleCharacterDefeat(character) {
        // Trigger death animation
        character.currentAnimation = 'die';
        character.isMoving = false;
        character.movementQueue = [];

        console.log(`${character.name} has been defeated!`);
    }

    /**
     * Check if character is defeated
     * @param {Object} character - Character to check
     * @returns {Boolean} True if defeated (health <= 0)
     */
    isCharacterDefeated(character) {
        return character.health <= 0;
    }

    /**
     * Heal character
     * @param {Object} character - Character to heal
     * @param {Number} amount - Heal amount
     */
    healCharacter(character, amount) {
        character.health += amount;
        character.health = Math.min(character.maxHealth, character.health);  // Clamp to max
    }

    /**
     * Log combat event for UI/debugging
     * @param {Object} attacker - Attacking character
     * @param {Object} defender - Defending character
     * @param {Object} result - Combat result
     */
    logCombatEvent(attacker, defender, result) {
        if (!result.hit) {
            console.log(`${attacker.name} attacks ${defender.name} but MISSES!`);
        } else if (result.critical) {
            console.log(`${attacker.name} lands a CRITICAL HIT on ${defender.name} for ${result.damage} damage!`);
        } else {
            console.log(`${attacker.name} hits ${defender.name} for ${result.damage} damage`);
        }

        if (result.defenderDefeated) {
            console.log(`${defender.name} has been defeated!`);
        }

        // Fire callback if registered
        if (this.onCombatEvent) {
            this.onCombatEvent({
                attacker: attacker,
                defender: defender,
                result: result
            });
        }
    }

    /**
     * Get valid attack targets for character
     * @param {Object} character - Character attacking
     * @param {Array} allCharacters - All characters in combat
     * @returns {Array} Array of valid target characters
     */
    getValidAttackTargets(character, allCharacters) {
        const neighbors = this.hexGrid.getNeighbors({
            q: character.hexQ,
            r: character.hexR
        });

        const targets = [];
        for (const hex of neighbors) {
            const targetChar = this.getCharacterAtHex(hex.q, hex.r);

            // Valid target: exists, not self, different faction
            if (targetChar && targetChar !== character && targetChar.faction !== character.faction) {
                targets.push(targetChar);
            }
        }

        return targets;
    }

    /**
     * Check if hex contains a valid attack target
     * @param {Number} hexQ - Hex Q coordinate
     * @param {Number} hexR - Hex R coordinate
     * @param {Object} attacker - Attacking character
     * @returns {Boolean} True if hex contains valid target
     */
    isValidAttackTarget(hexQ, hexR, attacker) {
        const target = this.getCharacterAtHex(hexQ, hexR);

        if (!target) return false;
        if (target === attacker) return false;
        if (target.faction === attacker.faction) return false;

        // Check adjacency (melee attack range = 1)
        const distance = this.hexGrid.hexDistance(
            { q: attacker.hexQ, r: attacker.hexR },
            { q: hexQ, r: hexR }
        );

        return distance === 1;
    }
}
```

**Testing:**
- Create CombatSystem instance
- Call calculateDamage with mock characters
- Verify damage formulas work correctly
- Test hit/miss/crit rolls with known seeds

---

### Phase 4: Integrate CombatSystem into Game.js

**File:** `js/Game.js`

**Location:** After MovementSystem initialization (around line 158)

**Add import:**
```javascript
import { CombatSystem } from './CombatSystem.js';
```

**Initialize in `initializeModules()` method:**
```javascript
// After MovementSystem initialization
this.movementSystem = new MovementSystem({
    hexGrid: this.hexGrid,
    game: this.state,
    gameStateManager: null,
    animationConfig: ANIMATION_CONFIGS
});

// NEW: Initialize CombatSystem
this.combatSystem = new CombatSystem(
    this.hexGrid,
    this.getCharacterAtHex.bind(this),
    this.movementSystem
);

// Then GameStateManager
this.gameStateManager = new GameStateManager(
    this.state,
    this.hexGrid,
    this.getCharacterAtHex.bind(this),
    this.movementSystem,
    this.combatSystem  // NEW: Pass CombatSystem
);
```

**Add callback in `setupCallbacks()` method:**
```javascript
// After MovementSystem callbacks (around line 247)

// CombatSystem callbacks
this.combatSystem.onCombatEvent = (event) => {
    // Could update combat log UI here in future
    console.log('Combat event:', event);
};
```

**Testing:**
- Verify game loads without errors
- Check console for CombatSystem initialization
- Verify combatSystem is accessible via this.combatSystem

---

### Phase 5: Update GameStateManager to Accept CombatSystem

**File:** `js/GameStateManager.js`

**Update constructor (line 17):**
```javascript
constructor(game, hexGrid, getCharacterAtHex, movementSystem, combatSystem) {
    this.game = game;
    this.hexGrid = hexGrid;
    this.getCharacterAtHex = getCharacterAtHex;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;  // NEW
    this.aiSystem = new AISystem(hexGrid, getCharacterAtHex);
    // ...
}
```

**Update COMBAT_ACTIONS (line 11):**
```javascript
export const COMBAT_ACTIONS = {
    MOVE: 'move',
    WAIT: 'wait',
    ATTACK: 'attack'  // NEW
};
```

**Testing:**
- Verify GameStateManager accepts new parameter
- Verify COMBAT_ACTIONS.ATTACK is defined

---

### Phase 6: Implement Attack Action Execution

**File:** `js/GameStateManager.js`

**Location:** `executeNextAction()` method (around line 127)

**Add ATTACK case before MOVE case:**

```javascript
executeNextAction() {
    if (this.currentExecutionIndex >= this.executionQueue.length) {
        // All actions executed, next turn
        this.turnNumber++;
        this.setState(GAME_STATES.COMBAT_INPUT);
        return;
    }

    const character = this.executionQueue[this.currentExecutionIndex];
    const action = this.characterActions.get(character);

    // NEW: Handle ATTACK action
    if (action.action === COMBAT_ACTIONS.ATTACK && action.target) {
        const targetChar = this.getCharacterAtHex(action.target.q, action.target.r);

        // Validate target still exists and is valid
        if (!targetChar) {
            console.log(`${character.name}'s attack target no longer exists`);
            this.currentExecutionIndex++;
            this.executeNextAction();
            return;
        }

        if (!this.combatSystem.isValidAttackTarget(action.target.q, action.target.r, character)) {
            console.log(`${character.name}'s attack target is no longer valid`);
            this.currentExecutionIndex++;
            this.executeNextAction();
            return;
        }

        // Set attacker to face target
        const dx = targetChar.pixelX - character.pixelX;
        const dy = targetChar.pixelY - character.pixelY;
        this.movementSystem.updateFacing(character, dx, dy);

        // Trigger attack animation
        character.currentAnimation = 'attack';

        // Execute attack after animation starts
        setTimeout(() => {
            // Execute combat
            const result = this.combatSystem.executeAttack(character, targetChar);

            // Wait for attack animation to complete (frameCount * ANIMATION_SPEED)
            const attackAnimConfig = this.movementSystem.animationConfig['attack'];
            const animationDuration = attackAnimConfig.frameCount * GAME_CONSTANTS.ANIMATION_SPEED;

            setTimeout(() => {
                // Return attacker to idle
                character.currentAnimation = 'idle';

                // If defender was defeated, handle death animation
                if (result.defenderDefeated) {
                    // Death animation already set by combatSystem.handleCharacterDefeat()
                    // Wait for death animation to play
                    const dieAnimConfig = this.movementSystem.animationConfig['die'];
                    const deathDuration = dieAnimConfig.frameCount * GAME_CONSTANTS.ANIMATION_SPEED;

                    setTimeout(() => {
                        // Remove defeated character from game
                        this.removeDefeatedCharacter(targetChar);

                        // Advance to next action
                        this.currentExecutionIndex++;
                        this.executeNextAction();
                    }, deathDuration);
                } else {
                    // No death, advance immediately
                    this.currentExecutionIndex++;
                    this.executeNextAction();
                }
            }, animationDuration);
        }, 100);  // Small delay before damage is dealt

    } else if (action.action === COMBAT_ACTIONS.MOVE && action.target) {
        // ... existing MOVE logic ...
    } else {
        // ... existing WAIT logic ...
    }
}
```

**Add helper method to remove defeated characters:**

```javascript
// Add after executeNextAction() method

/**
 * Remove defeated character from game state
 * @param {Object} character - Defeated character
 */
removeDefeatedCharacter(character) {
    // Remove from npcs array
    const npcIndex = this.game.npcs.indexOf(character);
    if (npcIndex !== -1) {
        this.game.npcs.splice(npcIndex, 1);
        console.log(`Removed ${character.name} from game`);
    }

    // Remove from combat characters
    const combatIndex = this.combatCharacters.indexOf(character);
    if (combatIndex !== -1) {
        this.combatCharacters.splice(combatIndex, 1);
    }

    // Remove from execution queue (current turn)
    const execIndex = this.executionQueue.indexOf(character);
    if (execIndex !== -1) {
        this.executionQueue.splice(execIndex, 1);

        // Adjust current index if we removed a character before current position
        if (execIndex < this.currentExecutionIndex) {
            this.currentExecutionIndex--;
        }
    }
}
```

**Testing:**
- Enter combat
- Verify ATTACK actions can be added to action queue
- Test attack execution flow (won't have UI yet, just console logs)

---

### Phase 7: Update AISystem for Attack Actions

**File:** `js/AISystem.js`

**Update `getAIAction()` method to prefer attacks over movement:**

```javascript
getAIAction(character, targetCharacter, allCharacters) {
    // Check if we can attack an adjacent enemy
    const neighbors = this.hexGrid.getNeighbors({
        q: character.hexQ,
        r: character.hexR
    });

    // Look for adjacent enemies
    const adjacentEnemies = [];
    for (const hex of neighbors) {
        const occupant = this.getCharacterAtHex(hex.q, hex.r);
        if (occupant && occupant.faction !== character.faction) {
            adjacentEnemies.push({ character: occupant, hex: hex });
        }
    }

    // If adjacent enemy exists, attack it
    if (adjacentEnemies.length > 0) {
        // Prefer attacking the target character if adjacent
        const targetAdjacent = adjacentEnemies.find(
            e => e.character === targetCharacter
        );

        const target = targetAdjacent || adjacentEnemies[0];
        return {
            action: 'attack',
            target: { q: target.hex.q, r: target.hex.r }
        };
    }

    // No adjacent enemies, try to move toward target
    return this.getMoveTowardAction(character, targetCharacter, allCharacters);
}
```

**Testing:**
- Spawn enemies next to player
- Enter combat
- Verify AI chooses ATTACK actions when adjacent
- Verify AI chooses MOVE actions when not adjacent

---

### Phase 8: Add Player Attack Input (Future Enhancement)

**File:** `js/InputHandler.js`

**NOTE:** This phase is OPTIONAL for initial implementation. For now, player can only MOVE/WAIT.

**To enable player attacks in future:**

In `handleCombatClick()` method (around line 169), check if clicked hex contains enemy:

```javascript
handleCombatClick(worldX, worldY) {
    const hex = this.hexGrid.pixelToHex(worldX, worldY);
    const clickedChar = this.getCharacterAtHex(hex.q, hex.r);

    // Check if clicked on adjacent enemy (attack)
    const distance = this.hexGrid.hexDistance(
        { q: this.game.pc.hexQ, r: this.game.pc.hexR },
        { q: hex.q, r: hex.r }
    );

    if (distance === 1 && clickedChar && clickedChar.faction !== 'player') {
        // Attack clicked enemy
        return this.gameStateManager.selectPlayerAttackTarget(hex.q, hex.r);
    }

    // Otherwise try to move
    return this.gameStateManager.selectPlayerMoveTarget(hex.q, hex.r);
}
```

**Add to GameStateManager.js:**

```javascript
selectPlayerAttackTarget(hexQ, hexR) {
    if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
    if (this.characterActions.has(this.game.pc)) return false;

    // Check if valid attack target
    if (!this.combatSystem.isValidAttackTarget(hexQ, hexR, this.game.pc)) {
        return false;
    }

    // Valid attack
    this.characterActions.set(this.game.pc, {
        action: COMBAT_ACTIONS.ATTACK,
        target: { q: hexQ, r: hexR }
    });

    // Check if we should transition to execution
    if (this.isInputPhaseComplete()) {
        this.setState(GAME_STATES.COMBAT_EXECUTION);
    }
    return true;
}
```

**Skip this phase initially** - focus on AI attacking first, add player attacks later.

---

## Testing Plan

### Unit Testing

**Test CombatSystem methods individually:**

```javascript
// In browser console after game loads
const testAttacker = {
    name: 'TestAttacker',
    attack: 15,
    defense: 5,
    accuracy: 1.0,  // Always hit for testing
    critChance: 0.0,  // No crits for testing
    critMultiplier: 1.5
};

const testDefender = {
    name: 'TestDefender',
    health: 100,
    maxHealth: 100,
    defense: 5
};

// Test damage calculation
const damage = game.combatSystem.calculateDamage(testAttacker, testDefender, false);
console.log('Damage:', damage);  // Should be ~10-15 (15 base - 2.5 defense ± 20% variance)

// Test attack execution
const result = game.combatSystem.executeAttack(testAttacker, testDefender);
console.log('Attack result:', result);  // Should show hit: true, damage dealt
console.log('Defender health:', testDefender.health);  // Should be reduced
```

### Integration Testing

**Test combat flow:**

1. **Spawn enemy next to player:**
   - Press 7 to spawn enemy
   - Use console to move enemy adjacent to player:
     ```javascript
     game.state.npcs[0].hexQ = game.state.pc.hexQ + 1;
     game.state.npcs[0].hexR = game.state.pc.hexR;
     ```

2. **Enter combat mode:**
   - Press Shift+Space
   - Verify AI chooses ATTACK action
   - Check console logs

3. **Watch combat execution:**
   - Observe attack animations
   - Check console for damage logs
   - Verify health decreases
   - Watch for death animation when health reaches 0

4. **Test multiple enemies:**
   - Spawn 3-4 enemies
   - Place them adjacent to player
   - Enter combat
   - Verify sequential attack execution
   - Verify defeated enemies are removed

### Edge Cases

1. **Target defeated before attacker's turn:**
   - Two enemies attack same ally
   - First kills ally
   - Second should skip (target validation fails)

2. **All enemies defeated:**
   - Should remain in combat mode (for now)
   - Future: transition to exploration

3. **Player defeated:**
   - Currently no defeat handling
   - Future: game over screen

---

## Known Limitations

1. **No range-based attacks** - Only melee (adjacent) attacks implemented
2. **No player attack input** - AI attacks only (player can only move/wait)
3. **No victory conditions** - Combat continues even if all enemies dead
4. **No status effects** - Pure damage system
5. **No equipment/items** - Stats are fixed
6. **No experience/leveling** - Stats don't change

These are intentional scope limitations for initial implementation. Address in future iterations.

---

## Success Criteria

CombatSystem implementation is successful if:

1. **Functional:**
   - [ ] CombatSystem module loads without errors
   - [ ] Damage calculation works correctly
   - [ ] Attack actions execute with proper animations
   - [ ] Health decreases when characters are attacked
   - [ ] Characters play death animation when defeated
   - [ ] Defeated characters are removed from game

2. **Performance:**
   - [ ] No frame drops during attack animations
   - [ ] Combat execution remains smooth with 5+ characters
   - [ ] Animation timing feels responsive

3. **Code Quality:**
   - [ ] Follows existing code patterns (dependency injection, callbacks)
   - [ ] Well-commented and documented
   - [ ] No magic numbers (all in const.js)
   - [ ] Integrates cleanly without breaking existing features

4. **AI Behavior:**
   - [ ] Enemies attack when adjacent to player
   - [ ] Enemies move toward player when not adjacent
   - [ ] AI makes sensible tactical decisions

---

## File Summary

**Files to modify:**
- `js/const.js` - Add COMBAT_STATS and DAMAGE_CONSTANTS
- `js/Game.js` - Add combat stats to characters, initialize CombatSystem
- `js/GameStateManager.js` - Add ATTACK action, integrate attack execution
- `js/AISystem.js` - Update AI to choose attack actions

**Files to create:**
- `js/CombatSystem.js` - New combat module

**Files to reference:**
- `js/MovementSystem.js` - Animation system patterns
- `js/HexGrid.js` - Hex distance and neighbor calculations

---

## Estimated Implementation Time

- Phase 1-2 (Stats): 15-30 minutes
- Phase 3 (CombatSystem): 45-60 minutes
- Phase 4-5 (Integration): 20-30 minutes
- Phase 6 (Attack Execution): 45-60 minutes
- Phase 7 (AI): 20-30 minutes
- Testing: 30-45 minutes

**Total: 3-4 hours** for complete implementation and testing

---

## Next Steps After Completion

Once CombatSystem is working:

1. **Add player attack input** (Phase 8)
2. **Implement victory/defeat conditions** (Roadmap item #6)
3. **Add range-based attacks** (Roadmap item #4)
4. **Extend action system** with DEFEND, ABILITY actions (Roadmap item #3)
5. **Add turn order/initiative** (Roadmap item #5)
6. **Polish animations** (attack impact effects, damage numbers)

This implementation provides the foundation for all future combat features.
