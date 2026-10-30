---
description: Import the manually first backlog item into this conversation
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash(node .claude/sai/tools/from-next-backlog-item.js select), PowerShell(node .claude/sai/tools/from-next-backlog-item.js select), Bash(node ~/.claude/sai/tools/from-next-backlog-item.js select), PowerShell(node ~/.claude/sai/tools/from-next-backlog-item.js select), Bash(node .claude/sai/tools/from-backlog.js:*), PowerShell(node .claude/sai/tools/from-backlog.js:*), Bash(node ~/.claude/sai/tools/from-backlog.js:*), PowerShell(node ~/.claude/sai/tools/from-backlog.js:*)
---

Read `.claude/skills/from-next-backlog-item/SKILL.md`; if absent, read
`~/.claude/skills/from-next-backlog-item/SKILL.md`. Follow that skill in the current
conversation, retaining its context and exploration stage.
This command takes no arguments. Invocation input: $ARGUMENTS
