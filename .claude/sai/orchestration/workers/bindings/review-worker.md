# review worker binding — Claude Code

Claude Code calls for creating and continuing sai-4-review-worker. The coordinator
that fetches this binding owns the worker's lifecycle: when to create it, when
to replace it, and what each message carries.

## Create

Create the worker with the ready prompt alone. The returned agent ID is its
handle for the whole run. A replacement worker is created with the same call.

```
Agent(
  subagent_type: "sai-4-review-worker",
  name: "sai-4-review-worker",
  run_in_background: true,
  prompt: "Worker contract: Fetch @sai/commands/review/worker.md and follow it exactly.\n\nReturn event: ready now; await task disclosure in the same-worker continuation.\n\nReturn exactly:\n```yaml\nevent: ready\nchanged_files: []\n```"
)
```

## Continue

Send every later message (each step's brief, a fix round, or a corrected
instruction) to the captured handle:

```
SendMessage(to: "<captured agent ID>", message: "<message>")
```
