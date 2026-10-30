---
description: Manage linked git worktrees — list them, then safely create or delete them from a selector loop. No OpenSpec prerequisite.
model: haiku
effort: medium
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash(git:*), PowerShell(git:*), Bash(node .claude/sai/tools/worktree.js:*), PowerShell(node .claude/sai/tools/worktree.js:*), Bash(node ~/.claude/sai/tools/worktree.js:*), PowerShell(node ~/.claude/sai/tools/worktree.js:*)
---
Fetch @skills/fetch/SKILL.md
Fetch @sai/adapters/claude/boot.md and follow it.
Required capability profile: worktree-command.
Fetch @sai/commands/worktree/command-bootstrap.md and follow those instructions exactly, forwarding the InvocationEnvelope block below.

InvocationEnvelope:
  command_name: worktree
  arguments_value: $ARGUMENTS
