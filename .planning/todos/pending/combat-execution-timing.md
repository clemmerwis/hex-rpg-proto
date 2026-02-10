---
title: Fix combat execution timing safety
area: stability
created: 2026-02-09
files:
  - js/CombatSystem.js
---

### Problem
Two-stage setTimeout during attack execution. Character defeat during windup could conflict with attack resolution.

### Solution
Add defensive checks for character validity at each stage of combat execution. Requires visual testing to verify combat flow.

### Notes
- From CONCERNS.md #5
- Deferred: needs visual testing session with screenshots
