import { GAME_CONSTANTS, calculateMoveSpeed, calculateActionSpeed, getSpeedTier, calculateInitiative, getFacingFromDelta, calculateAttackTiming, ARMOR_TYPES, CONDITIONS } from './const.js';
import { makeEnemies } from './utils.js';

export class CombatExecutor {
    constructor(hexGrid, getCharacterAtHex, movementSystem, combatSystem, logger) {
        const params = { hexGrid, getCharacterAtHex, movementSystem, combatSystem, logger };
        for (const [name, param] of Object.entries(params)) {
            if (!param) throw new Error(`CombatExecutor: missing required '${name}'`);
        }
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

        // Attack timing — derived from sprite data via setAttackTiming(),
        // falls back to GAME_CONSTANTS if never called
        this.attackWindupMs = GAME_CONSTANTS.COMBAT_ATTACK_WINDUP;
        this.attackRecoveryMs = GAME_CONSTANTS.COMBAT_ATTACK_RECOVERY;

        // Callbacks — set by GameStateManager after construction
        this.onExecutionComplete = null;
        this.onCharacterDefeated = null;
        this.onClearRecentlyHit = null;
        this.onClearPlayerSelection = null;
        this.onUpdateEngagement = null;
    }

    /**
     * Derive attack timing from a sprite set's animation data.
     * Call once after construction to replace GAME_CONSTANTS fallbacks.
     */
    setAttackTiming(spriteSet) {
        const timing = calculateAttackTiming(spriteSet);
        this.attackWindupMs = timing.windupMs;
        this.attackRecoveryMs = timing.recoveryMs;
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
            // Log blocked move with speed score + tooltip
            const blockedSpeed = calculateMoveSpeed(character);
            const bArmorKey = character.equipment.armor || 'none';
            const bArmor = ARMOR_TYPES[bArmorKey];
            const bTip = `${bArmor.name} mobility(${bArmor.mobility}) - Str(${character.stats.str}) | init: Will(${character.stats.will}) + Inst(${character.stats.instinct})`;
            this.logger.combat(`{{char:${character.name}}}: Move {{blocked}} {{tip:${bTip}}}{{spd}}${this.combatSystem.formatSpeedBracket(blockedSpeed, character)}{{/spd}}{{/tip}}`);
            this.currentMoveIndex++;
            this.executeNextMove();
            return;
        }

        // Clear player selection highlight when player starts moving
        if (this.onClearPlayerSelection) this.onClearPlayerSelection(character);

        // Log move action with speed score + tooltip
        const moveSpeed = calculateMoveSpeed(character);
        const mArmorKey = character.equipment.armor || 'none';
        const mArmor = ARMOR_TYPES[mArmorKey];
        const mTip = `${mArmor.name} mobility(${mArmor.mobility}) - Str(${character.stats.str}) | init: Will(${character.stats.will}) + Inst(${character.stats.instinct})`;
        this.logger.combat(`{{char:${character.name}}}: Move {{tip:${mTip}}}{{spd}}${this.combatSystem.formatSpeedBracket(moveSpeed, character)}{{/spd}}{{/tip}}`);

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
     * Execute all ATTACK and STAND actions after moves, sorted by speed
     * Standing up resolves here rather than in the move phase because it costs
     * the action, and it has to take its place in speed order among the swings
     * it is racing — a fast attacker can still put you back down first.
     */
    executeActionPhase() {
        const actors = this.executionQueue.filter(char => {
            const action = this.characterActions.get(char);
            return action && (action.action === 'attack' || action.action === 'stand');
        });
        this.actionQueue = this.sortBySpeed(actors, 'action', this.characterActions);
        this.currentActionIndex = 0;

        this.executeNextAttack();
    }

    /**
     * Spend the action getting up — clears the knockdown and drops the held
     * death pose that CombatSystem.applyKnockdown() borrowed for it.
     */
    executeStandUp(character) {
        character.conditions?.delete(CONDITIONS.KNOCKDOWN);
        character.animationFrame = 0;
        character.animationTimer = 0;
        character.currentAnimation = 'idle';

        const standSpeed = calculateActionSpeed(character, 'light');
        this.logger.combat(`{{char:${character.name}}}: Stands up {{spd}}${this.combatSystem.formatSpeedBracket(standSpeed, character)}{{/spd}}`);
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

        // Getting up consumes the whole action — no swing follows it
        if (action.action === 'stand') {
            this.executeStandUp(character);
            this.currentActionIndex++;
            this.executeNextAttack();
            return;
        }

        // Knocked down after this attack was declared but before it resolved.
        // The swing never happens — landing a knockdown on someone faster than
        // you is how you deny their action outright, which is the whole point of
        // the condition. Handled here for the same reason as the vacated-target
        // case below: skipping inside the windup timer would still play a full
        // visible swing that happens to deal nothing.
        if (character.conditions?.has(CONDITIONS.KNOCKDOWN)) {
            const denied = this.combatSystem.formatAttackTypeName(
                character.equipment.mainHand, action.attackType || 'light');
            this.logger.combat(`{{char:${character.name}}}: ${denied} {{blocked}} - knocked down before the swing`);
            this.currentActionIndex++;
            this.executeNextAttack();
            return;
        }

        // Get whoever is NOW at the target hex (may be different from original target!)
        // Attacks hit whoever is on the hex, even allies (accidents happen)
        const targetChar = this.getCharacterAtHex(action.target.q, action.target.r);

        // A regular attack whose target vacated during the move phase is called
        // off outright — no turn, no swing, no whiff. Only a lead (declared at an
        // empty hex on purpose) commits to striking open ground.
        //
        // This has to happen HERE rather than inside the windup timer below.
        // Facing and the attack animation are the only parts of an attack the
        // player can actually see, so running them and then skipping the damage
        // still reads as a full swing. Skipping the turn also matters mechanically
        // now that facing is worth FLANK_THC_BONUS to whoever ends up behind you —
        // an action that was never performed must not reposition you.
        if (!targetChar && action.wasOccupied) {
            const calledOff = this.combatSystem.formatAttackTypeName(
                character.equipment.mainHand, action.attackType || 'light');
            this.logger.combat(`{{char:${character.name}}}: ${calledOff} {{blocked}} - target left the hex`);
            this.currentActionIndex++;
            this.executeNextAttack();
            return;
        }

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
                // Only leads reach here — a vacated regular attack returned above.
                // Aimed at open ground on purpose and nobody arrived.
                this.combatSystem.handleWhiff(character, action.target, character.equipment.mainHand, action.attackType || 'light');
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

                    // Establish mutual hostility - attacking makes you enemies.
                    // Faction-mates pick this up via AISystem.getEffectiveEnemies(),
                    // which unions over the full roster including the dead.
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
            }, this.attackRecoveryMs);
        }, this.attackWindupMs);
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

        // Do NOT remove from game.npcs - dead body stays on hex and blocks movement.
        // Also load-bearing for hostility: AISystem.getEffectiveEnemies() unions
        // grudges across the full roster, so removing a body erases the grudges it
        // held. Read the TODO there before adding any body cleanup.
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
