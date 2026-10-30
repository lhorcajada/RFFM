---
description: Archive a completed change — syncs its delta specs and moves it into the archive through the OpenSpec CLI, then offers a commit.
argument-hint: "[change-name] [--fast-track]"
model: sonnet
effort: high
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Skill, Agent, SendMessage, TaskCreate, TaskUpdate, TaskGet, TaskList, Bash, PowerShell, Bash(node .claude/sai/tools/transfer.js:*), PowerShell(node .claude/sai/tools/transfer.js:*), Bash(node ~/.claude/sai/tools/transfer.js:*), PowerShell(node ~/.claude/sai/tools/transfer.js:*)
---
Fetch @skills/fetch/SKILL.md
Fetch @sai/adapters/claude/boot.md and follow it.
Required capability profile: archive-command.
Fetch @sai/commands/archive/command-bootstrap.md and follow those instructions exactly, forwarding the InvocationEnvelope block below.

InvocationEnvelope:
  command_name: archive
  arguments_value: $ARGUMENTS
