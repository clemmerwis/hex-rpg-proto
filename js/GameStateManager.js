import { AISystem } from './AISystem.js';

export const GAME_STATES = {
    EXPLORATION: 'exploration',
    COMBAT_INPUT: 'combat_input',
    COMBAT_EXECUTION: 'combat_execution'
};

// Combat Actions
export const COMBAT_ACTIONS = {
    MOVE: 'move',
    WAIT: 'wait'
};

export class GameStateManager {
    constructor(game, hexGrid, getCharacterAtHex) {
        this.game = game;
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.aiSystem = new AISystem(hexGrid, getCharacterAtHex);

        // State
        this.currentState = GAME_STATES.EXPLORATION;

        // Combat state data
        this.turnNumber = 1;
        this.combatCharacters = [];
        this.characterActions = new Map();
        this.executionQueue = [];
        this.currentExecutionIndex = 0;

        // Input phase data
        this.playerSelectedHex = null;

        // UI update callback
        this.onStateChange = null;
    }

    setState(newState) {
        const oldState = this.currentState;
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
        // Stop any current movement
        this.game.pc.isMoving = false;
        this.game.pc.movementQueue = [];
        this.game.pc.currentAnimation = 'idle';

        // Build list of combat characters (PC + enemies for now)
        this.combatCharacters = [this.game.pc];
        const enemies = this.game.npcs.filter(npc => npc.faction === 'enemy');
        this.combatCharacters.push(...enemies);

        // Reset input data
        this.characterActions.clear();
        this.playerSelectedHex = null;

        // AI characters make their decisions immediately
        this.processAITurns();
    }

    processAITurns() {
        const enemies = this.combatCharacters.filter(char => char.faction === 'enemy');

        enemies.forEach(enemy => {
            // Get AI decision - for now all enemies target the PC
            const action = this.aiSystem.getAIAction(
                enemy,
                this.game.pc,
                this.combatCharacters
            );

            this.characterActions.set(enemy, action);
        });

        // Check if we should transition to execution
        if (this.isInputPhaseComplete()) {
            this.setState(GAME_STATES.COMBAT_EXECUTION);
        }
    }

    isInputPhaseComplete() {
        return this.combatCharacters.every(char =>
            this.characterActions.has(char)
        );
    }

    enterCombatExecution() {
        // Build execution queue (PC first for now, then others)
        this.executionQueue = [...this.combatCharacters];
        this.currentExecutionIndex = 0;

        // Log what we're about to execute
        this.executionQueue.forEach((char, i) => {
            const action = this.characterActions.get(char);
        });

        // Start executing actions
        this.executeNextAction();
    }

    executeNextAction() {
        if (this.currentExecutionIndex >= this.executionQueue.length) {
            // All actions executed, next turn
            this.turnNumber++;
            this.setState(GAME_STATES.COMBAT_INPUT);
            return;
        }

        const character = this.executionQueue[this.currentExecutionIndex];
        const action = this.characterActions.get(character);

        if (action.action === COMBAT_ACTIONS.MOVE && action.target) {
            // Check if target hex is still available (another character might have moved there first)
            const characterAtTarget = this.getCharacterAtHex(action.target.q, action.target.r);

            if (characterAtTarget) {
                // Target hex is now occupied, cancel this move
                console.log(`${character.name}'s move cancelled - hex occupied by ${characterAtTarget.name}`);
                this.currentExecutionIndex++;
                this.executeNextAction();
                return;
            }

            // Use the movement queue system for smooth movement
            character.movementQueue = [action.target];
            character.isMoving = true;
            character.currentMoveTimer = 0;

            // Set up a check for when movement completes
            let checkCount = 0;
            const checkMovementComplete = setInterval(() => {
                checkCount++;

                if (!character.isMoving) {
                    clearInterval(checkMovementComplete);
                    this.currentExecutionIndex++;
                    this.executeNextAction();
                }
            }, 50); // Check every 50ms
        } else {
            // Wait action or no valid move
            setTimeout(() => {
                this.currentExecutionIndex++;
                this.executeNextAction();
            }, 200);
        }
    }

    exitCombat() {
        // Reset combat data
        this.combatCharacters = [];
        this.characterActions.clear();
        this.playerSelectedHex = null;
        this.executionQueue = [];
        this.currentExecutionIndex = 0;
        this.turnNumber = 1;

        // Return all characters to idle
        this.game.pc.currentAnimation = 'idle';
        this.game.npcs.forEach(npc => {
            npc.currentAnimation = 'idle';
        });
    }

    canPlayerMove() {
        return this.currentState === GAME_STATES.EXPLORATION;
    }

    toggleCombat() {
        if (this.currentState === GAME_STATES.EXPLORATION) {
            this.setState(GAME_STATES.COMBAT_INPUT);
        } else {
            this.setState(GAME_STATES.EXPLORATION);
        }
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

        // Valid selection
        this.playerSelectedHex = { q: hexQ, r: hexR };
        this.characterActions.set(this.game.pc, {
            action: COMBAT_ACTIONS.MOVE,
            target: { q: hexQ, r: hexR }
        });

        // Check if we should transition to execution
        if (this.isInputPhaseComplete()) {
            this.setState(GAME_STATES.COMBAT_EXECUTION);
        }
        return true;
    }

    // For UI updates
    getEnemyCount() {
        return this.game.npcs.filter(npc => npc.faction === 'enemy').length;
    }

    isExecutingCharacter(character) {
        return this.currentState === GAME_STATES.COMBAT_EXECUTION &&
            this.executionQueue.length > 0 &&
            this.currentExecutionIndex < this.executionQueue.length &&
            this.executionQueue[this.currentExecutionIndex] === character;
    }
}