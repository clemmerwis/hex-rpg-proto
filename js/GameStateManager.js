import { AISystem } from './AISystem.js';
import { GAME_CONSTANTS } from './const.js';

// Dev logging toggle - set to false to disable combat debug logs
const DEV_LOG = true;

function devLog(...args) {
    if (DEV_LOG) {
        console.log('[COMBAT DEV]', ...args);
    }
}

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
    constructor(game, hexGrid, getCharacterAtHex, movementSystem, combatSystem) {
        this.game = game;
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.movementSystem = movementSystem;
        this.combatSystem = combatSystem;
        this.aiSystem = new AISystem(hexGrid, getCharacterAtHex);

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

        // UI update callback
        this.onStateChange = null;
    }

    /**
     * Sort characters by speed (highest first), with random tiebreaker
     */
    sortBySpeed(characters) {
        return [...characters].sort((a, b) => {
            if (b.speed !== a.speed) {
                return b.speed - a.speed;  // Higher speed first
            }
            return Math.random() - 0.5;  // Random tiebreaker
        });
    }

    setState(newState) {
        const oldState = this.currentState;

        // Clean up callbacks when leaving combat execution
        if (oldState === GAME_STATES.COMBAT_EXECUTION
            && newState !== GAME_STATES.COMBAT_EXECUTION) {
            this.movementSystem.clearAllCallbacks();
            console.log('Cleared movement callbacks on state exit');
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

        devLog('=== COMBAT INPUT PHASE ===');
        devLog(`Turn ${this.turnNumber}, Participants:`, this.combatCharacters.map(c =>
            `${c.name}(${c.mode}, enemies=${c.enemies?.size || 0})`
        ).join(', '));

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

        devLog('=== ENTERING COMBAT EXECUTION ===');
        devLog(`Turn ${this.turnNumber}, Characters:`, this.executionQueue.map(c => `${c.name}(${c.hexQ},${c.hexR})`).join(', '));

        // Start with move phase
        this.executeMovePhase();
    }

    /**
     * Execute all MOVE actions first, sorted by speed
     */
    executeMovePhase() {
        devLog('=== MOVE PHASE START ===');

        // Filter characters with MOVE actions, sort by speed
        const movers = this.executionQueue.filter(char => {
            const action = this.characterActions.get(char);
            return action && action.action === COMBAT_ACTIONS.MOVE;
        });
        this.moveQueue = this.sortBySpeed(movers);
        this.currentMoveIndex = 0;

        devLog(`Movers (sorted by speed):`, this.moveQueue.map(c => `${c.name}(spd:${c.speed})`).join(', ') || '(none)');
        this.executeNextMove();
    }

    executeNextMove() {
        if (this.currentMoveIndex >= this.moveQueue.length) {
            // Move phase complete - add delay before action phase to ensure animations settle
            devLog('Move phase complete, waiting for animations to settle...');
            this.currentPhase = 'action';

            // Small delay to ensure all movement visuals are complete
            setTimeout(() => {
                devLog('Animation settle complete, starting action phase');
                this.executeActionPhase();
            }, 100);
            return;
        }

        const character = this.moveQueue[this.currentMoveIndex];

        // Skip if character was defeated during this phase
        if (character.isDefeated) {
            devLog(`[MOVE] Skipping ${character.name} - already defeated`);
            this.currentMoveIndex++;
            this.executeNextMove();
            return;
        }

        const action = this.characterActions.get(character);
        const moveNum = this.currentMoveIndex + 1;
        const totalMoves = this.moveQueue.length;

        devLog(`[MOVE ${moveNum}/${totalMoves}] ${character.name} attempting move from (${character.hexQ},${character.hexR}) to (${action.target.q},${action.target.r})`);

        // Check if target hex is occupied (collision detection)
        const characterAtTarget = this.getCharacterAtHex(action.target.q, action.target.r);
        if (characterAtTarget) {
            devLog(`[MOVE ${moveNum}/${totalMoves}] ${character.name} BLOCKED - hex occupied by ${characterAtTarget.name}`);
            this.currentMoveIndex++;
            this.executeNextMove();
            return;
        }

        // Execute move with callback
        character.movementQueue = [action.target];
        character.isMoving = true;
        character.currentMoveTimer = 0;

        this.movementSystem.onMovementComplete(character, () => {
            devLog(`[MOVE ${moveNum}/${totalMoves}] ${character.name} movement COMPLETE, now at (${character.hexQ},${character.hexR})`);
            this.currentMoveIndex++;
            this.executeNextMove();
        });
    }

    /**
     * Execute all ATTACK actions after moves, sorted by speed
     */
    executeActionPhase() {
        devLog('=== ACTION PHASE START ===');

        // Filter characters with ATTACK actions, sort by speed
        const attackers = this.executionQueue.filter(char => {
            const action = this.characterActions.get(char);
            return action && action.action === COMBAT_ACTIONS.ATTACK;
        });
        this.actionQueue = this.sortBySpeed(attackers);
        this.currentActionIndex = 0;

        devLog(`Attackers (sorted by speed):`, this.actionQueue.map(c => `${c.name}(spd:${c.speed})`).join(', ') || '(none)');
        this.executeNextAttack();
    }

    executeNextAttack() {
        if (this.currentActionIndex >= this.actionQueue.length) {
            // All attacks done, next turn
            devLog('=== ACTION PHASE COMPLETE ===');
            devLog(`Advancing to turn ${this.turnNumber + 1}`);
            this.turnNumber++;
            this.setState(GAME_STATES.COMBAT_INPUT);
            return;
        }

        const character = this.actionQueue[this.currentActionIndex];

        // Skip if character was defeated during this phase
        if (character.isDefeated) {
            devLog(`[ATTACK] Skipping ${character.name} - already defeated`);
            this.currentActionIndex++;
            this.executeNextAttack();
            return;
        }

        const action = this.characterActions.get(character);
        const attackNum = this.currentActionIndex + 1;
        const totalAttacks = this.actionQueue.length;

        devLog(`[ATTACK ${attackNum}/${totalAttacks}] ${character.name} at (${character.hexQ},${character.hexR}) attacking hex (${action.target.q},${action.target.r})`);

        // Get whoever is NOW at the target hex (may be different from original target!)
        // Attacks hit whoever is on the hex, even allies (accidents happen)
        const targetChar = this.getCharacterAtHex(action.target.q, action.target.r);

        devLog(`[ATTACK ${attackNum}/${totalAttacks}] Target at hex:`, targetChar ? `${targetChar.name} (defeated:${targetChar.isDefeated})` : 'EMPTY');

        // Face the target hex regardless of whether target is there
        const targetPixel = this.hexGrid.hexToPixel(action.target.q, action.target.r);
        const dx = targetPixel.x - character.pixelX;
        const dy = targetPixel.y - character.pixelY;
        this.movementSystem.updateFacing(character, dx, dy);

        // Play attack animation - reset frame to 0 to fix intermittent wrong frame order
        character.animationFrame = 0;
        character.animationTimer = 0;
        character.currentAnimation = 'attack';
        devLog(`[ANIM] ${character.name} animation reset to frame 0, starting attack`);

        setTimeout(() => {
            if (!targetChar) {
                // Auto-miss: no one at hex
                devLog(`[ATTACK ${attackNum}/${totalAttacks}] ${character.name} attacks empty hex - MISS!`);
            } else if (targetChar === character) {
                // Can't hit yourself
                devLog(`[ATTACK ${attackNum}/${totalAttacks}] ${character.name} swings at own hex - MISS!`);
            } else if (targetChar.isDefeated) {
                // Target already dead
                devLog(`[ATTACK ${attackNum}/${totalAttacks}] ${character.name} attacks dead body - no effect`);
            } else {
                // Execute attack - hits whoever is on the hex (ally or enemy!)
                devLog(`[ATTACK ${attackNum}/${totalAttacks}] ${character.name} attacks ${targetChar.name}!`);
                const result = this.combatSystem.executeAttack(character, targetChar);
                devLog(`[ATTACK ${attackNum}/${totalAttacks}] Result: hit=${result.hit}, damage=${result.damage}, defeated=${result.defenderDefeated}`);

                // Hostility trigger: target becomes hostile to attacker (even on miss!)
                if (!targetChar.isDefeated) {
                    targetChar.lastAttackedBy = character;

                    if (targetChar.mode === 'neutral') {
                        // Switch from neutral to aggressive, add attacker as enemy
                        targetChar.mode = 'aggressive';
                        targetChar.enemies = targetChar.enemies || new Set();
                        targetChar.enemies.add(character);
                        devLog(`[HOSTILITY] ${targetChar.name} becomes aggressive toward ${character.name}!`);
                    } else if (targetChar.mode === 'aggressive' && !targetChar.enemies.has(character)) {
                        // Already aggressive, but add new attacker to enemies
                        targetChar.enemies.add(character);
                        devLog(`[HOSTILITY] ${targetChar.name} adds ${character.name} to enemies!`);
                    }
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
            }, 1000);
        }, 200);
    }

    /**
     * Handle character defeat - mark as defeated but keep on hex
     */
    handleCharacterDefeat(character) {
        devLog(`[DEFEAT] ${character.name} defeated at (${character.hexQ},${character.hexR}) - body remains as obstacle`);

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

        // Return all living characters to idle
        this.game.pc.currentAnimation = 'idle';
        this.game.npcs.forEach(npc => {
            if (!npc.isDefeated) {
                npc.currentAnimation = 'idle';
            }
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