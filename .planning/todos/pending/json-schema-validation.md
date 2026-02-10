---
title: Add JSON schema validation for area loading
area: security
created: 2026-02-09
files:
  - js/AreaManager.js
---

### Problem
Area JSON files loaded and used without schema validation.

### Solution
Add JSON schema validation when loading area files. Only needed if loading from external/untrusted sources.

### Notes
- From CONCERNS.md #14
- Deferred: trigger when adding external data sources or multiplayer
