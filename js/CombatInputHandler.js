import { GAME_STATES } from './GameStateManager.js';
import { rotateFacing } from './const.js';

export class CombatInputHandler {
    constructor() {
        // Combat attack mode (when player presses 1 or 2 for light/heavy attack)
        this.attackModeActive = false;

        // Dependencies (injected)
        this.game = null;
        this.gameStateManager = null;
    }

    setDependencies(deps) {
        const required = ['game', 'gameStateManager'];
        for (const dep of required) {
            if (!deps[dep]) throw new Error(`CombatInputHandler: missing required dependency '${dep}'`);
        }
        this.game = deps.game;
        this.gameStateManager = deps.gameStateManager;
    }

    /**
     * Handle mouse click during combat input phase.
     * If attackModeActive: select attack target, reset on success.
     * Otherwise: select move target.
     * @param {{q: number, r: number}} targetHex
     * @returns {boolean} true if handled
     */
    handleCombatClick(targetHex) {
        if (this.attackModeActive) {
            // Attack mode: click adjacent hex to attack it
            const success = this.gameStateManager.selectPlayerAttackTarget(targetHex.q, targetHex.r);
            if (success) {
                this.attackModeActive = false;  // Reset after successful attack selection
            }
        } else {
            // Move mode: click adjacent hex to move to it
            this.gameStateManager.selectPlayerMoveTarget(targetHex.q, targetHex.r);
        }
        return true;
    }

    /**
     * Handle keydown during combat input phase.
     * Processes: Space (skip), Arrow keys (facing), 1/2 (attack type), Enter (repeat).
     * @param {KeyboardEvent} e
     * @returns {boolean} true if event was consumed
     */
    handleCombatKeyDown(e) {
        // Space (no shift): skip turn if player hasn't acted
        if (e.key === ' ' && !e.shiftKey) {
            e.preventDefault();
            if (!this.gameStateManager.characterActions.has(this.game.pc)) {
                this.gameStateManager.skipPlayerTurn();
            }
            return true;
        }

        // ArrowLeft/ArrowRight: rotate facing (Ctrl for 2 steps)
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const steps = e.ctrlKey ? 2 : 1;
            this.game.pc.facing = rotateFacing(this.game.pc.facing, false, steps);
            return true;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const steps = e.ctrlKey ? 2 : 1;
            this.game.pc.facing = rotateFacing(this.game.pc.facing, true, steps);
            return true;
        }

        // Key '1': set light attack, activate attack mode
        if (e.key === '1') {
            e.preventDefault();
            this.gameStateManager.setPlayerAttackType('light');
            this.attackModeActive = true;
            return true;
        }

        // Key '2': set heavy attack, activate attack mode
        if (e.key === '2') {
            e.preventDefault();
            this.gameStateManager.setPlayerAttackType('heavy');
            this.attackModeActive = true;
            return true;
        }

        // Enter: repeat last attack
        if (e.key === 'Enter') {
            e.preventDefault();
            const success = this.gameStateManager.repeatLastAttack();
            if (success) {
                this.attackModeActive = false;
            }
            return true;
        }

        return false;
    }
}
