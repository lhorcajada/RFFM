# Conventional Commits Helper
# Guides user through creating a valid conventional commit
# https://www.conventionalcommits.org/

param(
    [string]$Type = "",
    [string]$Scope = "",
    [string]$Message = "",
    [switch]$Breaking = $false
)

$ErrorActionPreference = "Stop"

Write-Host "📝 Conventional Commits Builder" -ForegroundColor Cyan

# Valid commit types
$validTypes = @(
    "feat",      # A new feature
    "fix",       # A bug fix
    "docs",      # Documentation only changes
    "style",     # Changes that don't affect code meaning (formatting, semicolons, etc)
    "refactor",  # Code change that neither fixes a bug nor adds a feature
    "perf",      # Code change that improves performance
    "test",      # Adding missing tests or correcting existing tests
    "chore",     # Changes to build process, dependencies, or other non-code changes
    "ci",        # Changes to CI configuration files and scripts
    "build",     # Changes to build system or dependencies
    "revert"     # Reverts a previous commit
)

# If type not provided, prompt user
if (-not $Type) {
    Write-Host "`nSelect commit type:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $validTypes.Count; $i++) {
        Write-Host "  $($i+1). $($validTypes[$i])"
    }
    $choice = Read-Host "`nEnter number (1-$($validTypes.Count))"
    [int]$index = $choice - 1

    if ($index -lt 0 -or $index -ge $validTypes.Count) {
        Write-Host "❌ Invalid selection" -ForegroundColor Red
        exit 1
    }
    $Type = $validTypes[$index]
}

# Validate type
if ($validTypes -notcontains $Type) {
    Write-Host "❌ Invalid type: $Type" -ForegroundColor Red
    Write-Host "Valid types: $($validTypes -join ', ')" -ForegroundColor Yellow
    exit 1
}

# Prompt for scope if not provided
if (-not $Scope) {
    $Scope = Read-Host "Scope (optional, e.g., authentication, database, api)"
    if ($Scope) {
        $Scope = "($Scope)"
    }
}

# Prompt for message if not provided
if (-not $Message) {
    $Message = Read-Host "Description"
}

# Validate message
if (-not $Message -or $Message.Length -eq 0) {
    Write-Host "❌ Description cannot be empty" -ForegroundColor Red
    exit 1
}

# Build the commit message
$breakingFlag = if ($Breaking) { "!" } else { "" }
$commitMessage = "$Type$Scope$breakingFlag: $Message"

# Validate format
$pattern = '^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?: .{1,}$'
if ($commitMessage -notmatch $pattern) {
    Write-Host "❌ Invalid commit message format" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Valid commit message:" -ForegroundColor Green
Write-Host "   $commitMessage" -ForegroundColor Green

# Return the commit message
Write-Output $commitMessage
