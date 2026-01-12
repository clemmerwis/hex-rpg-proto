# GSD Flow Explanation
/gsd:map-codebase - just once.

## The Flow Looks Like This:

**You type:** `/gsd:new-project`
**Claude:** Asks you questions about what you want to build, creates PROJECT.md
**Claude:** Done!

**You type:** `/gsd:create-roadmap`
**Claude:** Reads PROJECT.md, generates phases, creates ROADMAP.md
**Claude:** Done! Your roadmap has 5 phases.

**You type:** `/gsd:plan-phase 1`
**Claude:** Reads roadmap, creates detailed atomic tasks for phase 1 in PLAN.md
**Claude:** Done! Phase 1 plan is ready.

**You type:** `/gsd:execute-plan`
**Claude:** Spawns fresh subagent, implements tasks, commits each one
**Claude:** Done! Phase 1 complete.

**You type:** `/gsd:plan-phase 2`
**And so on...**

## Why Individual Commands?

- **Review between steps** - You can check the roadmap before planning phase 1
- **Test between phases** - You verify phase 1 works before moving to phase 2
- **Stop/resume** - Can pause between any phase
- **Multiple sessions** - Can spread across days/weeks

It's a **conversation-driven workflow**, not a single "run everything" command. Each step waits for your approval to continue.
