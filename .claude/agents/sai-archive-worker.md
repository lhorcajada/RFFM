---
name: sai-archive-worker
description: Archive worker for /sai-archive and /sai-explore, dispatched only by their coordinators. Runs the read-only archive pre-flight and, under Direct Build, the authorized sync, move, staging, and commit.
model: haiku
effort: medium
tools: Read, Glob, Grep, Skill, Bash, PowerShell, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-read.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/archive/worker.md and follow it exactly.
