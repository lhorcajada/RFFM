---
name: sai-4-review-worker
description: Review worker for /sai-4-review, /sai-build, and /sai-deep-review, dispatched only by their coordinators. Reviews the change's diff in a fresh worker and writes review.md without fixing anything.
model: opus
effort: medium
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, Agent, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-research.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/review/worker.md and follow it exactly.
