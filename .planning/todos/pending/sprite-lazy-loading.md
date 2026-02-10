---
title: Implement sprite lazy loading
area: performance
created: 2026-02-09
files:
  - js/AssetManager.js
---

### Problem
All sprites loaded into memory upfront. ~50-100 sprite sets before memory pressure.

### Solution
Implement lazy loading, sprite atlas, or streaming. Not hitting limits with current asset count.

### Notes
- From CONCERNS.md #15
- Deferred: trigger when asset count grows significantly
