import { AISystem } from './AISystem.js';
import { GAME_CONSTANTS, calculateMoveSpeed, calculateActionSpeed, getSpeedTier, calculateInitiative, getFacingFromDelta } from './const.js';
import { makeEnemies } from './utils.js';

export const GAME_STATES = {
    EXPLORATION: 'exploration',
    COMBAT_INPUT: 'combat_input',
    COMBAT_EXECUTION: 'combat_execution'
};

// Combat Actions
export const COMBAT_ACTIONS = {
    MOVE: 'move',
    WAIT: 'wait',
    ATTACK: 'attack'
};

export class GameStateManager {
    constructor(game, hexGrid, getCharacterAtHex, movementSystem, combatSystem, pathfinding, logger, gameInstance) {
        this.game = game;
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.movementSystem = movementSystem;
        this.combatSystem = combatSystem;
        this.pathfinding = pathfinding;
        this.logger = logger;
        this.gameInstance = gameInstance; // Full Game instance for accessing UI systems
        this.aiSystem = new AISystem(hexGrid, getCharacterAtHex, pathfinding, logger);

        // State
        this.currentState = GAME_STATES.EXPLORATION;

        // Combat state data
        this.turnNumber = 1;
        this.combatCharacters = [];
        this.characterActions = new Map();
        this.executionQueue = [];
        this.currentExecutionIndex = 0;

        // Phase execution data
        this.currentPhase = null;       // 'move' or 'action'
        this.moveQueue = [];
        this.actionQueue = [];
        this.currentMoveIndex = 0;
        this.currentActionIndex = 0;

        // Input phase data
        this.playerSelectedHex = null;
        this.playerSelectedAttackType = 'light';  // Current attack type for player
        this.playerLastAttackAction = null;       // Remember last attack for Enter repeat

        // Track characters that were just hit (show their health bar temporarily)
        this.recentlyHitCharacters = new Set();

        // UI update callback
        this.onStateChange = null;
    }

    /**
     * Sort characters by speed tier, then initiative, with random tiebreaker
     * @param {Array} characters - Characters to sort
     * @param {string} phase - 'move' or 'action'
     */
    sortBySpeed(characters, phase) {
        return [...characters].sort((a, b) => {
            // Calculate speed based on phase
            const speedA = phase === 'move' ? calculateMoveSpeed(a) : calculateActionSpeed(a, 'light');
            const speedB = phase === 'move' ? calculateMoveSpeed(b) : calculateActionSpeed(b, 'light');

            // Get tiers (lower tier = faster = goes first)
            const tierA = getSpeedTier(speedA).tier;
            const tierB = getSpeedTier(speedB).tier;

            if (tierA !== tierB) {
                return tierA - tierB;  // Lower tier first
            }

            // Same tier: sort by initiative (higher = goes first)
            const initA = calculateInitiative(a);
            const initB = calculateInitiative(b);

            if (initA !== initB) {
                return initB - initA;  // Higher initiative first
            }

            // Tied initiative: random tiebreaker
            return Math.random() - 0.5;
        });
    }

    setState(newState) {
        const oldState = this.currentState;

        // Clean up callbacks when leaving combat execution
        if (oldState === GAME_STATES.COMBAT_EXECUTION
            && newState !== GAME_STATES.COMBAT_EXECUTION) {
            this.movementSystem.clearAllCallbacks();
        }

        this.currentState = newState;

        // Handle state transitions
        if (newState === GAME_STATES.COMBAT_INPUT) {
            this.enterCombatInput();
        } else if (newState === GAME_STATES.COMBAT_EXECUTION) {
            this.enterCombatExecution();
        } else if (newState === GAME_STATES.EXPLORATION) {
            this.exitCombat();
        }

        // Notify UI
        if (this.onStateChange) {
            this.onStateChange(newState, oldState);
        }
    }

    enterCombatInput() {
        // Clear recently hit characters from previous turn
        this.clearRecentlyHitCharacters();

        // Show combat log UI
        this.gameInstance?.combatUILog?.show();

        // Log combat start or new turn
        if (this.turnNumber === 1) {
            this.logger.combat('=== COMBAT START ===');
            this.logger.combat('-------------\n');
        }

        // Stop any current movement
        this.game.pc.isMoving = false;
        this.game.pc.movementQueue = [];
        if (!this.game.pc.isDefeated) {
            this.game.pc.currentAnimation = 'idle';
        }

        // Build list of ALL living characters (not just enemies)
        this.combatCharacters = [];
        if (!this.game.pc.isDefeated) {
            this.combatCharacters.push(this.game.pc);
        }
        const livingNPCs = this.game.npcs.filter(npc => !npc.isDefeated);
        this.combatCharacters.push(...livingNPCs);

        // Reset input data
        this.characterActions.clear();
        this.playerSelectedHex = null;

        // AI waits for player to choose action first
        // processAITurns() is called after player selects their action
    }

    processAITurns() {
        // Get all non-player characters
        const npcs = this.combatCharacters.filter(char => char !== this.game.pc);

        npcs.forEach(npc => {
            // Get AI decision based on mode and enemies
            const action = this.aiSystem.getAIAction(npc, this.combatCharacters);
            this.characterActions.set(npc, action);
        });

        // All actions should now be set (player + AI), transition to execution
        this.setState(GAME_STATES.COMBAT_EXECUTION);
    }

    isInputPhaseComplete() {
        return this.combatCharacters.every(char =>
            this.characterActions.has(char)
        );
    }

    enterCombatExecution() {
        // Build execution queue from combat characters
        this.executionQueue = [...this.combatCharacters];
        this.currentPhase = 'move';

        // Start with move phase
        this.executeMovePhase();
    }

    /**
     * Execute all MOVE actions first, sorted by speed
     */
    executeMovePhase() {
        // Filter characters with MOVE actions, sort by speed
        const movers = this.executionQueue.filter(char => {
            const action = this.characterActions.get(char);
            return action && action.action === COMBAT_ACTIONS.MOVE;
        });
        this.moveQueue = this.sortBySpeed(movers, 'move');
        this.currentMoveIndex = 0;

        this.executeNextMove();
    }

    executeNextMove() {
        if (this.currentMoveIndex >= this.moveQueue.length) {
            // Move phase complete - add delay before action phase to ensure animations settle
            this.currentPhase = 'action';

            // Small delay to ensure all movement visuals are complete
            setTimeout(() => {
                this.executeActionPhase();
            }, GAME_CONSTANTS.COMBAT_PHASE_TRANSITION);
            return;
        }

        const character = this.moveQueue[this.currentMoveIndex];

        // Skip if character was defeated during this phase
        if (character.isDefeated) {
            this.currentMoveIndex++;
            this.executeNextMove();
            return;
        }

        // Clear recently hit - new character is starting their turn
        this.clearRecentlyHitCharacters();

        const action = this.characterActions.get(character);

        // Check if target hex is occupied (collision detection)
        const characterAtTarget = this.getCharacterAtHex(action.target.q, action.target.r);
        if (characterAtTarget) {
            // Log blocked move
            this.logger.combat(`{{char:${character.name}}}: Move {{blocked}}`);
            this.currentMoveIndex++;
            this.executeNextMove();
            return;
        }

        // Clear player selection highlight when player starts moving
        if (character === this.game.pc) {
            this.playerSelectedHex = null;
        }

        // Log move action
        this.logger.combat(`{{char:${character.name}}}: Move`);

        // Execute move with callback
        character.movementQueue = [action.target];
        character.isMoving = true;
        character.currentMoveTimer = 0;

        this.movementSystem.onMovementComplete(character, () => {
            // Update engagement tracking after move
            this.updateEngagement(character);

            // Auto-face adjacent enemy after move
            this.autoFaceAdjacentEnemy(character);

            this.currentMoveIndex++;
            this.executeNextMove();
        });
    }

    /**
     * Execute all ATTACK actions after moves, sorted by speed
     */
    executeActionPhase() {
        // Filter characters with ATTACK actions, sort by speed
        const attackers = this.executionQueue.filter(char => {
            const action = this.characterActions.get(char);
            return action && action.action === COMBAT_ACTIONS.ATTACK;
        });
        this.actionQueue = this.sortBySpeed(attackers, 'action');
        this.currentActionIndex = 0;

        this.executeNextAttack();
    }

    executeNextAttack() {
        if (this.currentActionIndex >= this.actionQueue.length) {
            // All attacks done, next turn
            this.turnNumber++;
            this.setState(GAME_STATES.COMBAT_INPUT);
            return;
        }

        const character = this.actionQueue[this.currentActionIndex];

        // Skip if character was defeated during this phase
        if (character.isDefeated) {
            this.currentActionIndex++;
            this.executeNextAttack();
            return;
        }

        // Clear recently hit - new character is starting their turn
        this.clearRecentlyHitCharacters();

        const action = this.characterActions.get(character);

        // Get whoever is NOW at the target hex (may be different from original target!)
        // Attacks hit whoever is on the hex, even allies (accidents happen)
        const targetChar = this.getCharacterAtHex(action.target.q, action.target.r);

        // Face the target hex regardless of whether target is there
        const targetPixel = this.hexGrid.hexToPixel(action.target.q, action.target.r);
        const dx = targetPixel.x - character.pixelX;
        const dy = targetPixel.y - character.pixelY;
        this.movementSystem.updateFacing(character, dx, dy);

        // Play attack animation - reset frame to 0 to fix intermittent wrong frame order
        character.animationFrame = 0;
        character.animationTimer = 0;
        character.currentAnimation = 'attack';

        setTimeout(() => {
            if (!targetChar) {
                // Auto-miss: no one at hex
            } else if (targetChar === character) {
                // Can't hit yourself
            } else if (targetChar.isDefeated) {
                // Target already dead
            } else {
                // Execute attack - hits whoever is on the hex (ally or enemy!)
                const attackType = action.attackType || 'light';
                const result = this.combatSystem.executeAttack(character, action.target, attackType);

                // Hostility trigger: target becomes hostile to attacker (even on miss!)
                if (!targetChar.isDefeated) {
                    targetChar.lastAttackedBy = character;

                    // Establish mutual hostility - attacking makes you enemies
                    makeEnemies(character, targetChar);
                }

                if (result.defenderDefeated) {
                    this.handleCharacterDefeat(targetChar);
                }
            }

            setTimeout(() => {
                character.animationFrame = 0;
                character.animationTimer = 0;
                character.currentAnimation = 'idle';
                this.currentActionIndex++;
                this.executeNextAttack();
            }, GAME_CONSTANTS.COMBAT_ATTACK_RECOVERY);
        }, GAME_CONSTANTS.COMBAT_ATTACK_WINDUP);
    }

    /**
     * Auto-face adjacent enemy after movement
     * Finds first adjacent enemy and faces toward them
     */
    autoFaceAdjacentEnemy(character) {
        const neighbors = this.hexGrid.getNeighbors({ q: character.hexQ, r: character.hexR });

        for (const neighbor of neighbors) {
            const occupant = this.getCharacterAtHex(neighbor.q, neighbor.r);
            if (occupant && !occupant.isDefeated && occupant.faction !== character.faction) {
                // Found an adjacent enemy - face toward them
                const targetPixel = this.hexGrid.hexToPixel(neighbor.q, neighbor.r);
                const charPixel = this.hexGrid.hexToPixel(character.hexQ, character.hexR);
                const dx = targetPixel.x - charPixel.x;
                const dy = targetPixel.y - charPixel.y;
                character.facing = getFacingFromDelta(dx, dy);
                return;
            }
        }
    }

    /**
     * Update engagement relationships after a character moves
     * Called after movement completes in executeNextMove()
     */
    updateEngagement(character) {
        const charHex = { q: character.hexQ, r: character.hexR };
        const neighbors = this.hexGrid.getNeighbors(charHex);

        // First, clear any non-adjacent engagements
        this.clearNonAdjacentEngagements(character);

        // Then, establish new engagements with adjacent enemies
        for (const neighbor of neighbors) {
            const occupant = this.getCharacterAtHex(neighbor.q, neighbor.r);
            if (!occupant || occupant.isDefeated) continue;
            if (occupant.faction === character.faction) continue;  // Same faction - no engagement

            // Try to establish mutual engagement
            this.tryEstablishEngagement(character, occupant);
        }
    }

    /**
     * Clear engagements for characters that are no longer adjacent
     */
    clearNonAdjacentEngagements(character) {
        // Guard: skip if not initialized yet
        if (!character.engagedBy) {
            return;
        }

        const charHex = { q: character.hexQ, r: character.hexR };

        // Check all characters this one is engaging
        for (const engaged of [...character.engagedBy]) {
            const dist = this.hexGrid.hexDistance(charHex, { q: engaged.hexQ, r: engaged.hexR });
            if (dist > 1) {
                // No longer adjacent - clear mutual engagement
                character.engagedBy.delete(engaged);
                engaged.engagedBy.delete(character);
                this.logger.debug(`[ENGAGEMENT] ${character.name} and ${engaged.name} disengaged (non-adjacent)`);
            }
        }
    }

    /**
     * Try to establish engagement between two adjacent characters
     * First-come-first-serve up to engagedMax
     */
    tryEstablishEngagement(charA, charB) {
        // Guard: skip if not initialized yet
        if (!charA.engagedBy || !charB.engagedBy) {
            return;
        }

        // A tries to engage B (if A has capacity)
        if (!charA.engagedBy.has(charB) && charA.engagedBy.size < charA.engagedMax) {
            charA.engagedBy.add(charB);
            this.logger.debug(`[ENGAGEMENT] ${charA.name} now engaging ${charB.name} (${charA.engagedBy.size}/${charA.engagedMax})`);
        }

        // B tries to engage A (if B has capacity)
        if (!charB.engagedBy.has(charA) && charB.engagedBy.size < charB.engagedMax) {
            charB.engagedBy.add(charA);
            this.logger.debug(`[ENGAGEMENT] ${charB.name} now engaging ${charA.name} (${charB.engagedBy.size}/${charB.engagedMax})`);
        }
    }

    /**
     * Check if defender can engage attacker back
     * Returns false if defender's engagedBy is at max AND doesn't include attacker
     */
    canEngageBack(defender, attacker) {
        // Guard: if engagedBy not initialized, assume can engage
        if (!defender.engagedBy) {
            return true;
        }
        // If already engaging attacker, can engage back
        if (defender.engagedBy.has(attacker)) {
            return true;
        }
        // If has capacity, could engage back
        if (defender.engagedBy.size < defender.engagedMax) {
            return true;
        }
        // At max capacity and attacker not in list - cannot engage back
        return false;
    }

    /**
     * Handle character defeat - mark as defeated but keep on hex
     */
    handleCharacterDefeat(character) {
        this.logger.debug(`[DEFEAT] ${character.name} defeated at (${character.hexQ},${character.hexR}) - body remains as obstacle`);

        character.isDefeated = true;
        character.currentAnimation = 'die';

        // Remove from combatCharacters (they don't get turns anymore)
        const combatIndex = this.combatCharacters.indexOf(character);
        if (combatIndex !== -1) {
            this.combatCharacters.splice(combatIndex, 1);
        }

        // Do NOT remove from game.npcs - dead body stays on hex and blocks movement
    }

    exitCombat() {
        // Reset combat data
        this.combatCharacters = [];
        this.characterActions.clear();
        this.playerSelectedHex = null;
        this.executionQueue = [];
        this.currentExecutionIndex = 0;
        this.currentPhase = null;
        this.moveQueue = [];
        this.actionQueue = [];
        this.currentMoveIndex = 0;
        this.currentActionIndex = 0;
        this.turnNumber = 1;

        // Reset HP buffers (temp HP resets after combat)
        if (this.game.pc.hpBufferByAttacker) {
            this.game.pc.hpBufferByAttacker.clear();
        }
        this.game.npcs.forEach(npc => {
            if (npc.hpBufferByAttacker) {
                npc.hpBufferByAttacker.clear();
            }
        });

        // Clear engagement tracking
        if (this.game.pc.engagedBy) {
            this.game.pc.engagedBy.clear();
        }
        this.game.npcs.forEach(npc => {
            if (npc.engagedBy) {
                npc.engagedBy.clear();
            }
        });

        // Return all living characters to idle
        this.game.pc.currentAnimation = 'idle';
        this.game.npcs.forEach(npc => {
            if (!npc.isDefeated) {
                npc.currentAnimation = 'idle';
            }
        });

        // Hide combat log UI
        this.gameInstance?.combatUILog?.hide();
    }

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

    toggleCombat() {
        if (this.currentState === GAME_STATES.EXPLORATION) {
            this.setState(GAME_STATES.COMBAT_INPUT);
        } else {
            this.setState(GAME_STATES.EXPLORATION);
        }
    }

    skipPlayerTurn() {
        if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
        if (this.characterActions.has(this.game.pc)) return false; // Already chosen

        // Player chooses to wait
        this.characterActions.set(this.game.pc, {
            action: COMBAT_ACTIONS.WAIT,
            target: null
        });

        // Player has chosen, now AI makes their decisions
        this.processAITurns();
        return true;
    }

    selectPlayerMoveTarget(hexQ, hexR) {
        if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
        if (this.characterActions.has(this.game.pc)) return false; // Already chosen

        // Check if hex is adjacent to player
        const distance = this.hexGrid.hexDistance(
            { q: this.game.pc.hexQ, r: this.game.pc.hexR },
            { q: hexQ, r: hexR }
        );

        if (distance !== 1) {
            return false;
        }

        // Check if hex is occupied
        const characterAtTarget = this.getCharacterAtHex(hexQ, hexR);
        if (characterAtTarget) {
            return false;
        }

        // Check if hex is blocked terrain
        if (this.pathfinding?.blockedHexes?.has(`${hexQ},${hexR}`)) {
            return false;
        }

        // Valid selection
        this.playerSelectedHex = { q: hexQ, r: hexR };
        this.characterActions.set(this.game.pc, {
            action: COMBAT_ACTIONS.MOVE,
            target: { q: hexQ, r: hexR }
        });

        // Player has chosen, now AI makes their decisions
        this.processAITurns();
        return true;
    }

    /**
     * Player selects adjacent hex to attack
     * Attack type must be set before calling (via setPlayerAttackType)
     */
    selectPlayerAttackTarget(hexQ, hexR) {
        if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
        if (this.characterActions.has(this.game.pc)) return false; // Already chosen

        // Check if hex is adjacent to player
        const distance = this.hexGrid.hexDistance(
            { q: this.game.pc.hexQ, r: this.game.pc.hexR },
            { q: hexQ, r: hexR }
        );

        if (distance !== 1) {
            return false;
        }

        // Valid attack target (can attack empty hex - it will whiff)
        const attackAction = {
            action: COMBAT_ACTIONS.ATTACK,
            target: { q: hexQ, r: hexR },
            attackType: this.playerSelectedAttackType
        };

        this.playerSelectedHex = { q: hexQ, r: hexR };
        this.characterActions.set(this.game.pc, attackAction);

        // Save for Enter repeat
        this.playerLastAttackAction = {
            targetOffset: {
                q: hexQ - this.game.pc.hexQ,
                r: hexR - this.game.pc.hexR
            },
            attackType: this.playerSelectedAttackType
        };

        // Player has chosen, now AI makes their decisions
        this.processAITurns();
        return true;
    }

    /**
     * Set player's attack type (1 = light, 2 = heavy)
     */
    setPlayerAttackType(attackType) {
        if (attackType === 'light' || attackType === 'heavy') {
            this.playerSelectedAttackType = attackType;
            return true;
        }
        return false;
    }

    /**
     * Repeat last attack action (Enter key)
     * Uses same relative hex offset and attack type
     */
    repeatLastAttack() {
        if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
        if (this.characterActions.has(this.game.pc)) return false;
        if (!this.playerLastAttackAction) return false;

        // Calculate target hex from player's current position + stored offset
        const targetQ = this.game.pc.hexQ + this.playerLastAttackAction.targetOffset.q;
        const targetR = this.game.pc.hexR + this.playerLastAttackAction.targetOffset.r;

        // Set the attack type to match last attack
        this.playerSelectedAttackType = this.playerLastAttackAction.attackType;

        return this.selectPlayerAttackTarget(targetQ, targetR);
    }

    // For UI updates
    getEnemyCount() {
        return this.game.npcs.filter(npc => npc.faction === 'bandit').length;
    }

    isExecutingCharacter(character) {
        if (this.currentState !== GAME_STATES.COMBAT_EXECUTION) return false;

        // Check move phase
        if (this.currentPhase === 'move' &&
            this.moveQueue?.length > 0 &&
            this.currentMoveIndex < this.moveQueue.length &&
            this.moveQueue[this.currentMoveIndex] === character) {
            return true;
        }

        // Check action (attack) phase
        if (this.currentPhase === 'action' &&
            this.actionQueue?.length > 0 &&
            this.currentActionIndex < this.actionQueue.length &&
            this.actionQueue[this.currentActionIndex] === character) {
            return true;
        }

        return false;
    }

    markCharacterHit(character) {
        this.recentlyHitCharacters.add(character);
    }

    clearRecentlyHitCharacters() {
        this.recentlyHitCharacters.clear();
    }

    wasRecentlyHit(character) {
        return this.recentlyHitCharacters.has(character);
    }
}