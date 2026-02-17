import { calculateDamage, calculateAttackRating, calculateDefenseRating, calculateCSC, getEquipmentBonus, WEAPONS, ARMOR_TYPES, ATTACK_TYPES, STAT_BONUSES, DAMAGE_TYPE_PROPERTIES, isFlanking, getFacingFromDelta } from './const.js';

export class CombatSystem {
    constructor(hexGrid, getCharacterAtHex, gameStateManager, logger) {
        this.hexGrid = hexGrid;
        this.getCharacterAtHex = getCharacterAtHex;
        this.gameStateManager = gameStateManager;
        this.logger = logger;
    }

    /**
     * Execute attack on a target hex — pipeline orchestrator
     *
     * Pipeline stages:
     *  1. Face target (getFacingFromDelta)
     *  2. Lookup defender → handleWhiff() if empty
     *  3. Format attack name (formatAttackTypeName)
     *  4. Check friendly fire
     *  5. Resolve hit roll (resolveHitRoll) → handleMiss() if miss
     *  6. Get weapon/armor
     *  7. Calculate base damage (calculateDamage)
     *  8. Apply resistance modifier (applyResistanceModifier)
     *  9. Calculate flanking and DR (calculateFlankingAndDR)
     * 10. Apply crit modifier (applyCritModifier)
     * 11. Build and emit combat log (buildDamageBreakdown, buildCombatLogLines)
     * 12. Apply damage through buffer (applyDamage)
     * 13. Log damage application (logDamageApplication)
     * 14. Return hit result (handleHitResult)
     */
    executeAttack(attacker, targetHex, attackType = 'light') {
        // 1. Face target
        const tPx = this.hexGrid.hexToPixel(targetHex.q, targetHex.r);
        const aPx = this.hexGrid.hexToPixel(attacker.hexQ, attacker.hexR);
        attacker.facing = getFacingFromDelta(tPx.x - aPx.x, tPx.y - aPx.y);
        // 2. Lookup defender → whiff if empty
        const defender = this.getCharacterAtHex(targetHex.q, targetHex.r);
        const weaponKey = attacker.equipment.mainHand;
        if (!defender) return this.handleWhiff(attacker, targetHex, weaponKey, attackType);
        // 3. Format attack name  4. Check friendly fire
        const attackTypeName = this.formatAttackTypeName(weaponKey, attackType);
        const friendlyFire = defender.faction === attacker.faction;
        if (friendlyFire) this.logger.warn(`[FRIENDLY FIRE WARNING] ${attacker.name} attacks ally ${defender.name}!`);
        // 5. Resolve hit roll → miss if failed
        const { hit, thcPercent, rollPercent } = this.resolveHitRoll(attacker, defender);
        if (!hit) return this.handleMiss(attacker, defender, attackTypeName, { thcPercent, rollPercent });
        // 6. Get weapon and armor  7. Calculate base damage
        const weapon = WEAPONS[weaponKey];
        const armor = ARMOR_TYPES[defender.equipment.armor || "none"];
        let damage = calculateDamage(attacker.stats, weaponKey, attackType);
        const baseDamage = damage;
        // 8. Apply resistance/vulnerability
        let resistMod;
        ({ damage, resistMod } = this.applyResistanceModifier(damage, weapon, armor, attackType));
        const damageAfterResist = damage;
        // 9. Calculate flanking and DR
        let flanking, effectiveDR, drAbsorbed;
        ({ flanking, effectiveDR, drAbsorbed, damage } = this.calculateFlankingAndDR(attacker, defender, damage, armor));
        const damageAfterDR = damage;
        // 10. Apply crit modifier
        let crit, cscPercent, cscRollPercent;
        ({ crit, cscPercent, cscRollPercent, damage } = this.applyCritModifier(attacker, defender, damage));
        const finalDamage = damage;
        // 11. Build and emit combat log
        const breakdown = this.buildDamageBreakdown(attacker, attackType, weapon, armor, baseDamage, damageAfterResist, resistMod, effectiveDR, flanking, drAbsorbed, damageAfterDR, crit, finalDamage, defender);
        this.buildCombatLogLines(attacker, defender, attackTypeName, thcPercent, rollPercent, crit, flanking, friendlyFire, cscPercent, cscRollPercent, breakdown).forEach(line => this.logger.combat(line));
        // 12. Apply damage through buffer  13. Log damage application
        const damageResult = this.applyDamage(attacker, defender, damage);
        this.logDamageApplication(defender, attacker, damageResult);
        // 14. Return hit result
        return this.handleHitResult(attacker, defender, finalDamage, crit, flanking);
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
     * Resolve hit roll: calculate THC from ratings and roll d100
     * Pure calculation — no side effects, no logging
     * Returns { hit, thc, thcRoll, thcPercent, rollPercent }
     */
    resolveHitRoll(attacker, defender) {
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

        return { hit, thc, thcRoll, thcPercent, rollPercent };
    }

    /**
     * Calculate flanking status and apply DR (flat damage reduction)
     * Side-effect-free (read-only queries on gameStateManager and hexGrid)
     * Returns { flanking, behindDefender, cannotEngageBack, effectiveDR, drAbsorbed, damage: damageAfterDR }
     */
    calculateFlankingAndDR(attacker, defender, damage, armor) {
        // Check flanking (attacker behind defender OR defender over-engaged)
        const behindDefender = isFlanking(
            { q: attacker.hexQ, r: attacker.hexR },
            { q: defender.hexQ, r: defender.hexR },
            defender.facing,
            this.hexGrid
        );
        const cannotEngageBack = !this.engagementManager.canEngageBack(defender, attacker);
        const flanking = behindDefender || cannotEngageBack;

        // Calculate effective DR (modified by flanking)
        let effectiveDR = armor.defense;
        if (flanking) {
            effectiveDR = Math.floor(armor.defense * armor.flankingDefense);
        }

        // Apply DR (flat reduction, before crit)
        const drAbsorbed = Math.min(damage, effectiveDR);
        damage = Math.max(0, damage - effectiveDR);

        return { flanking, behindDefender, cannotEngageBack, effectiveDR, drAbsorbed, damage };
    }

    /**
     * Roll for critical hit and apply crit damage multiplier
     * Has a random roll (d100) so not deterministic, but isolated
     * Returns { crit, csc, cscRoll, cscPercent, cscRollPercent, damage: finalDamage }
     */
    applyCritModifier(attacker, defender, damage) {
        // Roll d100 for critical hit (CSC is integer percentage 0-100%)
        const csc = calculateCSC(attacker, defender);
        const cscRoll = Math.floor(Math.random() * 100) + 1;
        const crit = cscRoll <= csc;
        // Display inverted so "roll high = good" for player readability (same as THC)
        const cscPercent = 100 - csc;
        const cscRollPercent = 101 - cscRoll;

        if (crit) {
            // Critical hit: 1.5x damage (applied last in pipeline)
            damage = Math.floor(damage * 1.5);

            // Apply crit multiplier from equipment passives (if any)
            const critMult = getEquipmentBonus(attacker, 'critMultiplier');
            if (critMult > 0) {
                damage *= critMult;
            }
        }

        return { crit, csc, cscRoll, cscPercent, cscRollPercent, damage };
    }

    /**
     * Apply resistance/vulnerability modifier to damage based on weapon type vs armor
     * Pure calculation — no side effects
     * Returns { damage: modifiedDamage, resistMod } where resistMod is null | 'resistant' | 'vulnerable' | 'vulnerableEnhanced'
     */
    applyResistanceModifier(damage, weapon, armor, attackType) {
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
        return { damage, resistMod };
    }

    /**
     * Format the attack type name for combat log display
     * Pure string building — no side effects
     * Returns e.g. "{{weapon:longSword}} Attack" or "{{heavy}}heavy{{/heavy}} {{weapon:longSword}} attacks"
     */
    formatAttackTypeName(weaponKey, attackType, verb = "Attack") {
        const heavyPrefix = attackType === "heavy" ? "{{heavy}}heavy{{/heavy}} " : "";
        return `${heavyPrefix}{{weapon:${weaponKey}}} ${verb}`;
    }

    /**
     * Build the detailed damage breakdown string with semantic tokens
     * Pure string building — references STAT_BONUSES, ATTACK_TYPES for formula display
     * Returns the complete breakdown: base {{tip}} → resist/vuln → DR → crit
     */
    buildDamageBreakdown(attacker, attackType, weapon, armor, baseDamage, damageAfterResist, resistMod, effectiveDR, flanking, drAbsorbed, damageAfterDR, crit, finalDamage, defender) {
        const strMult = STAT_BONUSES.MULTIPLIER[attacker.stats.str] ?? 1;
        const strBonus = Math.ceil(weapon.force * strMult);
        const attackMod = ATTACK_TYPES[attackType]?.damageMod || 0;

        // Format weapon name (camelCase to hyphen-separated)
        const weaponName = attacker.equipment.mainHand.replace(/([A-Z])/g, "-$1").toLowerCase();

        // Base damage formula (detail shown on hover, only base number visible)
        let baseFormula = `${weaponName}_dmg: ${weapon.base}`;
        if (attackMod !== 0) baseFormula += ` + ${attackType}_dmg: ${attackMod}`;
        baseFormula += ` + (str_multiplier: ${strMult} x ${weaponName}_force: ${weapon.force})`;
        let breakdown = `{{tip:${baseFormula}}}{{dmg}}${baseDamage}{{/dmg}}{{/tip}}`;

        // Resist/Vuln modifier (applied before DR)
        if (resistMod === "resistant") {
            breakdown += ` -> Resist: {{resist}}x0.5{{/resist}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        } else if (resistMod === "vulnerable") {
            breakdown += ` -> Vuln: {{vuln}}x1.5{{/vuln}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        } else if (resistMod === "vulnerableEnhanced") {
            breakdown += ` -> Vuln+: {{vuln}}x${attackType === "heavy" ? "2.5" : "2.0"}{{/vuln}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        }

        // DR modifier with armor name
        if (effectiveDR > 0) {
            const armorKey = defender.equipment.armor || "none";
            breakdown += ` -> {{armor:${armorKey}}} DR({{dr}}-${effectiveDR}{{/dr}})`;
            if (flanking) breakdown += ` (flanked ${Math.round(armor.flankingDefense * 100)}%)`;
            breakdown += ` = {{dmg}}${damageAfterDR}{{/dmg}}`;
        }

        // Crit modifier (applied last, after DR)
        if (crit) breakdown += ` -> Crit: x1.5 = {{dmg}}${finalDamage}{{/dmg}}`;

        return breakdown;
    }

    /**
     * Build the array of combat log lines for a hit
     * Pure string building — no side effects
     * Returns array of log strings: header (with tags), optional CSC line, damage breakdown line
     */
    buildCombatLogLines(attacker, defender, attackTypeName, thcPercent, rollPercent, crit, flanking, friendlyFire, cscPercent, cscRollPercent, damageBreakdown) {
        let logParts = [];
        logParts.push(`{{char:${attacker.name}}}: ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thcPercent}%{{/thc}}, Roll= {{roll}}${rollPercent}{{/roll}}, {{hit}})`);
        if (crit) logParts.push("{{critical}}");
        if (flanking) logParts.push("{{flanking}}");
        if (friendlyFire) logParts.push("{{friendlyFire}}");

        const lines = [];
        if (crit) logParts.push(`CSC= {{csc}}${cscPercent}%{{/csc}}, Roll= {{roll}}${cscRollPercent}{{/roll}}`);
        lines.push(logParts.join(" "));
        lines.push(`  {{hitPrefix}} ${damageBreakdown}`);

        return lines;
    }

    /**
     * Log where damage was applied (buffer, HP, or both)
     * Side-effect method — calls this.logger.combat() directly
     * Handles 4 conditional branches: bypassed, overflow, buffer-only, health-only
     */
    logDamageApplication(defender, attacker, damageResult) {
        const { bufferDamage, healthDamage, bufferBefore, bufferAfter, healthBefore, healthAfter, bypassed } = damageResult;

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
    }

    /**
     * Handle attack on empty hex (whiff)
     * Logs the whiff message and returns the whiff result object
     * Returns { hit: false, damage: 0, crit: false, defenderDefeated: false, whiff: true }
     */
    handleWhiff(attacker, targetHex, weaponKey, attackType) {
        const whiffAttackName = this.formatAttackTypeName(weaponKey, attackType, "attacks");
        this.logger.combat(`{{char:${attacker.name}}}: ${whiffAttackName} at empty hex (${targetHex.q}, ${targetHex.r}) - {{whiff}}`);
        return { hit: false, damage: 0, crit: false, defenderDefeated: false, whiff: true };
    }

    /**
     * Handle a missed attack (THC roll failed)
     * Logs the miss message with THC/roll data and returns the miss result object
     * Returns { hit: false, damage: 0, crit: false, defenderDefeated: false }
     */
    handleMiss(attacker, defender, attackTypeName, hitResult) {
        const { thcPercent, rollPercent } = hitResult;
        this.logger.combat(`{{char:${attacker.name}}}: ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thcPercent}%{{/thc}}, Roll= {{roll}}${rollPercent}{{/roll}}, {{miss}})`);
        return { hit: false, damage: 0, crit: false, defenderDefeated: false };
    }

    /**
     * Handle a successful hit result (defeat check, animations, return)
     * Marks defender as hit, triggers defeat/impact animation, returns hit result object
     * Returns { hit: true, damage: finalDamage, crit, defenderDefeated: defeated, flanking }
     */
    handleHitResult(attacker, defender, finalDamage, crit, flanking) {
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

        return { hit: true, damage: finalDamage, crit, defenderDefeated: defeated, flanking };
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
