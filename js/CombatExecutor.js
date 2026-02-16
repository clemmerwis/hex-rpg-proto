import { GAME_CONSTANTS, calculateMoveSpeed, calculateActionSpeed, getSpeedTier, calculateInitiative, getFacingFromDelta } from './const.js';
import { makeEnemies } from './utils.js';

export class CombatExecutor {
    constructor(hexGrid, getCharacterAtHex, movementSystem, combatSystem, logger) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.movementSystem = movementSystem;
        this.combatSystem = combatSystem;
        this.logger = logger;

        // Phase execution state (owned by executor)
        this.executionQueue = [];
        this.currentPhase = null;       // 'move' or 'action'
        this.moveQueue = [];
        this.actionQueue = [];
        this.currentMoveIndex = 0;
        this.currentActionIndex = 0;

        // Callbacks — set by GameStateManager after construction
        this.onExecutionComplete = null;
        this.onCharacterDefeated = null;
        this.onClearRecentlyHit = null;
        this.onClearPlayerSelection = null;
        this.onUpdateEngagement = null;
    }

    /**
     * Sort characters by speed tier, then initiative, with random tiebreaker
     * @param {Array} characters - Characters to sort
     * @param {string} phase - 'move' or 'action'
     * @param {Map} [actionsMap] - Map of character -> action (used for action phase to get attack type)
     */
    sortBySpeed(characters, phase, actionsMap = null) {
        // Assign d100 tiebreaker roll to each character once (avoids sort comparator bias)
        characters.forEach(c => c._tiebreakRoll = Math.floor(Math.random() * 100) + 1);

        const sorted = [...characters].sort((a, b) => {
            // Calculate speed based on phase
            let speedA, speedB;
            if (phase === 'move') {
                speedA = calculateMoveSpeed(a);
                speedB = calculateMoveSpeed(b);
            } else {
                // Action phase: use actual attack type from actions map
                const attackTypeA = actionsMap?.get(a)?.attackType || 'light';
                const attackTypeB = actionsMap?.get(b)?.attackType || 'light';
                speedA = calculateActionSpeed(a, attackTypeA);
                speedB = calculateActionSpeed(b, attackTypeB);
            }

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

            // Tied initiative: higher tiebreaker roll goes first
            return b._tiebreakRoll - a._tiebreakRoll;
        });

        // Clean up temp property
        sorted.forEach(c => delete c._tiebreakRoll);
        return sorted;
    }

    /**
     * Begin combat execution — builds queues and kicks off move phase
     * @param {Array} combatCharacters - All living combat participants
     * @param {Map} characterActions - Map of character -> action
     */
    enterCombatExecution(combatCharacters, characterActions) {
        this.executionQueue = [...combatCharacters];
        this.characterActions = characterActions;
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
            return action && action.action === 'move';
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
        if (this.onClearRecentlyHit) this.onClearRecentlyHit();

        // Separator between character actions
        this.logger.combatSeparator();

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
        if (this.onClearPlayerSelection) this.onClearPlayerSelection(character);

        // Log move action
        this.logger.combat(`{{char:${character.name}}}: Move`);

        // Execute move with callback
        character.movementQueue = [action.target];
        character.isMoving = true;
        character.currentMoveTimer = 0;

        this.movementSystem.onMovementComplete(character, () => {
            // Update engagement tracking after move
            if (this.onUpdateEngagement) this.onUpdateEngagement(character);

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
            return action && action.action === 'attack';
        });
        this.actionQueue = this.sortBySpeed(attackers, 'action', this.characterActions);
        this.currentActionIndex = 0;

        this.executeNextAttack();
    }

    executeNextAttack() {
        if (this.currentActionIndex >= this.actionQueue.length) {
            // All attacks done, notify GSM
            if (this.onExecutionComplete) this.onExecutionComplete();
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
        if (this.onClearRecentlyHit) this.onClearRecentlyHit();

        // Separator between character actions
        this.logger.combatSeparator();

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
     * Handle character defeat - mark as defeated but keep on hex
     * Calls onCharacterDefeated callback so GSM can splice combatCharacters
     */
    handleCharacterDefeat(character) {
        this.logger.debug(`[DEFEAT] ${character.name} defeated at (${character.hexQ},${character.hexR}) - body remains as obstacle`);

        character.isDefeated = true;
        character.currentAnimation = 'die';

        // Notify GSM to remove from combatCharacters roster
        if (this.onCharacterDefeated) this.onCharacterDefeated(character);

        // Do NOT remove from game.npcs - dead body stays on hex and blocks movement
    }

    /**
     * Check if the given character is currently executing (for UI highlighting)
     */
    isExecutingCharacter(character) {
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
}
