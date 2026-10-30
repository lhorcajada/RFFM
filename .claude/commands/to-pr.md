---
description: Create or update a GitHub PR or GitLab MR after confirmation
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash(node .claude/sai/tools/to-pr.js:*), PowerShell(node .claude/sai/tools/to-pr.js:*), Bash(node ~/.claude/sai/tools/to-pr.js:*), PowerShell(node ~/.claude/sai/tools/to-pr.js:*)
---

Read `.claude/skills/to-pr/SKILL.md`; if absent, read
`~/.claude/skills/to-pr/SKILL.md`. Follow that skill in the current conversation,
retaining its context.
Invocation input: $ARGUMENTS
