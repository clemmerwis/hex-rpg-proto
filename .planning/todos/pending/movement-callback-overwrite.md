---
title: Fix movement callback overwrite
area: stability
created: 2026-02-09
files:
  - js/MovementSystem.js
---

### Problem
Movement callback Map overwrites if same character moves twice. Previous callback lost without warning.

### Solution
Add warning or queue callbacks per character. Requires visual testing to verify animations still work correctly.

### Notes
- From CONCERNS.md #4
- Deferred: needs visual testing session with screenshots
