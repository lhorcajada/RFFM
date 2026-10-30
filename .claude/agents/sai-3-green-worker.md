---
name: sai-3-green-worker
description: GREEN worker for /sai-3-implement, /sai-build, and /sai-deep-review, dispatched only by their coordinators. Lives for the whole run and writes each step's production code, leaving its tests as written.
model: haiku
effort: xhigh
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-execution.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/implement/green-worker.md and follow it exactly.
