import { calculateDamage, calculateAttackRating, calculateDefenseRating, calculateCSC, getEquipmentBonus, WEAPONS, ARMOR_TYPES, ATTACK_TYPES, isFlanking, getFacingFromDelta } from './const.js';

export class CombatSystem {
    constructor(hexGrid, getCharacterAtHex, gameStateManager) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.gameStateManager = gameStateManager;
    }

    /**
     * Execute attack on a target hex
     * Attacks target the HEX, not the character - if hex is empty, attack misses
     * THC = ((Attack_R - Defense_R) + (50 - evasionBonus)) / 100
     * CSC = ((CSA_R - CSD_R) + 50) / 100
     * Crit = 2x damage, critMultiplier from passives stacks (unarmed = 4x on crit)
     */
    executeAttack(attacker, targetHex, attackType = 'light') {
        // Face the target hex before attacking
        const targetPixel = this.hexGrid.hexToPixel(targetHex.q, targetHex.r);
        const attackerPixel = this.hexGrid.hexToPixel(attacker.hexQ, attacker.hexR);
        const dx = targetPixel.x - attackerPixel.x;
        const dy = targetPixel.y - attackerPixel.y;
        attacker.facing = getFacingFromDelta(dx, dy);

        // Check if there's a character at the target hex
        const defender = this.getCharacterAtHex(targetHex.q, targetHex.r);

        const attackTypeName = ATTACK_TYPES[attackType]?.name || 'Attack';

        if (!defender) {
            // Empty hex - attack whiffs
            console.log(`${attacker.name} ${attackTypeName.toLowerCase()}s at empty hex (${targetHex.q}, ${targetHex.r}) - WHIFF!`);
            attacker.currentAnimation = 'attack';
            attacker.animationFrame = 0;
            return { hit: false, damage: 0, crit: false, defenderDefeated: false, whiff: true };
        }

        // Check if attacking ally (friendly fire warning)
        const friendlyFire = defender.faction === attacker.faction;
        if (friendlyFire) {
            console.log(`[FRIENDLY FIRE WARNING] ${attacker.name} attacks ally ${defender.name}!`);
        }

        // Calculate ratings from skills and stats
        const attackRating = calculateAttackRating(attacker);
        const defenseRating = calculateDefenseRating(defender);

        // Calculate to-hit chance (evasionBonus reduces base 50%)
        const evasionBonus = getEquipmentBonus(defender, 'evasionBonus');
        const thc = (attackRating - defenseRating + (50 - evasionBonus)) / 100;
        const hit = Math.random() < thc;

        if (!hit) {
            console.log(`${attacker.name} ${attackTypeName.toLowerCase()}s ${defender.name} but MISSES!`);
            attacker.currentAnimation = 'attack';
            attacker.animationFrame = 0;
            return { hit: false, damage: 0, crit: false, defenderDefeated: false };
        }

        // Get weapon and armor info
        const weapon = WEAPONS[attacker.equipment.mainHand];
        const armor = ARMOR_TYPES[defender.equipment.armor || 'none'];

        // Calculate base damage from stats, weapon, and attack type
        let damage = calculateDamage(attacker.stats, attacker.equipment.mainHand, attackType);
        const baseDamage = damage;

        // Roll for critical hit
        const csc = calculateCSC(attacker, defender);
        const crit = Math.random() < csc;

        if (crit) {
            // Critical hit: double damage
            damage *= 2;

            // Apply crit multiplier from equipment passives (e.g., unarmed = 2x, so 4x total)
            const critMult = getEquipmentBonus(attacker, 'critMultiplier');
            if (critMult > 0) {
                damage *= critMult;
            }
        }

        const damageAfterCrit = damage;

        // Check flanking (attacker behind defender OR defender over-engaged)
        const behindDefender = isFlanking(
            { q: attacker.hexQ, r: attacker.hexR },
            { q: defender.hexQ, r: defender.hexR },
            defender.facing,
            this.hexGrid
        );
        const cannotEngageBack = !this.gameStateManager.canEngageBack(defender, attacker);
        const flanking = behindDefender || cannotEngageBack;

        // Calculate effective DR (modified by flanking)
        let effectiveDR = armor.defense;
        if (flanking) {
            effectiveDR = Math.floor(armor.defense * armor.flankingDefense);
        }

        // Apply DR
        const drAbsorbed = Math.min(damage, effectiveDR);
        damage = Math.max(0, damage - effectiveDR);

        // Apply resistance/vulnerability (after DR, only if damage > 0)
        let resistMod = null;
        if (damage > 0) {
            if (armor.resistantAgainst.includes(weapon.type)) {
                damage = Math.floor(damage * 0.5);
                resistMod = 'resistant';
            } else if (armor.vulnerableAgainst.includes(weapon.type)) {
                damage = Math.floor(damage * 1.5);
                resistMod = 'vulnerable';
            }
        }

        const finalDamage = damage;

        // Apply damage through buffer first (per-attacker temp HP)
        const { bufferDamage, healthDamage } = this.applyDamage(attacker, defender, damage);

        const defeated = defender.health <= 0;

        // Mark defender as recently hit for health bar display
        this.gameStateManager.markCharacterHit(defender);

        // Build detailed combat log
        let logParts = [];
        logParts.push(`${attacker.name} ${attackTypeName.toLowerCase()}s ${defender.name}`);
        if (friendlyFire) logParts.push('[FRIENDLY FIRE]');
        if (flanking) logParts.push('[FLANKING]');
        if (crit) logParts.push('[CRITICAL]');

        let damageBreakdown = `Base: ${baseDamage}`;
        if (crit) damageBreakdown += ` → Crit: ${damageAfterCrit}`;
        if (drAbsorbed > 0) damageBreakdown += ` → DR: -${drAbsorbed}${flanking ? ` (flanked ${Math.round(armor.flankingDefense * 100)}%)` : ''}`;
        if (resistMod === 'resistant') damageBreakdown += ` → Resist: ×0.5`;
        if (resistMod === 'vulnerable') damageBreakdown += ` → Vuln: ×1.5`;
        damageBreakdown += ` = ${finalDamage}`;

        console.log(`${logParts.join(' ')} | ${damageBreakdown}`);

        if (finalDamage > 0) {
            if (bufferDamage > 0 && healthDamage > 0) {
                console.log(`  → ${bufferDamage} to buffer, ${healthDamage} to HP`);
            } else if (bufferDamage > 0) {
                console.log(`  → ${bufferDamage} to buffer`);
            } else {
                console.log(`  → ${healthDamage} to HP`);
            }
        } else {
            console.log(`  → No damage (fully absorbed by armor)`);
        }

        if (defeated) {
            console.log(`${defender.name} has been defeated!`);
            defender.currentAnimation = 'die';
            defender.animationFrame = 0;
        } else if (finalDamage > 0) {
            // Play impact animation when hit but not defeated
            defender.currentAnimation = 'impact';
            defender.animationFrame = 0;
        }

        // Play attacker's attack animation
        attacker.currentAnimation = 'attack';
        attacker.animationFrame = 0;

        return { hit: true, damage: finalDamage, crit: crit, defenderDefeated: defeated, flanking: flanking };
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
