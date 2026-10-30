---
description: Merge, rebase, or squash-rebase a branch — resolves all conflicts, reports unavailable tests, and finalizes locally automatically; fast-track applies presented strategies without approval.
argument-hint: "[--fast-track]"
model: opus
effort: medium
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Skill, Agent, SendMessage, TaskCreate, TaskUpdate, TaskGet, TaskList, Bash, PowerShell, Bash(node .claude/sai/tools/transfer.js:*), PowerShell(node .claude/sai/tools/transfer.js:*), Bash(node ~/.claude/sai/tools/transfer.js:*), PowerShell(node ~/.claude/sai/tools/transfer.js:*)
---
Fetch @skills/fetch/SKILL.md
Fetch @sai/adapters/claude/boot.md and follow it.
Required capability profile: merge-command.
Fetch @sai/commands/merge/command-bootstrap.md and follow those instructions exactly, forwarding the InvocationEnvelope block below.

InvocationEnvelope:
  command_name: merge
  arguments_value: $ARGUMENTS
