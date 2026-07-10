# Conventional Commits Validator
# Ensures commit messages follow conventional commits format
# https://www.conventionalcommits.org/

param(
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Stop"

Write-Host "📝 Conventional Commits Validator" -ForegroundColor Cyan

# Pattern: type(scope)?: description
# Valid types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
$pattern = '^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?: .{1,}$'

if ($CommitMessage -match $pattern) {
    Write-Host "✅ Commit message is valid" -ForegroundColor Green
    return $true
}

Write-Host "❌ Commit message does NOT follow Conventional Commits format" -ForegroundColor Red
Write-Host "`nExpected format:`n  type(scope)?: description`n`nValid types:`n  feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert" -ForegroundColor Yellow
Write-Host "`nExample:`n  feat(authentication): add JWT token refresh mechanism" -ForegroundColor Gray

return $false
