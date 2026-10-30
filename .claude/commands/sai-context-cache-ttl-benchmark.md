---
description: Measure context-cache lifetime in the current conversation or a same-model subagent
allowed-tools: Read, AskUserQuestion, Skill, Agent, SendMessage, Bash(node .claude/skills/sai-context-cache-ttl-benchmark/cache_ttl.js:*), PowerShell(node .claude/skills/sai-context-cache-ttl-benchmark/cache_ttl.js:*), Bash(node ~/.claude/skills/sai-context-cache-ttl-benchmark/cache_ttl.js:*), PowerShell(node ~/.claude/skills/sai-context-cache-ttl-benchmark/cache_ttl.js:*)
---

Read `.claude/skills/sai-context-cache-ttl-benchmark/SKILL.md`; if absent, read
`~/.claude/skills/sai-context-cache-ttl-benchmark/SKILL.md`. Follow it in the
current conversation, retaining its context and model.
Session id: ${CLAUDE_SESSION_ID}
Invocation input: $ARGUMENTS
