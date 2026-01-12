# CombatSystem.js Refactoring Plan (Current - January 2026)

## Executive Summary

CombatSystem.js is functionally correct but has grown into a maintenance challenge. The `executeAttack()` method spans 172 lines handling 18+ responsibilities. This document outlines a systematic refactoring approach broken into safe, incremental batches.

**Current State:**
- Total file: 270 lines
- `executeAttack()`: 172 lines (18-190)
- `applyDamage()`: 55 lines (197-252)
- Uses semantic token system for all logging
- Includes buffer bypass mechanic for concussive damage

**Goal:**
- Reduce `executeAttack()` to ~30-40 lines
- Extract 10+ helper methods
- Improve testability and maintainability
- Preserve ALL semantic tokens and logging behavior

**Estimated Effort:** 3-4 hours

---

## Current Responsibilities Breakdown

### executeAttack() - 18 Responsibilities

1. **Face target** (lines 19-24) - Pixel calculation and facing update
2. **Get defender** (line 27) - Hex occupancy check
3. **Format attack type name** (lines 30-33) - Semantic token wrapping for heavy attacks
4. **Handle whiff** (lines 35-40) - Empty hex with semantic token logging
5. **Friendly fire detection** (lines 44-46) - Faction check and warning
6. **Calculate attack/defense ratings** (lines 50-51) - Stat-based calculations
7. **Calculate THC** (lines 54-55) - To-hit chance with evasion bonus
8. **Capture roll and display percentages** (lines 57-61) - Inverted % for UI
9. **Handle miss** (lines 63-66) - Failed hit with semantic tokens
10. **Get weapon/armor** (lines 70-71) - Equipment lookup
11. **Calculate base damage** (lines 74-75) - Weapon + stats + attack type
12. **Critical hit calculation** (lines 78-90) - Roll, double damage, crit multiplier
13. **Flanking determination** (lines 95-102) - Behind OR over-engaged check
14. **Effective DR calculation** (lines 105-108) - Flanking modifier on armor
15. **Apply DR** (lines 111-112) - Subtract defense rating
16. **Resistance/vulnerability** (lines 115-124) - Armor vs weapon type
17. **Build combat log** (lines 129-154) - Complex semantic token formatting
18. **Apply damage** (line 157) - Delegate to applyDamage()
19. **Context-sensitive buffer logging** (lines 160-172) - 4-branch conditional
20. **Mark defender hit** (line 177) - UI tracking
21. **Handle defeat/impact** (lines 179-186) - Animation and defeat log
22. **Return result** (line 189) - Result object

### applyDamage() - 9 Responsibilities

1. **Check weapon type** (lines 199-201) - Buffer bypass detection
2. **Initialize tracking** (lines 203-207) - Local variables
3. **Handle bypass path** (lines 209-212) - Concussive damage special case
4. **Handle normal buffer path** (lines 214-239) - Per-attacker buffer system
   - Check if new buffer needed
   - Initialize buffer
   - Calculate buffer/health split
   - Update buffer map
5. **Track before/after values** (223-224, 239) - For logging
6. **Apply health damage** (244-246) - Subtract from health
7. **Return detailed result** (251) - 7-value object with bypass flag

---

## Key System Characteristics

### Semantic Token System
ALL logging uses `{{token}}content{{/token}}` syntax for styling. Used tokens:

```javascript
{{char:name}}       // Character names
{{heavy}}           // Heavy attack indicator
{{whiff}}           // Empty hex attack
{{miss}}            // Failed hit
{{hit}}             // Successful hit
{{thc}}             // To-hit chance %
{{roll}}            // Attack roll %
{{critical}}        // Crit indicator
{{flanking}}        // Flanking indicator
{{friendlyFire}}    // FF warning
{{dmg}}             // Damage values
{{dr}}              // DR absorption
{{resist}}          // Resistance modifier
{{vuln}}            // Vulnerability modifier
{{hp}}              // Health values
{{buf}}             // Buffer values
{{buf_depleted}}    // Buffer depleted
{{buf_bypassed}}    // Buffer bypassed
{{hitPrefix}}       // Damage breakdown prefix
```

**CRITICAL:** All extracted functions must preserve exact token syntax.

### Logger Class
- Constructor receives `logger` dependency
- All output via `this.logger.combat()`, `.warn()`, `.debug()`
- NO console.log anywhere
- All helpers must have logger access (instance methods)

### Buffer Bypass Mechanic
- Concussive damage bypasses per-attacker buffer
- Checked in applyDamage() via `DAMAGE_TYPE_PROPERTIES`
- Returns `bypassed` flag for logging
- Separate log branch in executeAttack()

---

## Batched Implementation Plan

### **BATCH 1: Quick Wins - Zero Risk Utilities**
**Goal:** Build confidence with trivial extractions
**Risk:** Minimal
**Time:** 15-20 minutes

**Extractions:**

**1.1 faceTarget(attacker, targetHex)**
```javascript
faceTarget(attacker, targetHex) {
    const targetPixel = this.hexGrid.hexToPixel(targetHex.q, targetHex.r);
    const attackerPixel = this.hexGrid.hexToPixel(attacker.hexQ, attacker.hexR);
    const dx = targetPixel.x - attackerPixel.x;
    const dy = targetPixel.y - attackerPixel.y;
    attacker.facing = getFacingFromDelta(dx, dy);
}
```

**1.2 setDefenderAnimation(defender, animType)**
```javascript
setDefenderAnimation(defender, animType) {
    defender.currentAnimation = animType;
    defender.animationFrame = 0;
}
```

**Impact:**
- Reduces executeAttack() by ~10 lines
- Eliminates duplication
- Sets pattern for future extractions

**Test Plan:**
- Run combat
- Verify characters face each other
- Verify impact/die animations play

---

### **BATCH 2: Pure Calculations - Testable Logic**
**Goal:** Extract calculation functions with no side effects
**Risk:** Low
**Time:** 30-40 minutes

**Extractions:**

**2.1 calculateHitResult(attacker, defender)**
```javascript
calculateHitResult(attacker, defender) {
    const attackRating = calculateAttackRating(attacker);
    const defenseRating = calculateDefenseRating(defender);
    const evasionBonus = getEquipmentBonus(defender, 'evasionBonus');
    const thc = (attackRating - defenseRating + (50 - evasionBonus)) / 100;

    // Capture roll and calculate display percentages (inverted)
    const thcRoll = Math.random();
    const thcPercent = 100 - Math.round(thc * 100); // Difficulty to beat
    const rollPercent = 100 - Math.round(thcRoll * 100); // Roll high is good
    const hit = thcRoll < thc;

    return { hit, thc, thcPercent, rollPercent, attackRating, defenseRating };
}
```

**2.2 calculateFlankingStatus(attacker, defender)**
```javascript
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
```

**2.3 applyResistanceModifier(damage, weaponType, armor)**
```javascript
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
```

**Impact:**
- Reduces executeAttack() by ~30 lines
- Core formulas independently testable
- No mutation, pure calculations

**Test Plan:**
- Various stat combinations (high/low hit rates)
- Flanking from behind
- Over-engaged defenders
- Resistance combos (slash vs plate)

---

### **BATCH 3: Damage Pipeline - The Big One**
**Goal:** Extract core damage calculation orchestrator
**Risk:** Medium
**Time:** 40-50 minutes

**Extraction:**

**3.1 calculateDamageModifiers(attacker, defender, baseDamage, attackType)**
```javascript
calculateDamageModifiers(attacker, defender, baseDamage, attackType) {
    const weapon = WEAPONS[attacker.equipment.mainHand];
    const armor = ARMOR_TYPES[defender.equipment.armor || 'none'];

    let damage = baseDamage;

    // Critical hit
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

    // Effective DR (modified by flanking)
    let effectiveDR = armor.defense;
    if (flankingStatus.flanking) {
        effectiveDR = Math.floor(armor.defense * armor.flankingDefense);
    }
    const drAbsorbed = Math.min(damage, effectiveDR);
    damage = Math.max(0, damage - effectiveDR);

    // Resistance/vulnerability
    const { modifiedDamage, resistMod } = this.applyResistanceModifier(damage, weapon.type, armor);
    damage = modifiedDamage;

    return {
        finalDamage: damage,
        baseDamage,
        damageAfterCrit,
        drAbsorbed,
        effectiveDR,
        resistMod,
        crit,
        flanking: flankingStatus.flanking,
        weapon,
        armor
    };
}
```

**Impact:**
- Reduces executeAttack() by ~55 lines
- Makes damage formula comprehensible
- Enables damage calculation testing

**Test Plan:**
- Combat against various armor types
- Critical hits (verify multipliers)
- Flanking damage increases
- DR absorption
- Resist/vuln messages

**Pre-requisite:** Batch 2 complete (uses calculateFlankingStatus, applyResistanceModifier)

---

### **BATCH 4: Presentation Layer - Semantic Token Handling**
**Goal:** Separate logging/presentation from business logic
**Risk:** Medium (token corruption possible)
**Time:** 45-60 minutes

**CRITICAL:** ALL semantic tokens must be preserved exactly.

**Extractions:**

**4.1 formatAttackTypeName(attackType)**
```javascript
formatAttackTypeName(attackType) {
    let attackTypeName = ATTACK_TYPES[attackType]?.name || 'Attack';
    if (attackType === 'heavy') {
        attackTypeName = '{{heavy}}heavy{{/heavy}} Attack';
    }
    return attackTypeName;
}
```

**4.2 formatWeaponName(weaponKey)**
```javascript
formatWeaponName(weaponKey) {
    // camelCase to hyphen-separated
    return weaponKey.replace(/([A-Z])/g, '-$1').toLowerCase();
}
```

**4.3 buildDamageBreakdown(attacker, damageResult, attackType)**
```javascript
buildDamageBreakdown(attacker, damageResult, attackType) {
    const { weapon, baseDamage, damageAfterCrit, effectiveDR, finalDamage, resistMod, crit, flanking, armor } = damageResult;

    const strMult = STAT_BONUSES.MULTIPLIER[attacker.stats.str] ?? 1;
    const strBonus = Math.ceil(weapon.force * strMult);
    const attackMod = ATTACK_TYPES[attackType]?.damageMod || 0;

    const weaponName = this.formatWeaponName(attacker.equipment.mainHand);
    let breakdown = `${weaponName}: ${weapon.base} + str(${attacker.stats.str})×force(${weapon.force}): +${strBonus}`;
    if (attackMod !== 0) breakdown += ` + ${attackType}: ${attackMod > 0 ? '+' : ''}${attackMod}`;
    breakdown += ` = {{dmg}}${baseDamage}{{/dmg}}`;

    if (crit) breakdown += ` → Crit: {{dmg}}${damageAfterCrit}{{/dmg}}`;
    if (effectiveDR > 0) breakdown += ` → DR: {{dr}}-${effectiveDR}{{/dr}}${flanking ? ` (flanked ${Math.round(armor.flankingDefense * 100)}%)` : ''}`;
    if (resistMod === 'resistant') breakdown += ` → Resist: {{resist}}×0.5{{/resist}}`;
    if (resistMod === 'vulnerable') breakdown += ` → Vuln: {{vuln}}×1.5{{/vuln}}`;
    breakdown += ` = {{dmg}}${finalDamage}{{/dmg}}`;

    return breakdown;
}
```

**4.4 buildCombatLogHeader(attacker, defender, attackTypeName, hitResult, damageResult, friendlyFire)**
```javascript
buildCombatLogHeader(attacker, defender, attackTypeName, hitResult, damageResult, friendlyFire) {
    const { thcPercent, rollPercent } = hitResult;
    const { crit, flanking } = damageResult;

    let logParts = [];
    logParts.push(`{{char:${attacker.name}}} ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thcPercent}%{{/thc}}, Roll= {{roll}}${rollPercent}{{/roll}}, {{hit}})`);
    if (crit) logParts.push('{{critical}}');
    if (flanking) logParts.push('{{flanking}}');
    if (friendlyFire) logParts.push('{{friendlyFire}}');

    return logParts.join(' ');
}
```

**4.5 logBufferDamageApplication(defender, bufferResult)**
```javascript
logBufferDamageApplication(defender, bufferResult) {
    const { bufferDamage, healthDamage, bufferBefore, bufferAfter, healthBefore, healthAfter, bypassed } = bufferResult;

    if (bypassed && healthDamage > 0) {
        // Buffer bypassed - damage went directly to HP
        this.logger.combat(`    → {{char:${defender.name}}}: {{dmg}}-${healthDamage}{{/dmg}} HP {{hp}}(${healthBefore} → ${healthAfter}){{/hp}} {{buf_bypassed}}(buffer bypassed){{/buf_bypassed}}`);
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
```

**Impact:**
- Reduces executeAttack() by ~35 lines
- Log formatting isolated
- Easier to modify combat messages
- Critical 4-branch buffer logging extracted

**Test Plan:**
- Run combat, verify log messages EXACTLY match old format
- Check ALL semantic tokens render correctly
- Verify all 4 buffer log branches work
- Test buffer bypass logging

---

### **BATCH 5: Result Handlers - Outcome Management**
**Goal:** Extract result handling for different attack outcomes
**Risk:** Low
**Time:** 30-40 minutes

**Extractions:**

**5.1 handleWhiff(attacker, targetHex, attackType)**
```javascript
handleWhiff(attacker, targetHex, attackType) {
    const whiffAttackName = attackType === 'heavy'
        ? '{{heavy}}heavy{{/heavy}} attacks'
        : `${attackType} attacks`;
    this.logger.combat(`{{char:${attacker.name}}} ${whiffAttackName} at empty hex (${targetHex.q}, ${targetHex.r}) - {{whiff}}`);
    return { hit: false, damage: 0, crit: false, defenderDefeated: false, whiff: true };
}
```

**5.2 handleMiss(attacker, defender, attackTypeName, hitResult)**
```javascript
handleMiss(attacker, defender, attackTypeName, hitResult) {
    const { thcPercent, rollPercent } = hitResult;
    this.logger.combat(`{{char:${attacker.name}}} ${attackTypeName} {{char:${defender.name}}} (THC= {{thc}}${thcPercent}%{{/thc}}, Roll= {{roll}}${rollPercent}{{/roll}}, {{miss}})`);
    return { hit: false, damage: 0, crit: false, defenderDefeated: false };
}
```

**5.3 handleHitResult(defender, damageResult)**
```javascript
handleHitResult(defender, damageResult) {
    const { finalDamage } = damageResult;
    const defeated = defender.health <= 0;

    this.gameStateManager.markCharacterHit(defender);

    if (defeated) {
        this.logger.combat(`{{char:${defender.name}}} has been defeated!`);
        // Die animation set by GameStateManager.handleCharacterDefeat()
    } else if (finalDamage > 0) {
        this.setDefenderAnimation(defender, 'impact');
    }

    return {
        hit: true,
        damage: finalDamage,
        crit: damageResult.crit,
        defenderDefeated: defeated,
        flanking: damageResult.flanking
    };
}
```

**Impact:**
- Reduces executeAttack() by ~25 lines
- Clear separation of outcomes
- Each handler independently testable

**Test Plan:**
- Attack empty hex (whiff with correct semantic tokens)
- Miss attacks (low THC scenarios)
- Successful hits with various damage amounts
- Defeat animations

---

### **BATCH 6: Final Orchestration**
**Goal:** Rewrite executeAttack() as clean orchestrator
**Risk:** Low
**Time:** 30-40 minutes

**Final executeAttack() Structure:**
```javascript
executeAttack(attacker, targetHex, attackType = 'light') {
    // 1. Setup
    this.faceTarget(attacker, targetHex);
    const attackTypeName = this.formatAttackTypeName(attackType);

    // 2. Validate defender
    const defender = this.getCharacterAtHex(targetHex.q, targetHex.r);
    if (!defender) return this.handleWhiff(attacker, targetHex, attackType);

    // 3. Friendly fire check
    const friendlyFire = defender.faction === attacker.faction;
    if (friendlyFire) {
        this.logger.warn(`[FRIENDLY FIRE WARNING] ${attacker.name} attacks ally ${defender.name}!`);
    }

    // 4. Check hit
    const hitResult = this.calculateHitResult(attacker, defender);
    if (!hitResult.hit) return this.handleMiss(attacker, defender, attackTypeName, hitResult);

    // 5. Get equipment
    const weapon = WEAPONS[attacker.equipment.mainHand];
    const armor = ARMOR_TYPES[defender.equipment.armor || 'none'];

    // 6. Calculate damage
    const baseDamage = calculateDamage(attacker.stats, attacker.equipment.mainHand, attackType);
    const damageResult = this.calculateDamageModifiers(attacker, defender, baseDamage, attackType);

    // 7. Log attack
    const logHeader = this.buildCombatLogHeader(attacker, defender, attackTypeName, hitResult, damageResult, friendlyFire);
    const damageBreakdown = this.buildDamageBreakdown(attacker, damageResult, attackType);
    this.logger.combat(logHeader);
    this.logger.combat(`  {{hitPrefix}} ${damageBreakdown}`);

    // 8. Apply damage
    const bufferResult = this.applyDamage(attacker, defender, damageResult.finalDamage);
    this.logBufferDamageApplication(defender, bufferResult);

    // 9. Handle result
    return this.handleHitResult(defender, damageResult);
}
```

**Impact:**
- executeAttack() becomes ~35 lines (from 172) - **80% reduction**
- Clear, readable flow
- Each step is a meaningful function call
- Self-documenting code

**Test Plan:**
- Full combat regression
- All attack types (light/heavy)
- All outcomes (whiff/miss/hit/crit/defeat)
- Buffer system (bypass, overflow, normal)
- Flanking scenarios
- Resistance/vulnerability
- Semantic token rendering

---

## Testing Strategy

### Per-Batch Testing
After each batch:
1. Run game in browser
2. Enter combat mode (Shift+Space)
3. Execute relevant test scenarios
4. Check browser console for errors
5. Verify combat log styling

### Critical Test Scenarios

**Batch 1:**
- Any combat (animations work)

**Batch 2:**
- High stats vs low stats (hit rates)
- Flanking from behind
- Over-engaged defenders (at max capacity)

**Batch 3:**
- Critical hits (damage multipliers)
- Heavy armor vs light weapons
- Resistant combos (slash vs plate, piercing vs leather)

**Batch 4:**
- Read combat logs (exact format match)
- ALL semantic tokens render correctly
- All 4 buffer log branches
- Buffer bypass (unarmed/concussive)

**Batch 5:**
- Empty hex attacks (whiff)
- Low THC misses
- Successful hits
- Character defeats

**Batch 6:**
- Full regression across all scenarios
- Multiple attackers vs one defender
- Long combat sequences

### Semantic Token Verification Checklist
After EVERY batch:
- [ ] Character names styled correctly
- [ ] Damage values highlighted
- [ ] Status indicators visible (crit, flanking, etc.)
- [ ] No raw `{{token}}` syntax exposed to user
- [ ] Buffer indicators correct (depleted, bypassed)

---

## Risk Mitigation

### High-Risk Areas

**1. Semantic Token Corruption**
- **Risk:** String manipulation breaks token syntax
- **Mitigation:**
  - Test semantic tokens after EVERY batch
  - Visual inspection of combat log
  - Never manually build token strings without helper

**2. Logger Dependency**
- **Risk:** Extracted functions need logger access
- **Mitigation:**
  - All helpers are instance methods
  - Pass logger to any static helpers if needed

**3. Buffer Bypass Logic**
- **Risk:** Complex conditional with bypass flag
- **Mitigation:**
  - Dedicated test scenarios for concussive damage
  - Verify bypass logging branch

**4. Context-Sensitive Logging**
- **Risk:** 4 branches could be incorrectly merged
- **Mitigation:**
  - Keep all 4 branches in extracted function
  - Test each branch separately

---

## Benefits After Completion

### Testability
- Each calculation testable in isolation
- Can verify formulas without running full game
- Easy to add unit tests later
- Pure functions for all calculations

### Maintainability
- executeAttack() becomes self-documenting
- Changes to formulas isolated to specific functions
- Less risk when modifying combat logic
- Clear separation of concerns

### Readability
- Each function has single responsibility
- Flow is obvious from executeAttack() orchestration
- Semantic tokens make intent clear
- Comments focus on "why" not "what"

### Future-Proofing
- Easy to add new attack types
- Simple to modify damage formulas
- Straightforward to add new combat effects
- Buffer system extensible

---

## Final Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| executeAttack() lines | 172 | ~35 | -80% |
| Total methods | 3 | 13+ | +333% |
| Testable functions | 0 | 10+ | ∞ |
| Responsibilities per method | 18+ | 1-2 | -89% |
| Semantic token usage | 20+ | 20+ | Preserved |

**Total Time Investment:** 3-4 hours for dramatically improved code quality

---

## Recommendation

**Proceed with batched approach.** Each batch is:
- Independently valuable ✅
- Low-to-medium risk ✅
- Quickly testable ✅
- Builds on previous batches ✅

Start with Batch 1 (quick wins) to build confidence, then proceed sequentially through Batch 6.

**Critical Success Factors:**
1. Preserve ALL semantic tokens
2. Test after every batch
3. Don't skip batches
4. Verify buffer bypass logic thoroughly
