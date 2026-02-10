---
title: Split GameStateManager.js into focused modules
area: architecture
created: 2026-02-09
files:
  - js/GameStateManager.js
---

### Problem
GameStateManager.js (705 lines) handles state machine, AI triggers, engagement, and combat phases. Hard to navigate, maintain, and test.

### Solution
Split into state machine core, combat orchestrator, and engagement system. Should wait until basic state machine tests exist.

### Notes
- From CONCERNS.md #7
- Deferred: blocked by test suite — too risky to refactor without tests
