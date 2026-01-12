# CombatSystem.js - Basic Structure Implementation

## Goal

Get basic attack functionality working with simple hardcoded stats and to-hit formula:
- **THC = Attack_R - Defense_R + 50%**
- Simple damage: fixed amount per hit
- Attack animations
- Character defeat when health reaches 0

---

## Phase 1: Add Basic Combat Stats to Characters

**File:** `js/Game.js`

Add `attack_rating` and `defense_rating` to PC (around line 35):

```javascript
pc: {
    // ... existing properties ...
    health: 85,
    maxHealth: 100,
    faction: 'player',
    attack_rating: 15,      // NEW
    defense_rating: 8,      // NEW
    // ...
}
```

Add to ally NPC (around line 55):
```javascript
{
    // ... existing ...
    faction: 'ally',
    attack_rating: 13,      // NEW
    defense_rating: 7,      // NEW
    // ...
}
```

Add to enemy NPC (around line 76):
```javascript
{
    // ... existing ...
    faction: 'enemy',
    attack_rating: 12,      // NEW
    defense_rating: 5,      // NEW
    // ...
}
```

Update `spawnEnemy()` method (around line 290):
```javascript
const enemy = {
    // ... existing ...
    faction: 'enemy',
    attack_rating: 12,      // NEW
    defense_rating: 5,      // NEW
    // ...
};
```

---

## Phase 2: Create Basic CombatSystem.js

**File:** `js/CombatSystem.js` (NEW)

```javascript
export class CombatSystem {
    constructor(hexGrid, getCharacterAtHex) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
    }

    /**
     * Execute attack: check hit, deal damage
     * THC = Attack_R - Defense_R + 50%
     */
    executeAttack(attacker, defender) {
        // Calculate to-hit chance
        const thc = (attacker.attack_rating - defender.defense_rating + 50) / 100;
        const hit = Math.random() < thc;

        if (!hit) {
            console.log(`${attacker.name} attacks ${defender.name} but MISSES!`);
            return { hit: false, damage: 0, defenderDefeated: false };
        }

        // Simple fixed damage for now
        const damage = 10;
        defender.health -= damage;
        defender.health = Math.max(0, defender.health);

        const defeated = defender.health <= 0;

        console.log(`${attacker.name} hits ${defender.name} for ${damage} damage!`);
        if (defeated) {
            console.log(`${defender.name} has been defeated!`);
            defender.currentAnimation = 'die';
        }

        return { hit: true, damage: damage, defenderDefeated: defeated };
    }

    /**
     * Check if target is valid (adjacent, different faction)
     */
    isValidAttackTarget(hexQ, hexR, attacker) {
        const target = this.getCharacterAtHex(hexQ, hexR);
        if (!target) return false;
        if (target === attacker) return false;
        if (target.faction === attacker.faction) return false;

        // Check adjacency (range = 1)
        const distance = this.hexGrid.hexDistance(
            { q: attacker.hexQ, r: attacker.hexR },
            { q: hexQ, r: hexR }
        );
        return distance === 1;
    }
}
```

---

## Phase 3: Integrate into Game.js

**File:** `js/Game.js`

Add import (around line 7):
```javascript
import { CombatSystem } from './CombatSystem.js';
```

Initialize in `initializeModules()` (after MovementSystem, around line 158):
```javascript
// After MovementSystem
this.combatSystem = new CombatSystem(
    this.hexGrid,
    this.getCharacterAtHex.bind(this)
);

// Then GameStateManager with combatSystem
this.gameStateManager = new GameStateManager(
    this.state,
    this.hexGrid,
    this.getCharacterAtHex.bind(this),
    this.movementSystem,
    this.combatSystem  // NEW
);
```

---

## Phase 4: Update GameStateManager

**File:** `js/GameStateManager.js`

Update constructor to accept combatSystem (line 17):
```javascript
constructor(game, hexGrid, getCharacterAtHex, movementSystem, combatSystem) {
    this.game = game;
    this.hexGrid = hexGrid;
    this.getCharacterAtHex = getCharacterAtHex;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;  // NEW
    // ...
}
```

Add ATTACK to COMBAT_ACTIONS (line 11):
```javascript
export const COMBAT_ACTIONS = {
    MOVE: 'move',
    WAIT: 'wait',
    ATTACK: 'attack'  // NEW
};
```

Add ATTACK handling in `executeNextAction()` (before MOVE case, around line 130):
```javascript
if (action.action === COMBAT_ACTIONS.ATTACK && action.target) {
    const targetChar = this.getCharacterAtHex(action.target.q, action.target.r);

    if (!targetChar) {
        console.log(`Attack target no longer exists`);
        this.currentExecutionIndex++;
        this.executeNextAction();
        return;
    }

    // Face target
    const dx = targetChar.pixelX - character.pixelX;
    const dy = targetChar.pixelY - character.pixelY;
    this.movementSystem.updateFacing(character, dx, dy);

    // Attack animation
    character.currentAnimation = 'attack';

    // Execute attack after short delay
    setTimeout(() => {
        const result = this.combatSystem.executeAttack(character, targetChar);

        // Wait for animation then continue
        setTimeout(() => {
            character.currentAnimation = 'idle';

            // Remove defeated character
            if (result.defenderDefeated) {
                this.removeDefeatedCharacter(targetChar);
            }

            this.currentExecutionIndex++;
            this.executeNextAction();
        }, 1000);  // 1 second for attack animation
    }, 200);

} else if (action.action === COMBAT_ACTIONS.MOVE && action.target) {
    // ... existing MOVE logic ...
```

Add helper method after `executeNextAction()`:
```javascript
removeDefeatedCharacter(character) {
    const npcIndex = this.game.npcs.indexOf(character);
    if (npcIndex !== -1) {
        this.game.npcs.splice(npcIndex, 1);
    }

    const combatIndex = this.combatCharacters.indexOf(character);
    if (combatIndex !== -1) {
        this.combatCharacters.splice(combatIndex, 1);
    }

    const execIndex = this.executionQueue.indexOf(character);
    if (execIndex !== -1) {
        this.executionQueue.splice(execIndex, 1);
        if (execIndex < this.currentExecutionIndex) {
            this.currentExecutionIndex--;
        }
    }
}
```

---

## Phase 5: Update AI to Attack

**File:** `js/AISystem.js`

Update `getAIAction()` to prefer attacks:
```javascript
getAIAction(character, targetCharacter, allCharacters) {
    // Check for adjacent enemies to attack
    const neighbors = this.hexGrid.getNeighbors({
        q: character.hexQ,
        r: character.hexR
    });

    for (const hex of neighbors) {
        const occupant = this.getCharacterAtHex(hex.q, hex.r);
        if (occupant && occupant.faction !== character.faction) {
            // Attack adjacent enemy
            return {
                action: 'attack',
                target: { q: hex.q, r: hex.r }
            };
        }
    }

    // No adjacent enemies, move toward target
    return this.getMoveTowardAction(character, targetCharacter, allCharacters);
}
```

---

## Testing

1. **Load game** - Check console for errors
2. **Spawn enemy** - Press 7
3. **Move enemy adjacent** - Use console:
   ```javascript
   game.state.npcs[0].hexQ = game.state.pc.hexQ + 1;
   game.state.npcs[0].hexR = game.state.pc.hexR;
   ```
4. **Enter combat** - Shift+Space
5. **Watch combat** - Enemy should attack, see console logs for hit/miss
6. **Check health** - Verify health decreases
7. **Test defeat** - Set PC health low: `game.state.pc.health = 5`

---

## Success Criteria

- [ ] Game loads without errors
- [ ] ATTACK action executes
- [ ] Attack animations play
- [ ] Console shows hit/miss with THC formula
- [ ] Health decreases on hit
- [ ] Death animation plays when health reaches 0
- [ ] Defeated characters removed from game

---

## What We're NOT Doing Yet

- Critical hits
- Damage variance
- Player attack input
- Victory conditions
- Complex stats
- Status effects
- Equipment

Keep these for later iterations!
