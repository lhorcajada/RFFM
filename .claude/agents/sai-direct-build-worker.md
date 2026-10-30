---
name: sai-direct-build-worker
description: Direct Build implementer for /sai-explore, dispatched only by its coordinator. Implements a change straight from its Ready to Propose block.
model: sonnet
effort: high
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-write.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/explore/direct-build-worker.md and follow it exactly.
