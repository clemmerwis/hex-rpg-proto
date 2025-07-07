// Game States
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

        console.log(`Game state changed: ${oldState} → ${newState}`);

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
        console.log('=== ENTERING COMBAT INPUT PHASE ===');

        // Stop any current movement
        this.game.pc.isMoving = false;
        this.game.pc.movementQueue = [];
        this.game.pc.currentAnimation = 'idle';

        // Build list of combat characters (PC + enemies for now)
        this.combatCharacters = [this.game.pc];
        const enemies = this.game.npcs.filter(npc => npc.faction === 'enemy');
        this.combatCharacters.push(...enemies);

        console.log(`Combat characters: ${this.combatCharacters.map(char => `${char.name}(${char.faction})`).join(', ')}`);

        // Reset input data
        this.characterActions.clear();
        this.playerSelectedHex = null;

        // AI characters make their decisions immediately
        this.processAITurns();
    }

    processAITurns() {
        // Simple AI: Bandit moves left/right
        const bandits = this.combatCharacters.filter(char => char.faction === 'enemy');

        bandits.forEach(bandit => {
            if (!bandit.aiDirection) {
                bandit.aiDirection = 1; // 1 for right, -1 for left
            }

            // Try to move in current direction
            const targetQ = bandit.hexQ + bandit.aiDirection;
            const targetR = bandit.hexR;

            // Check if target is occupied or if we should reverse direction
            const characterAtTarget = this.getCharacterAtHex(targetQ, targetR);
            if (characterAtTarget) {
                // Can't move there, reverse direction
                bandit.aiDirection *= -1;
                // Try the other direction
                const newTargetQ = bandit.hexQ + bandit.aiDirection;
                const newTargetR = bandit.hexR;
                const newCharacterAtTarget = this.getCharacterAtHex(newTargetQ, newTargetR);

                if (!newCharacterAtTarget) {
                    // Can move in new direction
                    this.characterActions.set(bandit, {
                        action: COMBAT_ACTIONS.MOVE,
                        target: { q: newTargetQ, r: newTargetR }
                    });
                } else {
                    // Nowhere to move, wait
                    this.characterActions.set(bandit, {
                        action: COMBAT_ACTIONS.WAIT,
                        target: null
                    });
                }
            } else {
                // Can move in current direction
                this.characterActions.set(bandit, {
                    action: COMBAT_ACTIONS.MOVE,
                    target: { q: targetQ, r: targetR }
                });
            }
        });

        this.checkInputPhaseComplete();
    }

    checkInputPhaseComplete() {
        // Check if all characters have chosen actions
        const allChosen = this.combatCharacters.every(char =>
            this.characterActions.has(char)
        );

        if (allChosen) {
            console.log('All characters have chosen actions, moving to execution phase');
            this.setState(GAME_STATES.COMBAT_EXECUTION);
        }
    }

    enterCombatExecution() {
        console.log('=== ENTERING COMBAT EXECUTION PHASE ===');
        console.log('DEBUG: About to build execution queue');

        // Build execution queue (PC first for now, then others)
        this.executionQueue = [...this.combatCharacters];
        this.currentExecutionIndex = 0;

        console.log('DEBUG: Execution queue built, length:', this.executionQueue.length);

        // Log what we're about to execute
        this.executionQueue.forEach((char, i) => {
            const action = this.characterActions.get(char);
            console.log(`Executing action for ${char.name}: ${action.action}`);
        });

        console.log('DEBUG: About to call executeNextAction');
        // Start executing actions
        this.executeNextAction();
        console.log('DEBUG: executeNextAction called');
    }

    executeNextAction() {
        console.log('executeNextAction called, index:', this.currentExecutionIndex, 'queue length:', this.executionQueue.length);

        if (this.currentExecutionIndex >= this.executionQueue.length) {
            // All actions executed, next turn
            this.turnNumber++;
            this.setState(GAME_STATES.COMBAT_INPUT);
            return;
        }

        const character = this.executionQueue[this.currentExecutionIndex];
        const action = this.characterActions.get(character);

        console.log(`Executing action for ${character.name}: ${action.action}`);

        if (action.action === COMBAT_ACTIONS.MOVE && action.target) {
            // Use the movement queue system for smooth movement
            character.movementQueue = [action.target];
            character.isMoving = true;
            character.currentMoveTimer = 0;

            console.log(`Starting movement for ${character.name}, isMoving: ${character.isMoving}, queue length: ${character.movementQueue.length}`);
            console.log(`Moving from (${character.hexQ}, ${character.hexR}) to (${action.target.q}, ${action.target.r})`);

            // Set up a check for when movement completes
            let checkCount = 0;
            const checkMovementComplete = setInterval(() => {
                checkCount++;
                if (checkCount % 10 === 0) { // Log every 500ms
                    console.log(`Still checking ${character.name}: isMoving=${character.isMoving}, queue=${character.movementQueue.length}`);
                }

                if (!character.isMoving) {
                    console.log(`Movement complete for ${character.name} after ${checkCount * 50}ms`);
                    clearInterval(checkMovementComplete);
                    this.currentExecutionIndex++;
                    this.executeNextAction();
                }
            }, 50); // Check every 50ms
        } else {
            // Wait action or no valid move
            console.log(`${character.name} is waiting`);
            setTimeout(() => {
                this.currentExecutionIndex++;
                this.executeNextAction();
            }, 200);
        }
    }

    exitCombat() {
        console.log('=== EXITING COMBAT ===');

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
            delete npc.aiDirection; // Reset AI state
        });

        console.log('Returned to exploration mode');
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
            console.log('Target hex must be adjacent to player');
            return false;
        }

        // Check if hex is occupied
        const characterAtTarget = this.getCharacterAtHex(hexQ, hexR);
        if (characterAtTarget) {
            console.log('Target hex is occupied');
            return false;
        }

        // Valid selection
        this.playerSelectedHex = { q: hexQ, r: hexR };
        this.characterActions.set(this.game.pc, {
            action: COMBAT_ACTIONS.MOVE,
            target: { q: hexQ, r: hexR }
        });

        console.log(`Player selected move to ${hexQ}, ${hexR}`);
        this.checkInputPhaseComplete();
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