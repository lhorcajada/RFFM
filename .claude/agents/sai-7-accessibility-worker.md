---
name: sai-7-accessibility-worker
description: Accessibility-audit worker for /sai-7-accessibility and /sai-deep-review, dispatched only by their coordinators. Writes accessibility.md.
model: opus
effort: medium
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, Agent, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-research.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/accessibility/worker.md and follow it exactly.
