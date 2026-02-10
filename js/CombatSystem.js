import { calculateDamage, calculateAttackRating, calculateDefenseRating, calculateCSC, getEquipmentBonus, WEAPONS, ARMOR_TYPES, ATTACK_TYPES, STAT_BONUSES, DAMAGE_TYPE_PROPERTIES, isFlanking, getFacingFromDelta } from './const.js';

export class CombatSystem {
    constructor(hexGrid, getCharacterAtHex, gameStateManager, logger) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.gameStateManager = gameStateManager;
        this.logger = logger;
    }

    /**
     * Execute attack on a target hex
     * Attacks target the HEX, not the character - if hex is empty, attack misses
     * THC = ((Attack_R - Defense_R) + (50 - evasionBonus)) / 100
     * CSC = ((CSA_R - CSD_R) + 50) / 100
     * Damage pipeline: base → crit(x2) → vuln/resist → flat DR
     * Crit = 2x damage, critMultiplier from passives stacks multiplicatively if present
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

        // Format attack type name with styling tags
        let attackTypeName = ATTACK_TYPES[attackType]?.name || 'Attack';
        if (attackType === 'heavy') {
            attackTypeName = '{{heavy}}heavy{{/heavy}} Attack';
        }

        if (!defender) {
            // Empty hex - attack whiffs
            const whiffAttackName = attackType === 'heavy' ? '{{heavy}}heavy{{/heavy}} attacks' : `${attackType} attacks`;
            this.logger.combat(`{{char:${attacker.name}}} ${whiffAttackName} at empty hex (${targetHex.q}, ${targetHex.r}) - {{whiff}}`);
            // Animation already set by GameStateManager - don't reset here
            return { hit: false, damage: 0, crit: false, defenderDefeated: false, whiff: true };
        }

        // Check if attacking ally (friendly fire warning)
        const friendlyFire = defender.faction === attacker.faction;
        if (friendlyFire) {
            this.logger.warn(`[FRIENDLY FIRE WARNING] ${attacker.name} attacks ally ${defender.name}!`);
        }

        // Calculate ratings from skills and stats
        const attackRating = calculateAttackRating(attacker);
        const defenseRating = calculateDefenseRating(defender);

        // Calculate to-hit chance as integer percentage (0-100%)
        const evasionBonus = getEquipmentBonus(defender, 'evasionBonus');
        const thc = Math.max(0, Math.min(100, attackRating - defenseRating + (50 - evasionBonus)));

        // Roll d100 (1-100), hit if roll <= THC
        const thcRoll = Math.floor(Math.random() * 100) + 1;
        // Display inverted so "roll high = good" for player readability
        const thcPercent = 100 - thc;
        const rollPercent = 101 - thcRoll;
        const hit = thcRoll <= thc;

        if (!hit) {
            this.logger.combat(`{{char:${attacker.name}}} ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thcPercent}%{{/thc}}, Roll= {{roll}}${rollPercent}{{/roll}}, {{miss}})`);
            // Animation already set by GameStateManager - don't reset here
            return { hit: false, damage: 0, crit: false, defenderDefeated: false };
        }

        // Get weapon and armor info
        const weapon = WEAPONS[attacker.equipment.mainHand];
        const armor = ARMOR_TYPES[defender.equipment.armor || 'none'];

        // Calculate base damage from stats, weapon, and attack type
        let damage = calculateDamage(attacker.stats, attacker.equipment.mainHand, attackType);
        const baseDamage = damage;

        // Roll d100 for critical hit (CSC is integer percentage 0-100%)
        const csc = calculateCSC(attacker, defender);
        const cscRoll = Math.floor(Math.random() * 100) + 1;
        const crit = cscRoll <= csc;
        // Display inverted so "roll high = good" for player readability (same as THC)
        const cscPercent = 100 - csc;
        const cscRollPercent = 101 - cscRoll;

        if (crit) {
            // Critical hit: double damage
            damage *= 2;

            // Apply crit multiplier from equipment passives (if any)
            const critMult = getEquipmentBonus(attacker, 'critMultiplier');
            if (critMult > 0) {
                damage *= critMult;
            }
        }

        const damageAfterCrit = damage;

        // Apply resistance/vulnerability (before DR - multipliers amplify raw damage)
        let resistMod = null;
        if (armor.resistantAgainst.includes(weapon.type)) {
            damage = Math.floor(damage * 0.5);
            resistMod = 'resistant';
        } else if (armor.vulnerableAgainst.includes(weapon.type)) {
            let vulnMult = 1.5;
            // Enhancement replaces base multiplier when attack type matches
            if (attackType === 'light' && weapon.effects?.includes('vulnerableEnhancementLight')) {
                vulnMult = 2.0;
            } else if (attackType === 'heavy' && weapon.effects?.includes('vulnerableEnhancementHeavy')) {
                vulnMult = 2.5;
            }
            damage = Math.floor(damage * vulnMult);
            resistMod = vulnMult > 1.5 ? 'vulnerableEnhanced' : 'vulnerable';
        }

        const damageAfterResist = damage;

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

        // Apply DR (flat reduction, final step)
        const drAbsorbed = Math.min(damage, effectiveDR);
        damage = Math.max(0, damage - effectiveDR);

        const finalDamage = damage;

        // Build detailed combat log FIRST (before applying damage)
        let logParts = [];
        logParts.push(`{{char:${attacker.name}}} ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thcPercent}%{{/thc}}, Roll= {{roll}}${rollPercent}{{/roll}}, {{hit}})`);
        if (crit) logParts.push('{{critical}}');
        if (flanking) logParts.push('{{flanking}}');
        if (friendlyFire) logParts.push('{{friendlyFire}}');

        // Build detailed damage breakdown showing formula components
        const strMult = STAT_BONUSES.MULTIPLIER[attacker.stats.str] ?? 1;
        const strBonus = Math.ceil(weapon.force * strMult);
        const attackMod = ATTACK_TYPES[attackType]?.damageMod || 0;

        // Format weapon name (camelCase to hyphen-separated)
        const weaponName = attacker.equipment.mainHand.replace(/([A-Z])/g, '-$1').toLowerCase();

        // Base damage formula: weapon(base) + str(raw->mult Mult) x weapon force(X)
        let damageBreakdown = `${weaponName}(${weapon.base}) + str(${attacker.stats.str}->${strMult} Mult) x ${weaponName} force(${weapon.force})`;
        if (attackMod !== 0) damageBreakdown += ` + ${attackType}(${attackMod})`;
        damageBreakdown += ` = {{dmg}}${baseDamage}{{/dmg}}`;

        // Crit modifier
        if (crit) damageBreakdown += ` -> Crit: x2 = {{dmg}}${damageAfterCrit}{{/dmg}}`;

        // Resist/Vuln modifier (applied before DR)
        if (resistMod === 'resistant') {
            damageBreakdown += ` -> Resist: {{resist}}x0.5{{/resist}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        } else if (resistMod === 'vulnerable') {
            damageBreakdown += ` -> Vuln: {{vuln}}x1.5{{/vuln}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        } else if (resistMod === 'vulnerableEnhanced') {
            damageBreakdown += ` -> Vuln+: {{vuln}}x${attackType === 'heavy' ? '2.5' : '2.0'}{{/vuln}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        }

        // DR modifier with armor name (flat reduction, final step)
        if (effectiveDR > 0) {
            damageBreakdown += ` -> ${armor.name} DR({{dr}}-${effectiveDR}{{/dr}})`;
            if (flanking) damageBreakdown += ` (flanked ${Math.round(armor.flankingDefense * 100)}%)`;
            damageBreakdown += ` = {{dmg}}${finalDamage}{{/dmg}}`;
        }

        // Log attack result and damage breakdown on separate lines
        this.logger.combat(logParts.join(' '));
        if (crit) this.logger.combat(`  CSC= {{csc}}${cscPercent}%{{/csc}}, Roll= {{roll}}${cscRollPercent}{{/roll}}, CRIT`);
        this.logger.combat(`  {{hitPrefix}} ${damageBreakdown}`);

        // NOW apply damage through buffer (per-attacker temp HP) - logs appear after damage calc
        const { bufferDamage, healthDamage, bufferBefore, bufferAfter, healthBefore, healthAfter, bypassed } = this.applyDamage(attacker, defender, damage);

        // Log where the damage actually went (context-sensitive)
        if (bypassed && healthDamage > 0) {
            // Buffer bypassed - damage went directly to HP
            this.logger.combat(`    → {{char:${defender.name}}}: {{dmg}}-${healthDamage}{{/dmg}} HP {{hp}}(${healthBefore} → ${healthAfter}){{/hp}} {{buf_bypassed}}[buffer bypassed]{{/buf_bypassed}}`);
        } else if (bufferDamage > 0 && healthDamage > 0) {
            // Damage overflowed buffer into HP
            this.logger.combat(`    → {{char:${defender.name}}}: {{dmg}}-${bufferDamage}{{/dmg}} {{buf_depleted}}buffer (depleted){{/buf_depleted}}, {{dmg}}-${healthDamage}{{/dmg}} HP {{hp}}(${healthBefore} → ${healthAfter}){{/hp}}`);
        } else if (bufferDamage > 0) {
            // All damage went to buffer
            this.logger.combat(`    → {{char:${defender.name}}}: {{dmg}}-${bufferDamage}{{/dmg}} {{buf}}buffer (${bufferBefore} → ${bufferAfter}){{/buf}}`);
        } else if (healthDamage > 0) {
            // Buffer already depleted, all damage to HP
            this.logger.combat(`    → {{char:${defender.name}}}: {{dmg}}-${healthDamage}{{/dmg}} HP {{hp}}(${healthBefore} → ${healthAfter}){{/hp}}`);
        }

        const defeated = defender.health <= 0;

        // Mark defender as recently hit for health bar display
        this.gameStateManager.markCharacterHit(defender);

        if (defeated) {
            this.logger.combat(`{{char:${defender.name}}} has been defeated!`);
            // Die animation will be set by GameStateManager.handleCharacterDefeat()
        } else if (finalDamage > 0) {
            // Play impact animation when hit but not defeated
            defender.currentAnimation = 'impact';
            defender.animationFrame = 0;
        }

        // Attacker animation already set by GameStateManager - don't reset here
        return { hit: true, damage: finalDamage, crit: crit, defenderDefeated: defeated, flanking: flanking };
    }

    /**
     * Apply damage through buffer first, then to health
     * Buffer is per-attacker: each attacker must deplete it individually
     * Some damage types (e.g., concussive) bypass buffer entirely
     */
    applyDamage(attacker, defender, damage) {
        // Check if damage type bypasses buffer
        const weapon = WEAPONS[attacker.equipment.mainHand];
        const typeProps = DAMAGE_TYPE_PROPERTIES[weapon.type] || {};
        const bypassBuffer = typeProps.bypassBuffer || false;

        const defenderPos = `${defender.name}@(${defender.hexQ},${defender.hexR})`;
        let bufferDamage = 0;
        let healthDamage = 0;
        let bufferBefore = 0;
        let bufferAfter = 0;

        if (bypassBuffer) {
            // Bypass buffer entirely - all damage goes to health
            healthDamage = damage;
            this.logger.debug(`[BUFFER BYPASS] ${defenderPos} vs ${attacker.name}: ${weapon.type} damage bypasses buffer`);
        } else {
            // Normal buffer logic
            // Initialize buffer for this attacker if not set
            const isNewBuffer = !defender.hpBufferByAttacker.has(attacker);

            if (isNewBuffer) {
                defender.hpBufferByAttacker.set(attacker, defender.hpBufferMax);
                this.logger.debug(`[BUFFER INIT] ${defenderPos} buffer vs ${attacker.name}: ${defender.hpBufferMax} HP (instinct=${defender.stats.instinct}, will=${defender.stats.will})`);
            }

            let remainingBuffer = defender.hpBufferByAttacker.get(attacker);
            bufferBefore = remainingBuffer;

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

            bufferAfter = remainingBuffer;
        }

        const healthBefore = defender.health;

        if (healthDamage > 0) {
            defender.health -= healthDamage;
            defender.health = Math.max(0, defender.health);
        }

        const healthAfter = defender.health;

        return { bufferDamage, healthDamage, bufferBefore, bufferAfter, healthBefore, healthAfter, bypassed: bypassBuffer };
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
