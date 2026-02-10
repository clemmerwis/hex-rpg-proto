---
title: Implement seeded RNG system
area: quality
created: 2026-02-09
files:
  - js/GameStateManager.js
  - js/CombatSystem.js
---

### Problem
Math.random() used without RNG seeding. Combat encounters not reproducible for testing/balancing.

### Solution
Implement seeded RNG system. Could fold into test suite phase.

### Notes
- From CONCERNS.md #13
- Deferred: only matters for reproducible testing/balancing
