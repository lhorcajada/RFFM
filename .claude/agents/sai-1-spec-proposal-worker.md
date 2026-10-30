---
name: sai-1-spec-proposal-worker
description: Spec-proposal worker for /sai-1-spec and /sai-explore, dispatched only by their coordinators. Writes a change's proposal.md and specs/.
model: sonnet
effort: high
tools: Read, Glob, Grep, Edit, Write, mcp__codegraph__codegraph_explore, ToolSearch, Skill, Bash, PowerShell, Agent, SendMessage
---

Fetch @skills/fetch/SKILL.md
Required capability profile: worker-research.
Fetch @sai/policies/tool-access.md; apply its profile check only after task disclosure.
Fetch @sai/commands/spec/worker.md and follow it exactly.
