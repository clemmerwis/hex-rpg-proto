export class CombatSystem {
    constructor(hexGrid, getCharacterAtHex) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
    }

    /**
     * Execute attack: check hit, deal damage
     * THC = Attack_R - Defense_R + 50%
     */
    executeAttack(attacker, defender) {
        // Calculate to-hit chance
        const thc = (attacker.attack_rating - defender.defense_rating + 50) / 100;
        const hit = Math.random() < thc;

        if (!hit) {
            console.log(`${attacker.name} attacks ${defender.name} but MISSES!`);
            return { hit: false, damage: 0, defenderDefeated: false };
        }

        // Simple fixed damage for now
        const damage = 10;
        defender.health -= damage;
        defender.health = Math.max(0, defender.health);

        const defeated = defender.health <= 0;

        console.log(`${attacker.name} hits ${defender.name} for ${damage} damage!`);
        if (defeated) {
            console.log(`${defender.name} has been defeated!`);
            defender.currentAnimation = 'die';
        }

        return { hit: true, damage: damage, defenderDefeated: defeated };
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
