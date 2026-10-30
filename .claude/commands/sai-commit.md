---
description: Commit the staged changes with a Conventional Commits message — drafts the subject (≤50 chars) and optional body, and commits only after you authorize it.
argument-hint: "[optional: --scope X --type Y --no-body --amend]"
model: sonnet
effort: high
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Agent, SendMessage, TaskCreate, TaskUpdate, TaskGet, TaskList, Bash, PowerShell
---
Fetch @skills/fetch/SKILL.md
Fetch @sai/adapters/claude/boot.md and follow it.
Required capability profile: commit-command.
Fetch @sai/commands/commit/command-bootstrap.md and follow those instructions exactly, forwarding the InvocationEnvelope block below.

InvocationEnvelope:
  command_name: commit
  arguments_value: $ARGUMENTS
