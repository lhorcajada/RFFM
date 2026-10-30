---
name: sai-5-security-worker
description: Security-audit worker for /sai-5-security and /sai-deep-review, dispatched only by their coordinators. Writes security.md.
model: opus
effort: medium
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, Agent, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-research.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/security/worker.md and follow it exactly.
