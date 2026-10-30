---
description: Create a backlog item or update the originating issue after confirmation
allowed-tools: Read, Glob, Grep, AskUserQuestion, Skill, Bash(node .claude/sai/tools/to-backlog.js:*), PowerShell(node .claude/sai/tools/to-backlog.js:*), Bash(node ~/.claude/sai/tools/to-backlog.js:*), PowerShell(node ~/.claude/sai/tools/to-backlog.js:*), Bash(node .claude/skills/to-backlog/scripts/prepare-temp.js claude), PowerShell(node .claude/skills/to-backlog/scripts/prepare-temp.js claude), Bash(node ~/.claude/skills/to-backlog/scripts/prepare-temp.js claude), PowerShell(node ~/.claude/skills/to-backlog/scripts/prepare-temp.js claude)
---

Read `.claude/skills/to-backlog/SKILL.md`; if absent, read
`~/.claude/skills/to-backlog/SKILL.md`. Follow that skill in the current conversation,
retaining its context.
Invocation input: $ARGUMENTS
