import { AISystem } from './AISystem.js';
import { hexKey } from './const.js';

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
    constructor(game, hexGrid, getCharacterAtHex, movementSystem, combatSystem, pathfinding, logger, gameInstance, combatExecutor, engagementManager) {
        this.game = game;
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.movementSystem = movementSystem;
        this.combatSystem = combatSystem;
        this.pathfinding = pathfinding;
        this.logger = logger;
        this.gameInstance = gameInstance; // Full Game instance for accessing UI systems
        this.combatExecutor = combatExecutor;
        this.engagementManager = engagementManager;
        this.aiSystem = new AISystem(hexGrid, getCharacterAtHex, pathfinding, logger);

        // Wire CombatExecutor callbacks
        this.combatExecutor.onExecutionComplete = () => {
            this.turnNumber++;
            this.setState(GAME_STATES.COMBAT_INPUT);
        };
        this.combatExecutor.onCharacterDefeated = (character) => {
            const combatIndex = this.combatCharacters.indexOf(character);
            if (combatIndex !== -1) {
                this.combatCharacters.splice(combatIndex, 1);
            }
        };
        this.combatExecutor.onClearRecentlyHit = () => this.clearRecentlyHitCharacters();
        this.combatExecutor.onClearPlayerSelection = (character) => {
            if (character === this.game.pc) {
                this.playerSelectedHex = null;
            }
        };
        this.combatExecutor.onUpdateEngagement = (character) => this.engagementManager.updateEngagement(character);

        // State
        this.currentState = GAME_STATES.EXPLORATION;

        // Combat state data
        this.turnNumber = 1;
        this.combatCharacters = [];
        this.characterActions = new Map();

        // Input phase data
        this.playerSelectedHex = null;
        this.playerSelectedAttackType = 'light';  // Current attack type for player
        this.playerLastAttackAction = null;       // Remember last attack for Enter repeat

        // Track characters that were just hit (show their health bar temporarily)
        this.recentlyHitCharacters = new Set();

        // UI update callback
        this.onStateChange = null;
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

        // Log combat start or new round
        if (this.turnNumber === 1) {
            this.logger.combat('=== COMBAT START ===');
        } else {
            this.logger.combat(`--- Round ${this.turnNumber} ---`);
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
        // Build distance matrix once for all AI characters this turn
        this.aiSystem.beginTurn(this.combatCharacters);

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
        this.combatExecutor.enterCombatExecution(this.combatCharacters, this.characterActions);
    }

    exitCombat() {
        // Reset combat data
        this.combatCharacters = [];
        this.characterActions.clear();
        this.playerSelectedHex = null;
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
        this.engagementManager.clearAllEngagements(this.game.pc, this.game.npcs);

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
        if (this.pathfinding?.blockedHexes?.has(hexKey(hexQ, hexR))) {
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
        return this.combatExecutor.isExecutingCharacter(character);
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