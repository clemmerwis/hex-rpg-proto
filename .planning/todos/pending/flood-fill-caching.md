---
title: Pre-compute blocked hex flood-fill on area load
area: performance
created: 2026-02-09
files:
  - js/Renderer.js
---

### Problem
getConnectedBlockedHexes() recomputes flood-fill during rendering. Called per blocked hex.

### Solution
Pre-compute on area load, invalidate only when blocked hexes change. Requires visual testing to verify rendering unchanged.

### Notes
- From CONCERNS.md #10
- Deferred: needs visual testing session with screenshots
