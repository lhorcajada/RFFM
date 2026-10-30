---
description: Reconstruct proposal.md and capability specs from an already-implemented diff, for a change that skipped the SAI workflow.
argument-hint: "[change-name] [--staged | --unstaged | --diff <sha>] [--fast-track]"
model: sonnet
effort: high
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Skill, Agent, SendMessage, TaskCreate, TaskUpdate, TaskGet, TaskList, Bash, PowerShell, Bash(node .claude/sai/tools/transfer.js:*), PowerShell(node .claude/sai/tools/transfer.js:*), Bash(node ~/.claude/sai/tools/transfer.js:*), PowerShell(node ~/.claude/sai/tools/transfer.js:*)
---
Fetch @skills/fetch/SKILL.md
Fetch @sai/adapters/claude/boot.md and follow it.
Required capability profile: backfill-command.
Fetch @sai/commands/backfill/command-bootstrap.md and follow those instructions exactly, forwarding the InvocationEnvelope block below.

InvocationEnvelope:
  command_name: backfill
  arguments_value: $ARGUMENTS
