---
title: Split Renderer.js into focused modules
area: architecture
created: 2026-02-09
files:
  - js/Renderer.js
---

### Problem
Renderer.js (634 lines) handles grid, characters, UI, faction borders. Difficult to modify one rendering aspect without reading entire file.

### Solution
Extract HexGridRenderer, CharacterRenderer, UIOverlayRenderer. Requires visual testing to verify rendering unchanged.

### Notes
- From CONCERNS.md #8
- Deferred: needs visual testing session with screenshots
