# OpenSpec + TDD Reminder
# Runs on UserPromptSubmit. Injects additional context asking Claude to check
# whether the incoming request should go through the OpenSpec workflow, and
# if so, to enforce strict TDD (Red -> Green -> Refactor) during implementation.

$additionalContext = @"
OPENSPEC CHECK: If this request involves a non-trivial change (new backend feature, new frontend component/page, or cross-stack work), ask the user first: "Quieres que use el flujo OpenSpec (proposal -> design -> tasks -> implement) para esto?" before starting implementation. Skip this question for trivial fixes, styling tweaks, or answering questions.

If the user confirms OpenSpec (or you are implementing an OpenSpec change), apply this TDD reminder during implementation:

TDD REMINDER: Strict Red -> Green -> Refactor methodology required.
1. RED: Write failing tests FIRST (Vitest + Testing Library for frontend, xUnit + Moq for backend)
2. GREEN: Write minimal implementation to pass tests only
3. REFACTOR: Clean code while keeping tests green

NEVER start with implementation. Test file first, always.
Target coverage: >=75% frontend, >=80% backend handlers, >=85% domain logic.
"@

$output = @{
    hookSpecificOutput = @{
        hookEventName   = "UserPromptSubmit"
        additionalContext = $additionalContext
    }
}

$output | ConvertTo-Json -Depth 5 -Compress
