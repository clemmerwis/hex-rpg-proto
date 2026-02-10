---
title: Optimize pathfinding with binary heap
area: performance
created: 2026-02-09
files:
  - js/Pathfinding.js
---

### Problem
getLowestFScore() iterates entire openSet linearly — O(n) per iteration instead of O(log n).

### Solution
Replace array scan with binary heap data structure. Should produce identical paths but worth visual verification.

### Notes
- From CONCERNS.md #9
- Deferred: not a bottleneck yet, matters when maps get bigger
- Needs visual testing to confirm paths unchanged
