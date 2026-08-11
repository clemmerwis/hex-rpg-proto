import { calculateDamage, calculateAttkR, calculateDefR, calculateCSC, getEquipmentBonus, getCritMultiplier, calculateActionSpeed, getSpeedTier, WEAPONS, ARMOR_TYPES, ATTACK_TYPES, STAT_BONUSES, COMBAT_MODIFIERS, CONDITIONS, DAMAGE_TYPE_PROPERTIES, isFlanking, getFacingFromDelta } from './const.js';

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
     *  5. Determine flanking (determineFlanking) — must precede the hit roll,
     *     which spends it on THC
     *  6. Resolve hit roll (resolveHitRoll) → handleMiss() if miss
     *  7. Get weapon/armor, calculate base damage (calculateDamage)
     *  8. Roll for crit (rollCrit) — rolled HERE, before ADR, because a concussive
     *     crit decides whether armor ADR applies at all. The damage multiplier is
     *     still applied last, at step 11.
     *  9. Apply resistance modifier (applyResistanceModifier)
     * 10. Apply armor ADR, scaled by flanking (applyADR) — skipped entirely when
     *     step 8 crit on a bypassADROnCrit damage type
     * 11. Apply crit damage multiplier (applyCritDamage)
     * 12. Build and emit combat log (buildDamageBreakdown, buildCombatLogLines)
     * 13. Apply damage through buffer (applyDamage)
     * 14. Log damage application (logDamageApplication)
     * 15. Return hit result (handleHitResult)
     * 16. Knock the defender down if the crit carried that effect (applyKnockdown)
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
        // 5. Determine flanking (feeds both the hit roll and armor ADR below)
        const { flanking } = this.determineFlanking(attacker, defender);
        // 6. Resolve hit roll → miss if failed
        const { hit, thc, thcRoll, prone } = this.resolveHitRoll(attacker, defender, flanking);
        if (!hit) return this.handleMiss(attacker, defender, attackTypeName, { thc, thcRoll }, attackType, flanking, prone);
        // 7. Get weapon and armor, calculate base damage
        const weapon = WEAPONS[weaponKey];
        const armor = ARMOR_TYPES[defender.equipment.armor || "none"];
        let damage = calculateDamage(attacker.stats, weaponKey, attackType);
        const baseDamage = damage;
        // 8. Roll for crit up front — a bypassing crit cancels ADR below
        const { crit, csc, cscRoll } = this.rollCrit(attacker, defender);
        // 9. Apply resistance/vulnerability
        let resistMod;
        ({ damage, resistMod } = this.applyResistanceModifier(damage, weapon, armor, attackType));
        const damageAfterResist = damage;
        // 10. Apply armor ADR, scaled by flanking (skipped on a bypassing crit)
        const typeProps = DAMAGE_TYPE_PROPERTIES[weapon.type] || {};
        const adrBypassed = crit && !!typeProps.bypassADROnCrit;
        let effectiveADR, adrAbsorbed;
        ({ effectiveADR, adrAbsorbed, damage } = this.applyADR(damage, armor, flanking, adrBypassed));
        const damageAfterADR = damage;
        // 11. Apply crit damage multiplier — still last, so it scales what survived ADR
        damage = this.applyCritDamage(attacker, damage, crit);
        const finalDamage = damage;
        // 12. Build and emit combat log
        const breakdown = this.buildDamageBreakdown(attacker, attackType, weapon, armor, baseDamage, damageAfterResist, resistMod, effectiveADR, flanking, adrAbsorbed, damageAfterADR, crit, finalDamage, defender, adrBypassed);
        const actionSpeed = calculateActionSpeed(attacker, attackType);
        const spdTip = this.buildActionSpeedTip(attacker, attackType);
        this.buildCombatLogLines(attacker, defender, attackTypeName, thc, thcRoll, crit, flanking, friendlyFire, csc, cscRoll, breakdown, actionSpeed, spdTip, prone).forEach(line => this.logger.combat(line));
        // 13. Apply damage through buffer  14. Log damage application
        const damageResult = this.applyDamage(attacker, defender, damage);
        this.logDamageApplication(defender, attacker, damageResult);
        // 15. Return hit result
        const hitResult = this.handleHitResult(attacker, defender, finalDamage, crit, flanking);
        // 16. Knockdown — after handleHitResult so the prone pose overrides the
        //     impact animation it just set
        if (!hitResult.defenderDefeated) {
            hitResult.knockdown = this.applyKnockdown(defender, weapon, crit);
        }
        return hitResult;
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
     * Returns { hit, thc, thcRoll }
     */
    resolveHitRoll(attacker, defender, flanking = false) {
        const attkR = calculateAttkR(attacker);
        let defR = calculateDefR(defender);

        // A prone defender keeps only KNOCKDOWN_DR_MULT of its Defense Rating
        // against adjacent melee. Applied here rather than inside
        // calculateDefR() because that function only sees the defender,
        // and the "from adjacent melee" qualifier needs the attacker — a no-op
        // distinction today (every attack is adjacent melee) that starts mattering
        // the moment ranged attacks exist.
        const prone = defender.conditions?.has(CONDITIONS.KNOCKDOWN) ?? false;
        if (prone) {
            defR = Math.floor(defR * COMBAT_MODIFIERS.KNOCKDOWN_DR_MULT);
        }

        // Calculate to-hit chance as integer percentage (0-100%)
        const evasionBonus = getEquipmentBonus(defender, 'evasionBonus');
        const flankBonus = flanking ? COMBAT_MODIFIERS.FLANK_THC_BONUS : 0;
        const thc = Math.max(0, Math.min(100, attkR - defR + (50 - evasionBonus) + flankBonus));

        // Roll d100 (1-100), hit if roll <= THC — THC% of rolls land in the hit band
        const thcRoll = Math.floor(Math.random() * 100) + 1;
        const hit = thcRoll <= thc;

        return { hit, thc, thcRoll, prone };
    }

    /**
     * Determine flanking status: attacker behind the defender's facing, OR the
     * defender too engaged to answer back. The two sources do not stack — either
     * one alone yields the same advantage.
     * Side-effect-free (read-only queries on engagementManager and hexGrid), so
     * it is safe to run before the hit roll, which spends it on THC.
     * HexGridRenderer.holdsFlankAdvantage() mirrors this — keep them in step.
     * Returns { flanking, behindDefender, cannotEngageBack }
     */
    determineFlanking(attacker, defender) {
        const behindDefender = isFlanking(
            { q: attacker.hexQ, r: attacker.hexR },
            { q: defender.hexQ, r: defender.hexR },
            defender.facing,
            this.hexGrid
        );
        const cannotEngageBack = !this.engagementManager.canEngageBack(defender, attacker);
        return { flanking: behindDefender || cannotEngageBack, behindDefender, cannotEngageBack };
    }

    /**
     * Apply Armor Damage Reduction (flat, before crit)
     * Flanking scales the armor's ADR by its flankingDefense multiplier
     * adrBypassed short-circuits it entirely — a crit that landed inside the guard
     * Returns { effectiveADR, adrAbsorbed, damage: damageAfterADR }
     */
    applyADR(damage, armor, flanking, adrBypassed = false) {
        if (adrBypassed) {
            return { effectiveADR: 0, adrAbsorbed: 0, damage };
        }

        let effectiveADR = armor.adr;
        if (flanking) {
            effectiveADR = Math.floor(armor.adr * armor.flankingDefense);
        }

        const adrAbsorbed = Math.min(damage, effectiveADR);
        damage = Math.max(0, damage - effectiveADR);

        return { effectiveADR, adrAbsorbed, damage };
    }

    /**
     * Roll for a critical hit. Split from the damage multiplier because the crit
     * result is needed BEFORE armor ADR (a bypassADROnCrit type skips ADR entirely)
     * while the multiplier still has to land after it.
     * Has a random roll (d100) so not deterministic, but isolated.
     * Returns { crit, csc, cscRoll }
     */
    rollCrit(attacker, defender) {
        // CSC is an integer percentage 0-100%; crit if roll <= CSC
        const csc = calculateCSC(attacker, defender);
        const cscRoll = Math.floor(Math.random() * 100) + 1;
        return { crit: cscRoll <= csc, csc, cscRoll };
    }

    /**
     * Apply the crit damage multiplier — the last step in the damage pipeline.
     * getCritMultiplier() resolves equipment override vs the CRIT_DAMAGE_MULT
     * default; the floor keeps a fractional multiplier from leaking into HP.
     * Pure calculation — no side effects
     */
    applyCritDamage(attacker, damage, crit) {
        if (!crit) return damage;
        return Math.floor(damage * getCritMultiplier(attacker));
    }

    /**
     * Knock the defender down on a crit from a weapon carrying the knockdown
     * effect. There is deliberately no second roll — the crit IS the roll, since
     * unarmed already pays critMod -15 to get here (~6% for an even matchup).
     * A prone character spends its next action standing up and defends at
     * COMBAT_MODIFIERS.KNOCKDOWN_DR_MULT until it does.
     * Returns true if the condition was newly applied.
     */
    applyKnockdown(defender, weapon, crit) {
        if (!crit) return false;
        if (!weapon.effects?.includes(CONDITIONS.KNOCKDOWN)) return false;
        if (defender.isDefeated || defender.health <= 0) return false;
        if (defender.conditions.has(CONDITIONS.KNOCKDOWN)) return false;

        defender.conditions.add(CONDITIONS.KNOCKDOWN);

        // Borrow the death pose until there is a dedicated prone sprite.
        // MovementSystem.updateCharacterAnimation() holds it on the final frame
        // for prone characters exactly as it does for the dead.
        defender.currentAnimation = 'die';
        defender.animationFrame = 0;
        defender.animationTimer = 0;

        this.logger.combat(`    → {{char:${defender.name}}} is {{knockdown}} - next action is spent standing up`);
        return true;
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
     * Build action speed tooltip string showing formula breakdown
     */
    buildActionSpeedTip(attacker, attackType) {
        const weaponKey = attacker.equipment.mainHand;
        const weapon = WEAPONS[weaponKey];
        const offHandKey = attacker.equipment.offHand;
        const offHand = offHandKey ? WEAPONS[offHandKey] : null;
        const attackMod = ATTACK_TYPES[attackType]?.speedMod || 10;
        const weaponName = weaponKey.replace(/([A-Z])/g, '-$1').toLowerCase();

        let tip = `${weaponName} speed(${weapon.speed})`;
        if (weapon.grip !== 'two' && offHand) {
            const offName = offHandKey.replace(/([A-Z])/g, '-$1').toLowerCase();
            tip += ` + ${offName} speed(${offHand.speed})`;
        }
        tip += ` + ${attackType}(${attackMod}) - Dex(${attacker.stats.dex})`;
        return tip;
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
     * Returns the complete breakdown: base {{tip}} → resist/vuln → ADR → crit
     */
    buildDamageBreakdown(attacker, attackType, weapon, armor, baseDamage, damageAfterResist, resistMod, effectiveADR, flanking, adrAbsorbed, damageAfterADR, crit, finalDamage, defender, adrBypassed = false) {
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

        // Resist/Vuln modifier (applied before ADR)
        if (resistMod === "resistant") {
            breakdown += ` -> Resist: {{resist}}x0.5{{/resist}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        } else if (resistMod === "vulnerable") {
            breakdown += ` -> Vuln: {{vuln}}x1.5{{/vuln}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        } else if (resistMod === "vulnerableEnhanced") {
            breakdown += ` -> Vuln+: {{vuln}}x${attackType === "heavy" ? "2.5" : "2.0"}{{/vuln}} = {{dmg}}${damageAfterResist}{{/dmg}}`;
        }

        // ADR modifier with armor name — or the bypass notice when the crit went
        // inside the guard. Only worth saying when there was ADR to bypass.
        const armorKey = defender.equipment.armor || "none";
        if (adrBypassed && armor.adr > 0) {
            breakdown += ` -> {{armor:${armorKey}}} ADR({{adr_bypassed}}bypassed{{/adr_bypassed}})`;
        } else if (effectiveADR > 0) {
            breakdown += ` -> {{armor:${armorKey}}} ADR({{adr}}-${effectiveADR}{{/adr}})`;
            if (flanking) breakdown += ` (flanked ${Math.round(armor.flankingDefense * 100)}%)`;
            breakdown += ` = {{dmg}}${damageAfterADR}{{/dmg}}`;
        }

        // Crit modifier (applied last, after ADR)
        if (crit) breakdown += ` -> Crit: x${getCritMultiplier(attacker)} = {{dmg}}${finalDamage}{{/dmg}}`;

        return breakdown;
    }

    /**
     * Build the array of combat log lines for a hit
     * Pure string building — no side effects
     * Returns array of log strings: header (with tags), optional CSC line, damage breakdown line
     */
    buildCombatLogLines(attacker, defender, attackTypeName, thc, thcRoll, crit, flanking, friendlyFire, csc, cscRoll, damageBreakdown, actionSpeed, spdTip, prone = false) {
        let logParts = [];
        const spdTier = getSpeedTier(actionSpeed).tier;
        logParts.push(`{{char:${attacker.name}}}: ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thc}%{{/thc}}, Roll= {{roll}}${thcRoll}{{/roll}}, {{hit}}) {{tip:${spdTip}}}{{spd}}[${actionSpeed} T${spdTier}]{{/spd}}{{/tip}}`);
        if (crit) logParts.push("{{critical}}");
        if (flanking) logParts.push("{{flanking}}");
        // Prone inflated the THC above, same as flanking — tag it or the number reads as unexplained
        if (prone) logParts.push("{{prone}}");
        if (friendlyFire) logParts.push("{{friendlyFire}}");

        const lines = [];
        if (crit) logParts.push(`CSC= {{csc}}${csc}%{{/csc}}, Roll= {{roll}}${cscRoll}{{/roll}}`);
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
        const actionSpeed = calculateActionSpeed(attacker, attackType);
        const spdTip = this.buildActionSpeedTip(attacker, attackType);
        const spdTier = getSpeedTier(actionSpeed).tier;
        this.logger.combat(`{{char:${attacker.name}}}: ${whiffAttackName} at empty hex (${targetHex.q}, ${targetHex.r}) - {{whiff}} {{tip:${spdTip}}}{{spd}}[${actionSpeed} T${spdTier}]{{/spd}}{{/tip}}`);
        return { hit: false, damage: 0, crit: false, defenderDefeated: false, whiff: true };
    }

    /**
     * Handle a missed attack (THC roll failed)
     * Logs the miss message with THC/roll data and returns the miss result object
     * Returns { hit: false, damage: 0, crit: false, defenderDefeated: false }
     */
    handleMiss(attacker, defender, attackTypeName, hitResult, attackType = 'light', flanking = false, prone = false) {
        const { thc, thcRoll } = hitResult;
        const actionSpeed = calculateActionSpeed(attacker, attackType);
        const spdTip = this.buildActionSpeedTip(attacker, attackType);
        const spdTier = getSpeedTier(actionSpeed).tier;
        const logParts = [`{{char:${attacker.name}}}: ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thc}%{{/thc}}, Roll= {{roll}}${thcRoll}{{/roll}}, {{miss}}) {{tip:${spdTip}}}{{spd}}[${actionSpeed} T${spdTier}]{{/spd}}{{/tip}}`];
        // Flanking already inflated the THC above. Tag it here too, or the
        // number reads as unexplained on the one line that shows no damage.
        if (flanking) logParts.push("{{flanking}}");
        if (prone) logParts.push("{{prone}}");
        this.logger.combat(logParts.join(" "));
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
