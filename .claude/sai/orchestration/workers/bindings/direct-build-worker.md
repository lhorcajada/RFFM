# direct-build worker binding — Claude Code

Claude Code calls for dispatching and continuing sai-direct-build-worker. The lifecycle —
ready handshake, task disclosure, guard windows, and at most one bounded
replacement dispatch — is owned by `sai/orchestration/command-runner.md`.

When the coordinator adapter declares a `progress_plan`,
Fetch @sai/adapters/claude/panel-render.md for coordinator-owned task-list rendering;
render actions come from @sai/policies/todo-structure.md, and the worker never emits panel tool calls.

## Dispatch

Dispatch the worker once; the returned agent ID is the runner's resumable
handle. A replacement dispatch reuses this call, then the continuation
restores the original envelope (`arguments_value`) and the adapter's
`replacement_reconstruction_fields`.

```
Agent(
  subagent_type: "sai-direct-build-worker",
  name: "sai-direct-build-worker",
  run_in_background: true,
  prompt: "Worker contract: Fetch @sai/commands/explore/direct-build-worker.md and follow it exactly.\n\nReturn event: ready now; await task disclosure in the same-worker continuation.\n\nReturn exactly:\n```yaml\nevent: ready\nchanged_files: []\n```"
)
```

## Continue

Continue on the same worker by sending every continuation — task disclosure,
`continue_after_*` payloads with any pointer line, answers, and feedback — to
the captured handle:

```
SendMessage(to: "<captured agent ID>", message: "<continuation payload>")
```
