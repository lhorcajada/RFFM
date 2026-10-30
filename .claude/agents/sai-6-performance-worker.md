---
name: sai-6-performance-worker
description: Performance-audit worker for /sai-6-performance and /sai-deep-review, dispatched only by their coordinators. Writes performance.md.
model: opus
effort: medium
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, Agent, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-research.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/performance/worker.md and follow it exactly.
