---
name: sai-2-design-worker
description: Design worker for /sai-2-design and /sai-explore, dispatched only by their coordinators. Writes design.md, tasks.md, and interfaces.md.
model: sonnet
effort: high
tools: Read, Glob, Grep, Edit, Write, Skill, Bash, PowerShell, Agent, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-design.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/design/worker.md and follow it exactly.
