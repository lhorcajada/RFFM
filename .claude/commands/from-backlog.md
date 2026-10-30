---
description: Load an existing PBI / Issue / Ticket into this conversation
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash(node .claude/sai/tools/from-backlog.js:*), PowerShell(node .claude/sai/tools/from-backlog.js:*), Bash(node ~/.claude/sai/tools/from-backlog.js:*), PowerShell(node ~/.claude/sai/tools/from-backlog.js:*)
---

Read `.claude/skills/from-backlog/SKILL.md`; if absent, read
`~/.claude/skills/from-backlog/SKILL.md`. Follow that skill in the current conversation,
retaining its context.
Invocation input: $ARGUMENTS
