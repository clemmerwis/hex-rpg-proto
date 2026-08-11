import { GAME_STATES, isKnockedDown } from './GameStateManager.js';
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
     * Processes: Space (skip), Q/E (facing), 1/2 (attack type), Enter (repeat).
     * @param {KeyboardEvent} e
     * @returns {boolean} true if event was consumed
     */
    handleCombatKeyDown(e) {
        // Space (no shift): stand up if prone, otherwise skip the turn.
        // Getting up is the only useful thing a prone character can do, so Space
        // carries it rather than introducing a binding that is dead 99% of the time.
        if (e.key === ' ' && !e.shiftKey) {
            e.preventDefault();
            if (!this.gameStateManager.characterActions.has(this.game.pc)) {
                if (isKnockedDown(this.game.pc)) {
                    this.gameStateManager.standPlayerUp();
                } else {
                    this.gameStateManager.skipPlayerTurn();
                }
            }
            return true;
        }

        // Attacking is off the table while prone — swallow the attack-mode keys
        // rather than arming a mode whose every click would silently fail
        if ((e.key === '1' || e.key === '2') && isKnockedDown(this.game.pc)) {
            e.preventDefault();
            return true;
        }

        // Q/E: rotate facing one hex step, Ctrl for two.
        // e.code, not e.key, so Caps Lock and Ctrl-held do not change the match.
        // e.repeat is swallowed deliberately: held-key auto-repeat used to spin
        // the facing several steps off a single tap, which read as the rotation
        // being inconsistent. One press is one step.
        if (e.code === 'KeyQ' || e.code === 'KeyE') {
            e.preventDefault();
            if (e.repeat) return true;
            const clockwise = e.code === 'KeyE';
            const steps = e.ctrlKey ? 2 : 1;
            this.game.pc.facing = rotateFacing(this.game.pc.facing, clockwise, steps);
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

        // Enter: repeat last attack (only while the stored attack is valid — see
        // GameStateManager.canRepeatLastAttack). Not consumed when unavailable,
        // so the key falls through instead of being silently swallowed.
        if (e.key === 'Enter' && this.gameStateManager.canRepeatLastAttack()) {
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
