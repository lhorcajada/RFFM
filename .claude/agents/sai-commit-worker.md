---
name: sai-commit-worker
description: Commit-message worker for /sai-commit, dispatched only by its coordinator. Drafts the message from the staged changes; the coordinator runs git.
model: haiku
effort: medium
tools: Read, Glob, Grep, Skill, Bash, PowerShell, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-read.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/commit/worker.md and follow it exactly.
