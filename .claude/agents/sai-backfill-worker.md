---
name: sai-backfill-worker
description: Backfill worker for /sai-backfill, /sai-archive, and /sai-explore, dispatched only by their coordinators. Interviews and drafts proposal and spec content from a diff and, under Direct Build, writes the authorized drafts.
model: opus
effort: medium
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, Agent, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-backfill.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/backfill/worker.md and follow it exactly.
