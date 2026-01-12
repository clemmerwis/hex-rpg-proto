# Combat UI Log Implementation Plan

## Overview
Create a draggable, resizable combat log UI box (500px × 200px) with cream background, chocolate brown text, and extensive color coding. The log displays combat events with rich formatting including character names (faction-colored), damage breakdowns, hit/miss indicators, and special conditions.

## Architecture
- **New Module**: `CombatUILog.js` - handles UI rendering, drag/resize, and text formatting
- **Existing Logger.js**: Already perfect - provides `getGameLog()` and `clearGameLog()`
- **Pattern**: Follow existing UI box pattern (HTML structure + CSS styling + JS updates)

## Color Coding Reference
| Element | Color | CSS Class / Style |
|---------|-------|-------------------|
| Default text | Chocolate brown (#3B2414) | Default |
| Character names | Faction colors | Inline style from FACTIONS |
| - Hero | Green (#4CAF50) | |
| - Companion | Blue (#4169E1) | |
| - Bandit | Red (#B22222) | |
| - Guard | Orange (#FF9800) | |
| Damage numbers | Red (#ff0000) | `.log-damage` |
| Healing | Green (#00ff00) | `.log-heal` |
| "HIT" | Green bold | `.log-hit` |
| "MISS" / "WHIFF" | Red bold | `.log-miss` |
| DR text | Silver (#C0C0C0) | `.log-dr` |
| "heavy" attack | Underlined in red | `.log-heavy` |
| Conditions text [critical] | Orange (#FF8C00) | `.log-condition` |
| Condition brackets [ ] | Chocolate brown | `.log-condition-bracket` |

## Implementation Order

### Phase 1: Basic UI Structure ✓ COMPLETE
1. Add HTML to `rpg.html`
2. Add CSS to `styles.css`
3. Verify visual appearance

### Phase 2: CombatUILog Module Core ✓ COMPLETE
1. Create `CombatUILog.js` skeleton
2. Implement `init()`, `show()`, `hide()`, `clear()`
3. Basic `update()` with unformatted text rendering
4. Integrate into `Game.js`

### Phase 3: Drag and Resize ✓ COMPLETE
1. Implement drag functionality
2. Implement resize functionality

### Phase 4: Text Formatting ✓ COMPLETE
1. Implement character name coloring
2. Implement damage number coloring
3. Add all text styling patterns

### Phase 5: Combat System Integration ✓ COMPLETE
1. Modify `CombatSystem.js` to capture THC/Roll
2. Update log message formats
3. Modify `GameStateManager.js` show/hide
4. Add move action logging

### Phase 6: Polish ✓ COMPLETE
1. Auto-scroll behavior
2. Clear button functionality
3. Ready for testing

## Files to Create/Modify

**CREATE:**
- `js/CombatUILog.js` (~300 lines)

**MODIFY:**
1. `rpg.html` - Add combat log HTML after line 48
2. `css/styles.css` - Add ~80 lines of styling
3. `js/Game.js` - Import, create, init, update
4. `js/GameStateManager.js` - Show/hide log
5. `js/CombatSystem.js` - Capture THC/Roll, update formats
