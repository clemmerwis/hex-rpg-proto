import { AISystem } from './AISystem.js';
import { hexKey, getFacingFromDelta, CONDITIONS } from './const.js';

export const GAME_STATES = {
    EXPLORATION: 'exploration',
    COMBAT_INPUT: 'combat_input',
    COMBAT_EXECUTION: 'combat_execution'
};

// Combat Actions
export const COMBAT_ACTIONS = {
    MOVE: 'move',
    WAIT: 'wait',
    ATTACK: 'attack',
    // Spent by a knocked-down character to clear CONDITIONS.KNOCKDOWN. Resolves
    // in the action phase alongside attacks — getting up costs you the round.
    STAND: 'stand'
};

/**
 * Is this character knocked down? Prone characters can neither move nor attack;
 * STAND is their only useful action.
 */
export function isKnockedDown(character) {
    return character.conditions?.has(CONDITIONS.KNOCKDOWN) ?? false;
}

export class GameStateManager {
    constructor(world, hexGrid, getCharacterAtHex, movementSystem, combatSystem, pathfinding, logger, combatExecutor, engagementManager) {
        this.world = world;
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.movementSystem = movementSystem;
        this.combatSystem = combatSystem;
        this.pathfinding = pathfinding;
        this.logger = logger;
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
            if (character === this.world.pc) {
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
        this.playerLastAttackAction = null;       // { origin, target, attackType } for Enter repeat

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

        // Log combat start or new round
        if (this.turnNumber === 1) {
            this.logger.combat('=== COMBAT START ===');
        } else {
            this.logger.combat(`--- Round ${this.turnNumber} ---`);
        }

        // Stop any current movement
        this.world.pc.isMoving = false;
        this.world.pc.movementQueue = [];
        // A prone PC keeps the held death pose — snapping to idle here would make
        // them look like they had already stood up, for free
        if (!this.world.pc.isDefeated && !isKnockedDown(this.world.pc)) {
            this.world.pc.currentAnimation = 'idle';
        }

        // Build list of ALL living characters (not just enemies)
        this.combatCharacters = [];
        if (!this.world.pc.isDefeated) {
            this.combatCharacters.push(this.world.pc);
        }
        const livingNPCs = this.world.npcs.filter(npc => !npc.isDefeated);
        this.combatCharacters.push(...livingNPCs);

        // Reset input data
        this.characterActions.clear();
        this.playerSelectedHex = null;

        // AI waits for player to choose action first
        // processAITurns() is called after player selects their action
    }

    processAITurns() {
        // The AI needs the FULL roster, defeated included — bodies stay on their
        // hex as obstacles, and a dead ally's grudges still inform its faction.
        // Every consumer that needs living-only filters isDefeated itself.
        const allCharacters = [this.world.pc, ...this.world.npcs];

        // Build distance matrix once for all AI characters this turn
        this.aiSystem.beginTurn(allCharacters);

        // Get all non-player characters
        const npcs = this.combatCharacters.filter(char => char !== this.world.pc);

        npcs.forEach(npc => {
            // Get AI decision based on mode and enemies
            const action = this.aiSystem.getAIAction(npc, allCharacters);
            this.setCharacterAction(npc, action);
        });

        // All actions should now be set (player + AI), transition to execution
        this.setState(GAME_STATES.COMBAT_EXECUTION);
    }

    /**
     * Store a character's action for this round, stamping declaration-time facts
     * that execution can no longer recover.
     *
     * `wasOccupied` separates a regular attack from a lead. Both can resolve
     * against an empty hex, but they mean opposite things: a regular attack was
     * aimed at somebody who then left, and is cancelled; a lead was aimed at open
     * ground on purpose, and swings. Execution cannot tell them apart on its own,
     * because by then the hex is empty either way.
     *
     * Every action must go through here — a raw characterActions.set() would skip
     * the stamp and silently make an attack behave as a lead.
     */
    setCharacterAction(character, action) {
        if (action?.action === COMBAT_ACTIONS.ATTACK && action.target) {
            const occupant = this.getCharacterAtHex(action.target.q, action.target.r);
            action.wasOccupied = !!occupant && !occupant.isDefeated;
        }
        this.characterActions.set(character, action);
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
        this.playerLastAttackAction = null;
        this.turnNumber = 1;

        // Reset HP buffers (temp HP resets after combat)
        if (this.world.pc.hpBufferByAttacker) {
            this.world.pc.hpBufferByAttacker.clear();
        }
        this.world.npcs.forEach(npc => {
            if (npc.hpBufferByAttacker) {
                npc.hpBufferByAttacker.clear();
            }
        });

        // Clear conditions (knockdown does not survive the fight that caused it)
        this.world.pc.conditions?.clear();
        this.world.npcs.forEach(npc => npc.conditions?.clear());

        // Clear engagement tracking
        this.engagementManager.clearAllEngagements(this.world.pc, this.world.npcs);

        // Return all living characters to idle
        this.world.pc.currentAnimation = 'idle';
        this.world.npcs.forEach(npc => {
            if (!npc.isDefeated) {
                npc.currentAnimation = 'idle';
            }
        });
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
        if (this.characterActions.has(this.world.pc)) return false; // Already chosen

        // Player chooses to wait
        this.setCharacterAction(this.world.pc, {
            action: COMBAT_ACTIONS.WAIT,
            target: null
        });

        // Player has chosen, now AI makes their decisions
        this.processAITurns();
        return true;
    }

    /**
     * Spend the round getting back up. Bound to the same key as skip/wait —
     * while prone that is the only thing worth doing, so Space means "stand"
     * rather than "wait" and the player never has to learn a second binding.
     */
    standPlayerUp() {
        if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
        if (this.characterActions.has(this.world.pc)) return false; // Already chosen
        if (!isKnockedDown(this.world.pc)) return false;

        this.setCharacterAction(this.world.pc, {
            action: COMBAT_ACTIONS.STAND,
            target: null
        });

        this.processAITurns();
        return true;
    }

    selectPlayerMoveTarget(hexQ, hexR) {
        if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
        if (this.characterActions.has(this.world.pc)) return false; // Already chosen
        if (isKnockedDown(this.world.pc)) return false; // Stand up first

        // Check if hex is adjacent to player
        const distance = this.hexGrid.hexDistance(
            { q: this.world.pc.hexQ, r: this.world.pc.hexR },
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
        this.setCharacterAction(this.world.pc, {
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
        if (this.characterActions.has(this.world.pc)) return false; // Already chosen
        if (isKnockedDown(this.world.pc)) return false; // Stand up first

        // Check if hex is adjacent to player
        const distance = this.hexGrid.hexDistance(
            { q: this.world.pc.hexQ, r: this.world.pc.hexR },
            { q: hexQ, r: hexR }
        );

        if (distance !== 1) {
            return false;
        }

        // Reject hexes holding a defeated body. Corpses stay on their hex forever
        // as obstacles, and executeNextAttack() no-ops against isDefeated targets,
        // so accepting this would silently burn the player's round.
        // Signalled to the player by HexGridRenderer.drawCombatOverlays(), which
        // draws an orange X over the hex while in attack mode.
        const targetOccupant = this.getCharacterAtHex(hexQ, hexR);
        if (targetOccupant?.isDefeated) {
            return false;
        }

        // Valid attack target (can attack empty hex - it will whiff)
        const attackAction = {
            action: COMBAT_ACTIONS.ATTACK,
            target: { q: hexQ, r: hexR },
            attackType: this.playerSelectedAttackType
        };

        // Commit facing to the target hex now, at declaration. Execution sets it
        // again anyway, but the player needs to see which way the swing has
        // committed them while there is still a decision to make — facing is
        // worth FLANK_THC_BONUS to whoever ends up behind them.
        const tPx = this.hexGrid.hexToPixel(hexQ, hexR);
        const aPx = this.hexGrid.hexToPixel(this.world.pc.hexQ, this.world.pc.hexR);
        this.world.pc.facing = getFacingFromDelta(tPx.x - aPx.x, tPx.y - aPx.y);

        this.playerSelectedHex = { q: hexQ, r: hexR };
        this.setCharacterAction(this.world.pc, attackAction);

        // Save for Enter repeat — origin anchors it so any movement invalidates the repeat
        this.playerLastAttackAction = {
            origin: { q: this.world.pc.hexQ, r: this.world.pc.hexR },
            target: { q: hexQ, r: hexR },
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
     * Can the player repeat their last attack (Enter key)?
     * Valid only while the PC still stands where that attack was declared —
     * moving off the origin hex invalidates the stored attack, since its target
     * is no longer the hex the player was aiming at.
     *
     * Checked at read time rather than cleared on move, so a move that gets
     * Blocked during execution correctly leaves the stored attack intact, and
     * any future source of displacement invalidates it without extra bookkeeping.
     *
     * Also drives the renderer's repeat-target preview — one source of truth.
     */
    canRepeatLastAttack() {
        if (this.currentState !== GAME_STATES.COMBAT_INPUT) return false;
        if (this.world.pc.isDefeated) return false;
        if (isKnockedDown(this.world.pc)) return false;
        if (this.characterActions.has(this.world.pc)) return false;

        const last = this.playerLastAttackAction;
        if (!last) return false;

        if (last.origin.q !== this.world.pc.hexQ
            || last.origin.r !== this.world.pc.hexR) return false;

        // A corpse holds its hex permanently and can never be meaningfully
        // attacked, so a repeat onto one would silently waste the round.
        // An empty target hex stays valid — the whiff is a legitimate gamble.
        const occupant = this.getCharacterAtHex(last.target.q, last.target.r);
        if (occupant?.isDefeated) return false;

        return true;
    }

    /**
     * Repeat last attack action (Enter key)
     * Re-issues the same absolute target hex and attack type
     */
    repeatLastAttack() {
        if (!this.canRepeatLastAttack()) return false;

        const { target, attackType } = this.playerLastAttackAction;

        // Set the attack type to match last attack
        this.playerSelectedAttackType = attackType;

        // Origin unchanged means the target is still adjacent, so this cannot fail
        return this.selectPlayerAttackTarget(target.q, target.r);
    }

    // For UI updates
    getEnemyCount() {
        return this.world.npcs.filter(npc => npc.faction === 'bandit').length;
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