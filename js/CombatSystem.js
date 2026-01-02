import { calculateDamage, calculateAttackRating, calculateDefenseRating } from './const.js';

export class CombatSystem {
    constructor(hexGrid, getCharacterAtHex, gameStateManager) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.gameStateManager = gameStateManager;
    }

    /**
     * Execute attack: check hit, deal damage
     * THC = Attack_R - Defense_R + 50%
     */
    executeAttack(attacker, defender) {
        // Calculate ratings from skills and stats
        const attackRating = calculateAttackRating(attacker);
        const defenseRating = calculateDefenseRating(defender);

        // Calculate to-hit chance
        const thc = (attackRating - defenseRating + 50) / 100;
        const hit = Math.random() < thc;

        if (!hit) {
            console.log(`${attacker.name} attacks ${defender.name} but MISSES!`);
            return { hit: false, damage: 0, defenderDefeated: false };
        }

        // Calculate damage from stats and weapon
        const damage = calculateDamage(attacker.stats, attacker.equipment.mainHand);

        // Apply damage through buffer first (per-attacker temp HP)
        const { bufferDamage, healthDamage } = this.applyDamage(attacker, defender, damage);

        const defeated = defender.health <= 0;

        // Mark defender as recently hit for health bar display
        this.gameStateManager.markCharacterHit(defender);

        if (bufferDamage > 0 && healthDamage > 0) {
            console.log(`${attacker.name} hits ${defender.name} for ${damage} (${bufferDamage} buffer, ${healthDamage} HP)!`);
        } else if (bufferDamage > 0) {
            console.log(`${attacker.name} hits ${defender.name} for ${bufferDamage} buffer damage!`);
        } else {
            console.log(`${attacker.name} hits ${defender.name} for ${healthDamage} HP damage!`);
        }
        if (defeated) {
            console.log(`${defender.name} has been defeated!`);
            defender.currentAnimation = 'die';
            defender.animationFrame = 0;
        } else {
            // Play impact animation when hit but not defeated
            defender.currentAnimation = 'impact';
            defender.animationFrame = 0;
        }

        return { hit: true, damage: damage, defenderDefeated: defeated };
    }

    /**
     * Apply damage through buffer first, then to health
     * Buffer is per-attacker: each attacker must deplete it individually
     */
    applyDamage(attacker, defender, damage) {
        // Initialize buffer for this attacker if not set
        if (!defender.hpBufferByAttacker.has(attacker)) {
            defender.hpBufferByAttacker.set(attacker, defender.hpBufferMax);
        }

        let remainingBuffer = defender.hpBufferByAttacker.get(attacker);
        let bufferDamage = 0;
        let healthDamage = 0;

        if (remainingBuffer > 0) {
            // Apply to buffer first
            bufferDamage = Math.min(damage, remainingBuffer);
            remainingBuffer -= bufferDamage;
            defender.hpBufferByAttacker.set(attacker, remainingBuffer);

            // Overflow goes to health
            healthDamage = damage - bufferDamage;
        } else {
            // Buffer depleted, all damage to health
            healthDamage = damage;
        }

        if (healthDamage > 0) {
            defender.health -= healthDamage;
            defender.health = Math.max(0, defender.health);
        }

        return { bufferDamage, healthDamage };
    }

    /**
     * Check if target is valid (adjacent, different faction)
     */
    isValidAttackTarget(hexQ, hexR, attacker) {
        const target = this.getCharacterAtHex(hexQ, hexR);
        if (!target) return false;
        if (target === attacker) return false;
        if (target.faction === attacker.faction) return false;

        // Check adjacency (range = 1)
        const distance = this.hexGrid.hexDistance(
            { q: attacker.hexQ, r: attacker.hexR },
            { q: hexQ, r: hexR }
        );
        return distance === 1;
    }
}
