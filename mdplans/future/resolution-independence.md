# Resolution Independence - Future Improvements

## Status Overview

- **DPI Scaling**: PRIMARY - Should be implemented soon for crisp rendering on high-DPI displays
- **Resize Handling**: UNCERTAIN - Maybe eventually, depends on use case
- **Adaptive Zoom**: UNCERTAIN - Optional polish, low priority

---

## 1. DPI Scaling for Retina/4K Displays (PRIMARY)

### Current Issue
The canvas is rendered at logical pixel dimensions (e.g., 1600x900), but on high-DPI displays (Retina MacBooks, 4K monitors with scaling), the physical pixels are 2x or 3x that resolution. Without accounting for `devicePixelRatio`, everything appears blurry.

### Why This Matters
- Retina/4K displays are increasingly common
- Blurry rendering looks unprofessional and hurts visual clarity
- Players on high-DPI displays get a worse experience than intended

### Implementation Approach

**In Game.js - Update canvas setup:**

```javascript
setupCanvas() {
    const dpr = window.devicePixelRatio || 1;

    // Set CSS display size (logical pixels)
    this.canvas.style.width = this.config.viewport.width + 'px';
    this.canvas.style.height = this.config.viewport.height + 'px';

    // Set actual canvas buffer size (physical pixels)
    this.canvas.width = this.config.viewport.width * dpr;
    this.canvas.height = this.config.viewport.height * dpr;

    // Scale the context to match
    this.ctx.scale(dpr, dpr);

    console.log(`Canvas DPI: ${dpr}x | Buffer: ${this.canvas.width}x${this.canvas.height} | Display: ${this.config.viewport.width}x${this.config.viewport.height}`);
}
```

**Call this method during initialization and on resize (if implementing resize handling).**

### Testing
- Test on standard 1x displays (1080p, 1440p without scaling)
- Test on Retina displays (MacBook Pro 2x)
- Test on 4K displays with 200% scaling (2x)
- Verify sprites and grid lines look crisp, not blurry

### Estimated Effort
- **15-30 minutes** implementation
- Requires testing on different display types

### Priority
🔴 **HIGH** - Significant quality improvement for a growing percentage of users

---

## 2. Resize Handling (UNCERTAIN)

### Current Issue
The canvas viewport is set once on page load. If users resize their browser window, the canvas doesn't adapt - it stays at the original dimensions.

### Why This Might Matter
- Desktop users often resize browser windows while multitasking
- Maximizing/restoring window feels broken if canvas doesn't adapt
- Fullscreen mode would benefit from dynamic resizing

### Why It Might Not Matter
- Many users don't resize game windows frequently
- Docker/localhost dev environment may not be resized often
- Mobile browsers auto-resize, but mobile isn't a primary target yet

### Implementation Approach

**Add resize listener in Game.js constructor:**

```javascript
constructor() {
    // ... existing code ...

    window.addEventListener('resize', () => this.handleResize());
}

handleResize() {
    // Recalculate viewport dimensions
    this.config.viewport.width = Math.min(window.innerWidth * 0.9, 1600);
    this.config.viewport.height = Math.min(window.innerHeight * 0.85, 900);

    // Update canvas (includes DPI handling if implemented)
    this.setupCanvas();

    // Recalculate camera bounds to prevent out-of-bounds camera
    this.clampCamera();

    // Force re-render
    this.render();
}
```

**Considerations:**
- Should resize be debounced (wait until user stops resizing)?
- Should camera position shift to keep player character centered?
- Does HexGrid need recalculation, or is it resolution-agnostic?

### Testing
- Resize window from small to large
- Maximize/restore window
- Ensure camera doesn't go out of bounds
- Verify rendering performance doesn't degrade

### Estimated Effort
- **30-45 minutes** implementation + testing
- Depends on whether DPI scaling is done first

### Priority
🟡 **MEDIUM-LOW** - Nice UX improvement, but not critical for initial release

---

## 3. Adaptive Zoom (UNCERTAIN)

### Current Issue
The zoom level is hardcoded to `0.5` in `const.js`. This works reasonably well for most displays, but may be:
- Too zoomed out on small screens (mobile, small laptops)
- Too zoomed in on large screens (ultrawide monitors, 4K displays)
- Not optimal for showing the right amount of game world

### Why This Might Matter
- Better first impression - game "looks right" immediately on any screen
- Mobile support - if targeting phones/tablets, zoom needs to adapt
- Accessibility - larger UI elements for smaller screens

### Why It Might Not Matter
- Fixed zoom is simpler and easier to balance gameplay around
- Users can manually zoom (if zoom controls are added later)
- Desktop is primary target, where fixed zoom works fine

### Implementation Approach

**Option A: Calculate optimal zoom based on world/viewport ratio**

```javascript
// In const.js or Game.js
calculateOptimalZoom(viewportWidth, viewportHeight, worldWidth, worldHeight) {
    // Show approximately 60% of world width and height
    const widthZoom = viewportWidth / (worldWidth * 0.6);
    const heightZoom = viewportHeight / (worldHeight * 0.6);

    // Use the smaller zoom to ensure both dimensions fit
    const calculatedZoom = Math.min(widthZoom, heightZoom);

    // Clamp to reasonable bounds (don't zoom in too close or too far)
    return Math.min(Math.max(calculatedZoom, 0.3), 1.0);
}

// In Game.js constructor
this.config.zoom = this.calculateOptimalZoom(
    this.config.viewport.width,
    this.config.viewport.height,
    GAME_CONSTANTS.WORLD_WIDTH,
    GAME_CONSTANTS.WORLD_HEIGHT
);
```

**Option B: Fixed zoom levels based on viewport size categories**

```javascript
function getZoomForViewport(viewportWidth) {
    if (viewportWidth < 800) return 0.3;       // Mobile/small screens
    if (viewportWidth < 1200) return 0.5;      // Tablets/laptops
    if (viewportWidth < 2000) return 0.7;      // Desktop
    return 0.9;                                 // Ultrawide/4K
}
```

**Option C: User-controlled zoom with +/- keys**

```javascript
// In InputHandler.js keyboard handling
if (e.key === '=' || e.key === '+') {
    this.game.config.zoom = Math.min(this.game.config.zoom * 1.1, 2.0);
}
if (e.key === '-') {
    this.game.config.zoom = Math.max(this.game.config.zoom * 0.9, 0.2);
}
```

### Testing
- Test on screens from 1280x720 to 3840x2160
- Verify game world is visible but not too zoomed in/out
- Check that zoom doesn't break camera bounds or rendering
- Ensure performance is acceptable at all zoom levels

### Estimated Effort
- **Option A**: 45 minutes (math + testing)
- **Option B**: 20 minutes (simple thresholds)
- **Option C**: 30 minutes (UI controls + key handling)

### Priority
🟢 **LOW** - Polish feature, not essential for core gameplay

---

## Recommendation: Implementation Order

If implementing these features:

1. **DPI Scaling** - Do this first, highest impact for quality
2. **Resize Handling** - Implement if DPI scaling is done and resize feels necessary
3. **Adaptive Zoom** - Only if targeting mobile or widely varying screen sizes

### Notes
- DPI scaling should be tested on actual high-DPI hardware (Retina display, 4K monitor)
- Resize handling pairs well with DPI scaling (reuse canvas setup logic)
- Adaptive zoom can wait until there's evidence it's needed (user feedback, mobile support)

---

## Related Issues
- Delta time fixes (✅ DONE) - Ensures timing consistency across refresh rates
- Animation speed perception - Different refresh rates (60Hz vs 144Hz) make animations "feel" different speeds even with correct delta time

## Future Considerations
- Touch input support (mobile)
- Orientation change handling (portrait/landscape on mobile)
- Fullscreen API support
- Pinch-to-zoom on mobile devices
