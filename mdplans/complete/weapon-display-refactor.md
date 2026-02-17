# Weapon Display & Rename Refactor

## Goal
- Rename shortBlunt/longBlunt → shortHammer/longHammer everywhere
- Update weapon display names to show damage type: "Short Hammer (blunt)", "Short Sword (slash)", etc.
- Combat log attack lines show weapon name: `"Bandit Thief: short-sword Attack"` or `"Hero: heavy long-hammer Attack"` (only show "heavy" prefix, light is default/silent)
- Weapon name in log is hoverable tooltip showing base damage and speed
- Character creation labels updated to match

## Files to Change

### 1. `js/const.js` — Weapon definitions & NPC templates
- Rename keys: `shortBlunt` → `shortHammer`, `longBlunt` → `longHammer`
- Update `name` field: `'Short Blunt'` → `'Short Hammer'`, `'Long Blunt'` → `'Long Hammer'`
- Update SKILLS.weapons array
- Update DEFAULT_SKILLS object
- Update NPC_TEMPLATES equipment references (bandit_brute uses shortBlunt)

### 2. `js/CombatSystem.js` — Attack log lines
- Change `attackTypeName` logic:
  - Light attack: `"{{weapon:weaponKey}} Attack"` (no "light" prefix)
  - Heavy attack: `"{{heavy}}heavy{{/heavy}} {{weapon:weaponKey}} Attack"`
- Apply to hit line, miss line, and whiff line
- New `{{weapon:key}}` token carries weapon key for tooltip rendering

### 3. `js/CombatUILog.js` — Weapon tooltip rendering
- Add `replaceWeaponTokens()` method (similar to `replaceArmorTokens`)
- `{{weapon:key}}` → `<span class="log-weapon">short-sword<span class="weapon-tooltip">Base: 4, Speed: 18</span></span>`
- Weapon display in log uses hyphenated lowercase: "short-sword", "long-hammer", "unarmed"
- Call in formatLogEntry before other tag replacements

### 4. `css/styles.css` — Weapon tooltip styles
- `.log-weapon` — hoverable, dotted underline
- `.weapon-tooltip` — same pattern as `.armor-tooltip`

### 5. `character-creation.html` — Radio labels & skill labels
- Rename "Short Blunt" → "Short Hammer (blunt)", etc.
- All weapons get damage type suffix: "Short Sword (slash)", "Short Spear (piercing)", etc.
- Update `data-skill` attributes: `shortBlunt` → `shortHammer`
- Update radio `value` attributes: `shortBlunt` → `shortHammer`

### 6. `docs/reference.md` — Weapon table
- Rename Short Blunt / Long Blunt rows to Short Hammer / Long Hammer

## Display Format Examples
```
Character creation:   "Short Hammer (blunt)"
Combat log attack:    "Hero: short-sword Attack Hero"
Combat log heavy:     "Hero: heavy long-hammer Attack Bandit"
Combat log whiff:     "Hero: short-spear attacks at empty hex - WHIFF"
Weapon tooltip:       "Base: 4 | Speed: 18"
```
