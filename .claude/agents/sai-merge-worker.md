---
name: sai-merge-worker
description: Merge worker for /sai-merge, dispatched only by its coordinator. Analyzes conflicts, proposes one resolution strategy, scans ADR/DDR collisions, and writes resolution content.
model: opus
effort: medium
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-write.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/merge/worker.md and follow it exactly.
