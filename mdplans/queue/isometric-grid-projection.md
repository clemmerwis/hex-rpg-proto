# Isometric Grid Projection

## Goal
Adjust hex grid to match isometric background art perspective.

## When to Implement
After receiving custom art with known isometric specifications from artist.

## What to Ask Artist
- Isometric ratio (e.g., 2:1) OR camera angle (e.g., 30°)
- Reference tile measurements if available

## What Needs to Change
- `HexGrid.js` - hexToPixel and pixelToHex need isometric projection math
- `Renderer.js` - hex shape drawing needs to match the projection
- `const.js` - add ratio configuration

## Key Insight
Both hex center positions AND hex vertex shapes must use the same transformation for proper tiling.

## Reference
Browser Claude conversation (Jan 2026) discussed the math in detail. Research isometric hex grid projection fresh when implementing - don't rely on previous failed attempts.
