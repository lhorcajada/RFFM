---
description: Read-only progress panel for one OpenSpec change — the 10 sai-workflow artifacts, specs approval, task progress, and a next-command hint. Writes nothing.
argument-hint: "[change-name]"
model: haiku
effort: medium
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash(openspec:*), PowerShell(openspec:*), Bash(node .claude/sai/tools/status.js:*), PowerShell(node .claude/sai/tools/status.js:*), Bash(node ~/.claude/sai/tools/status.js:*), PowerShell(node ~/.claude/sai/tools/status.js:*), Bash(node .claude/sai/tools/change-picker.js:*), PowerShell(node .claude/sai/tools/change-picker.js:*), Bash(node ~/.claude/sai/tools/change-picker.js:*), PowerShell(node ~/.claude/sai/tools/change-picker.js:*)
---
Fetch @skills/fetch/SKILL.md
Fetch @sai/adapters/claude/boot.md and follow it.
Required capability profile: status-command.
Fetch @sai/commands/status/command-bootstrap.md and follow those instructions exactly, forwarding the InvocationEnvelope block below.

InvocationEnvelope:
  command_name: status
  arguments_value: $ARGUMENTS
