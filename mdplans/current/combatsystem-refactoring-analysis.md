# CombatSystem.js Refactoring Analysis & Batched Implementation Plan

## Executive Summary

CombatSystem.js is functionally correct but has grown into a maintenance challenge. The `executeAttack()` method is 150+ lines handling 10+ responsibilities. This document outlines a systematic refactoring approach broken into safe, incremental batches.

## Critical Files
- `js/CombatSystem.js` - Primary refactoring target

---

## Problem Analysis

### 1. God Method: executeAttack() (Lines 18-167)
**Severity: High**

Current responsibilities (10+):
1. Target facing calculation
2. Defender validation (whiff/miss scenarios)
3. Friendly fire detection
4. Hit chance calculation (THC)
5. Base damage calculation
6. Critical hit calculation
7. Flanking status determination
8. Effective DR calculation
9. Resistance/vulnerability application
10. Complex damage breakdown logging
11. Damage application coordination
12. Animation state management
13. Result object construction

**Impact:** Hard to test, hard to understand, risky to change

### 2. DRY Violations

#### A. Animation State Setting (4 occurrences)
```javascript
// Lines 34-35, 56-57, 158-159, 163-164
character.currentAnimation = 'attack'; // or 'impact', 'die'
character.animationFrame = 0;
```

#### B. Damage Breakdown String Building (Lines 128-140)
Complex nested string concatenation with multiple conditionals

#### C. Buffer Logging (Lines 200-209)
Three similar conditional branches with minor variations

### 3. Testability Issues

Cannot easily test in isolation:
- Damage calculation pipeline
- Flanking logic
- DR application
- Resistance modifiers
- Hit chance formula
- Critical strike chance

---

## Refactoring Inventory

### High Priority Extractions

#### 1. setAnimation(character, animationType)
**Lines:** Duplicated at 34-35, 56-57, 158-159, 163-164
**Complexity:** Trivial
**Risk:** Minimal
**Benefit:** Eliminates 4 duplications, single source of truth for animation state

#### 2. calculateHitResult(attacker, defender)
**Lines:** 46-52
**Complexity:** Low
**Risk:** Low
**Benefit:** THC formula testable in isolation, clear separation of hit calculation

#### 3. calculateDamageModifiers(attacker, defender, baseDamage, attackType)
**Lines:** 69-116 (damage pipeline)
**Complexity:** High
**Risk:** Medium
**Benefit:** Core damage logic testable, enables unit tests for crit/flanking/DR/resist

#### 4. buildDamageBreakdownLog(attacker, weapon, attackType, damageResults)
**Lines:** 128-140
**Complexity:** Medium
**Risk:** Low
**Benefit:** Separates presentation from business logic, easier to modify log format

#### 5. calculateFlankingStatus(attacker, defender)
**Lines:** 87-94
**Complexity:** Medium
**Risk:** Low
**Benefit:** Flanking logic testable independently

#### 6. applyResistanceModifier(damage, weaponType, armor)
**Lines:** 107-116
**Complexity:** Low
**Risk:** Low
**Benefit:** Resistance calculation testable separately

### Medium Priority

#### 7. faceTarget(attacker, targetHex)
**Lines:** 19-24
**Complexity:** Low
**Risk:** Minimal

#### 8. handleWhiff(attacker, targetHex, attackType)
**Lines:** 31-36
**Complexity:** Low
**Risk:** Minimal

#### 9. handleMiss(attacker, defender, attackType)
**Lines:** 54-58
**Complexity:** Low
**Risk:** Minimal

#### 10. handleAttackResult(attacker, defender, damageResult, finalDamage)
**Lines:** 149-166
**Complexity:** Medium
**Risk:** Low

### Low Priority

#### 11. formatBufferLog(...)
**Lines:** 200-209 refactor
**Complexity:** Medium
**Risk:** Low

---

## Batched Implementation Plan

### **BATCH 1: Quick Wins - Zero Risk Utilities**
**Goal:** Build confidence, eliminate obvious duplication
**Risk Level:** Minimal
**Testing:** Visual inspection

**Extractions:**
1. `setAnimation(character, animationType)`
2. `faceTarget(attacker, targetHex)`

**Impact:**
- Reduces executeAttack() by ~8 lines
- Eliminates 4 code duplications
- Sets pattern for future extractions

**Estimated Effort:** 10-15 minutes
**Test Plan:** Run combat, verify animations still work

---

### **BATCH 2: Calculation Isolation - Pure Functions**
**Goal:** Extract pure calculation logic (no side effects)
**Risk Level:** Low
**Testing:** Unit testable (though tests not required initially)

**Extractions:**
3. `calculateHitResult(attacker, defender)`
4. `calculateFlankingStatus(attacker, defender)`
5. `applyResistanceModifier(damage, weaponType, armor)`

**Impact:**
- Reduces executeAttack() by ~25 lines
- Core formulas testable in isolation
- No mutation, just calculations

**Estimated Effort:** 20-30 minutes
**Test Plan:**
- Run combat with various scenarios
- Verify hit/miss rates feel correct
- Check flanking bonuses apply
- Verify resistance messages appear

---

### **BATCH 3: Damage Pipeline - The Big One**
**Goal:** Extract core damage calculation pipeline
**Risk Level:** Medium
**Testing:** Comprehensive combat scenarios

**Extractions:**
6. `calculateDamageModifiers(attacker, defender, baseDamage, attackType)`
   - Orchestrates: crit check, flanking, DR, resistance
   - Returns: `{ finalDamage, crit, flanking, drAbsorbed, resistMod, damageAfterCrit }`

**Impact:**
- Reduces executeAttack() by ~50 lines
- Makes damage formula comprehensible
- Enables damage calculation testing

**Estimated Effort:** 30-45 minutes
**Test Plan:**
- Combat against various armor types
- Verify crit damage multipliers
- Test flanking damage increases
- Check DR absorption
- Verify resist/vuln messages

**Pre-requisite:** Batch 2 complete (uses calculateFlankingStatus, applyResistanceModifier)

---

### **BATCH 4: Presentation Layer**
**Goal:** Separate logging/presentation from business logic
**Risk Level:** Low
**Testing:** Visual log inspection

**Extractions:**
7. `buildDamageBreakdownLog(attacker, weapon, attackType, damageResults)`
8. `buildCombatLog(attacker, defender, damageResult, friendlyFire, attackType)`

**Impact:**
- Reduces executeAttack() by ~20 lines
- Log formatting changes don't touch combat logic
- Easier to modify combat messages

**Estimated Effort:** 20 minutes
**Test Plan:** Run combat, verify log messages match old format exactly

---

### **BATCH 5: Result Handlers**
**Goal:** Extract result handling (whiff/miss/hit outcomes)
**Risk Level:** Low
**Testing:** Scenario coverage

**Extractions:**
9. `handleWhiff(attacker, targetHex, attackType)`
10. `handleMiss(attacker, defender, attackType)`
11. `handleAttackResult(attacker, defender, damageResult, finalDamage)`

**Impact:**
- Reduces executeAttack() by ~30 lines
- Clear separation of outcomes
- Each result handler independently testable

**Estimated Effort:** 25 minutes
**Test Plan:**
- Attack empty hex (whiff)
- Miss an enemy (low THC scenario)
- Successful hits with various outcomes
- Verify defeat animations

---

### **BATCH 6: Cleanup & Polish**
**Goal:** Final executeAttack() refactor, applyDamage() logging improvements
**Risk Level:** Low
**Testing:** Full regression

**Changes:**
12. Rewrite `executeAttack()` to orchestrate extracted functions
13. Simplify `applyDamage()` buffer logging (extract formatBufferLog helper)

**Impact:**
- executeAttack() becomes ~25-30 lines (from 150)
- Clear, readable flow
- Each step is a meaningful function call

**Estimated Effort:** 30 minutes
**Test Plan:** Full combat regression across all scenarios

---

## Final Structure After All Batches

```javascript
class CombatSystem {
    // === MAIN ORCHESTRATOR (Batch 6) ===
    executeAttack(attacker, targetHex, attackType = 'light') {
        // 1. Setup
        this.faceTarget(attacker, targetHex);

        // 2. Validate defender
        const defender = this.getCharacterAtHex(targetHex.q, targetHex.r);
        if (!defender) return this.handleWhiff(attacker, targetHex, attackType);

        // 3. Friendly fire warning
        const friendlyFire = defender.faction === attacker.faction;
        if (friendlyFire) {
            this.logger.warn(`[FRIENDLY FIRE WARNING] ${attacker.name} attacks ally ${defender.name}!`);
        }

        // 4. Check hit
        const hitResult = this.calculateHitResult(attacker, defender);
        if (!hitResult.hit) return this.handleMiss(attacker, defender, attackType);

        // 5. Calculate damage
        const baseDamage = calculateDamage(attacker.stats, attacker.equipment.mainHand, attackType);
        const damageResult = this.calculateDamageModifiers(attacker, defender, baseDamage, attackType);

        // 6. Log combat
        const logMessage = this.buildCombatLog(attacker, defender, damageResult, friendlyFire, attackType);
        this.logger.combat(logMessage);

        // 7. Apply damage
        this.applyDamage(attacker, defender, damageResult.finalDamage);

        // 8. Handle result
        return this.handleAttackResult(attacker, defender, damageResult);
    }

    // === BATCH 1: UTILITIES ===
    setAnimation(character, animationType) {
        character.currentAnimation = animationType;
        character.animationFrame = 0;
    }

    faceTarget(attacker, targetHex) {
        const targetPixel = this.hexGrid.hexToPixel(targetHex.q, targetHex.r);
        const attackerPixel = this.hexGrid.hexToPixel(attacker.hexQ, attacker.hexR);
        const dx = targetPixel.x - attackerPixel.x;
        const dy = targetPixel.y - attackerPixel.y;
        attacker.facing = getFacingFromDelta(dx, dy);
    }

    // === BATCH 2: PURE CALCULATIONS ===
    calculateHitResult(attacker, defender) {
        const attackRating = calculateAttackRating(attacker);
        const defenseRating = calculateDefenseRating(defender);
        const evasionBonus = getEquipmentBonus(defender, 'evasionBonus');
        const thc = (attackRating - defenseRating + (50 - evasionBonus)) / 100;
        const hit = Math.random() < thc;
        return { hit, thc, attackRating, defenseRating };
    }

    calculateFlankingStatus(attacker, defender) {
        const behindDefender = isFlanking(
            { q: attacker.hexQ, r: attacker.hexR },
            { q: defender.hexQ, r: defender.hexR },
            defender.facing,
            this.hexGrid
        );
        const cannotEngageBack = !this.gameStateManager.canEngageBack(defender, attacker);
        const flanking = behindDefender || cannotEngageBack;
        return { flanking, behindDefender, cannotEngageBack };
    }

    applyResistanceModifier(damage, weaponType, armor) {
        let modifiedDamage = damage;
        let resistMod = null;

        if (damage > 0) {
            if (armor.resistantAgainst.includes(weaponType)) {
                modifiedDamage = Math.floor(damage * 0.5);
                resistMod = 'resistant';
            } else if (armor.vulnerableAgainst.includes(weaponType)) {
                modifiedDamage = Math.floor(damage * 1.5);
                resistMod = 'vulnerable';
            }
        }

        return { modifiedDamage, resistMod };
    }

    // === BATCH 3: DAMAGE PIPELINE ===
    calculateDamageModifiers(attacker, defender, baseDamage, attackType) {
        const weapon = WEAPONS[attacker.equipment.mainHand];
        const armor = ARMOR_TYPES[defender.equipment.armor || 'none'];

        let damage = baseDamage;

        // Crit
        const csc = calculateCSC(attacker, defender);
        const crit = Math.random() < csc;
        if (crit) {
            damage *= 2;
            const critMult = getEquipmentBonus(attacker, 'critMultiplier');
            if (critMult > 0) damage *= critMult;
        }
        const damageAfterCrit = damage;

        // Flanking
        const flankingStatus = this.calculateFlankingStatus(attacker, defender);

        // DR
        let effectiveDR = armor.defense;
        if (flankingStatus.flanking) {
            effectiveDR = Math.floor(armor.defense * armor.flankingDefense);
        }
        const drAbsorbed = Math.min(damage, effectiveDR);
        damage = Math.max(0, damage - effectiveDR);

        // Resistance
        const { modifiedDamage, resistMod } = this.applyResistanceModifier(damage, weapon.type, armor);
        damage = modifiedDamage;

        return {
            finalDamage: damage,
            baseDamage,
            damageAfterCrit,
            drAbsorbed,
            resistMod,
            crit,
            flanking: flankingStatus.flanking,
            weapon,
            armor
        };
    }

    // === BATCH 4: PRESENTATION ===
    buildDamageBreakdownLog(attacker, weapon, attackType, damageResults) {
        const { baseDamage, damageAfterCrit, drAbsorbed, finalDamage, resistMod, crit, flanking, armor } = damageResults;

        const strMult = STAT_BONUSES.MULTIPLIER[attacker.stats.str] ?? 1;
        const strBonus = Math.ceil(weapon.force * strMult);
        const attackMod = ATTACK_TYPES[attackType]?.damageMod || 0;

        let breakdown = `Weapon: ${weapon.base} + Str(${attacker.stats.str})×Force(${weapon.force}): +${strBonus}`;
        if (attackMod !== 0) breakdown += ` + ${attackType}: ${attackMod > 0 ? '+' : ''}${attackMod}`;
        breakdown += ` = ${baseDamage}`;

        if (crit) breakdown += ` → Crit: ${damageAfterCrit}`;
        if (drAbsorbed > 0) breakdown += ` → DR: -${drAbsorbed}${flanking ? ` (flanked ${Math.round(armor.flankingDefense * 100)}%)` : ''}`;
        if (resistMod === 'resistant') breakdown += ` → Resist: ×0.5`;
        if (resistMod === 'vulnerable') breakdown += ` → Vuln: ×1.5`;
        breakdown += ` = ${finalDamage}`;

        return breakdown;
    }

    buildCombatLog(attacker, defender, damageResult, friendlyFire, attackType) {
        const attackTypeName = ATTACK_TYPES[attackType]?.name || 'Attack';
        const weapon = WEAPONS[attacker.equipment.mainHand];

        let logParts = [];
        logParts.push(`${attacker.name} ${attackTypeName.toLowerCase()}s ${defender.name}`);
        if (friendlyFire) logParts.push('[FRIENDLY FIRE]');
        if (damageResult.flanking) logParts.push('[FLANKING]');
        if (damageResult.crit) logParts.push('[CRITICAL]');

        const breakdown = this.buildDamageBreakdownLog(attacker, weapon, attackType, damageResult);

        return `${logParts.join(' ')} | ${breakdown}`;
    }

    // === BATCH 5: RESULT HANDLERS ===
    handleWhiff(attacker, targetHex, attackType) {
        const attackTypeName = ATTACK_TYPES[attackType]?.name || 'Attack';
        this.logger.combat(`${attacker.name} ${attackTypeName.toLowerCase()}s at empty hex (${targetHex.q}, ${targetHex.r}) - WHIFF!`);
        this.setAnimation(attacker, 'attack');
        return { hit: false, damage: 0, crit: false, defenderDefeated: false, whiff: true };
    }

    handleMiss(attacker, defender, attackType) {
        const attackTypeName = ATTACK_TYPES[attackType]?.name || 'Attack';
        this.logger.combat(`${attacker.name} ${attackTypeName.toLowerCase()}s ${defender.name} but MISSES!`);
        this.setAnimation(attacker, 'attack');
        return { hit: false, damage: 0, crit: false, defenderDefeated: false };
    }

    handleAttackResult(attacker, defender, damageResult) {
        const defeated = defender.health <= 0;

        this.gameStateManager.markCharacterHit(defender);

        if (defeated) {
            this.logger.combat(`${defender.name} has been defeated!`);
            this.setAnimation(defender, 'die');
        } else if (damageResult.finalDamage > 0) {
            this.setAnimation(defender, 'impact');
        }

        this.setAnimation(attacker, 'attack');

        return {
            hit: true,
            damage: damageResult.finalDamage,
            crit: damageResult.crit,
            defenderDefeated: defeated,
            flanking: damageResult.flanking
        };
    }

    // === BATCH 6: BUFFER LOGGING (Optional cleanup) ===
    formatBufferLog(attacker, defender, damage, bufferDamage, healthDamage, remainingBuffer) {
        const defenderPos = `${defender.name}@(${defender.hexQ},${defender.hexR})`;

        this.logger.debug(`[BUFFER] ${attacker.name} → ${defenderPos}: ${damage} final damage (post-DR/resist)`);

        if (bufferDamage > 0 && healthDamage > 0) {
            const prevBuffer = remainingBuffer + bufferDamage;
            this.logger.debug(`  ├─ Buffer: ${prevBuffer}/${defender.hpBufferMax} → absorbs ${bufferDamage}, overflow ${healthDamage} to HP`);
            this.logger.debug(`  └─ New buffer: ${remainingBuffer}/${defender.hpBufferMax} (depleted)`);
        } else if (bufferDamage > 0) {
            const prevBuffer = remainingBuffer + bufferDamage;
            this.logger.debug(`  └─ Buffer: ${prevBuffer}/${defender.hpBufferMax} → absorbs all ${bufferDamage} → ${remainingBuffer}/${defender.hpBufferMax}`);
        } else {
            this.logger.debug(`  └─ Buffer depleted (${remainingBuffer}/${defender.hpBufferMax}), all ${healthDamage} to HP`);
        }
    }

    applyDamage(attacker, defender, damage) {
        // Initialize buffer
        const isNewBuffer = !defender.hpBufferByAttacker.has(attacker);
        const defenderPos = `${defender.name}@(${defender.hexQ},${defender.hexR})`;

        if (isNewBuffer) {
            defender.hpBufferByAttacker.set(attacker, defender.hpBufferMax);
            this.logger.debug(`[BUFFER INIT] ${defenderPos} buffer vs ${attacker.name}: ${defender.hpBufferMax} HP (instinct=${defender.stats.instinct}, will=${defender.stats.will})`);
        }

        // Apply damage
        let remainingBuffer = defender.hpBufferByAttacker.get(attacker);
        let bufferDamage = 0;
        let healthDamage = 0;

        if (remainingBuffer > 0) {
            bufferDamage = Math.min(damage, remainingBuffer);
            remainingBuffer -= bufferDamage;
            defender.hpBufferByAttacker.set(attacker, remainingBuffer);
            healthDamage = damage - bufferDamage;
        } else {
            healthDamage = damage;
        }

        // Log
        this.formatBufferLog(attacker, defender, damage, bufferDamage, healthDamage, remainingBuffer);

        // Apply health damage
        if (healthDamage > 0) {
            defender.health -= healthDamage;
            defender.health = Math.max(0, defender.health);
        }

        return { bufferDamage, healthDamage };
    }

    // isValidAttackTarget() remains unchanged
}
```

---

## Summary of Batches

| Batch | Focus | Risk | Effort | Line Reduction |
|-------|-------|------|--------|----------------|
| 1 | Quick wins (animation, facing) | Minimal | 15 min | -8 lines |
| 2 | Pure calculations (hit, flanking, resist) | Low | 30 min | -25 lines |
| 3 | Damage pipeline | Medium | 45 min | -50 lines |
| 4 | Presentation/logging | Low | 20 min | -20 lines |
| 5 | Result handlers | Low | 25 min | -30 lines |
| 6 | Final cleanup | Low | 30 min | -20 lines |
| **TOTAL** | | | **2.5-3 hrs** | **-153 lines from executeAttack()** |

---

## Testing Strategy

### Per-Batch Testing
After each batch:
1. Run game in browser
2. Enter combat mode
3. Test scenarios relevant to batch changes
4. Check console logs for errors

### Batch-Specific Scenarios

**Batch 1:** Any combat (animations should work)

**Batch 2:**
- High/low stat characters (hit/miss rates)
- Flanking from behind
- Attacking over-engaged enemies

**Batch 3:**
- Critical hits (verify 2x damage)
- Heavy armor vs light weapons (DR absorption)
- Resistant/vulnerable combos (slashing vs plate)

**Batch 4:**
- Read combat logs (verify format unchanged)

**Batch 5:**
- Attack empty hex (whiff)
- Miss attacks (low THC)
- Defeat enemy (death animation)

**Batch 6:**
- Full regression test
- Multiple attackers against one defender (buffer system)

---

## Benefits After Completion

### Testability
- Each calculation testable in isolation
- Can verify formulas without running full game
- Easy to add unit tests later

### Maintainability
- executeAttack() becomes self-documenting
- Changes to formulas isolated to specific functions
- Less risk when modifying combat logic

### Readability
- Clear separation of concerns
- Each function has single responsibility
- Flow is obvious from executeAttack() orchestration

### Future-Proofing
- Easy to add new attack types
- Simple to modify damage formulas
- Straightforward to add new combat effects

---

## Recommendation

**Proceed with batched approach.** Each batch is:
- Independently valuable
- Low-to-medium risk
- Quickly testable
- Builds on previous batches

Start with Batch 1 (quick wins) to build confidence, then proceed sequentially through Batch 6.

**Total time investment:** 2.5-3 hours for dramatically improved code quality.
