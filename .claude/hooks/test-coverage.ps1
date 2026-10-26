# Runs only the tests affected by the pending changes (front: vitest related, back: dotnet test).
# Full suite with coverage is on demand: `npm run test:coverage` in Front/.

param(
    [string]$Layer = "auto"  # auto, all, front, back
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

function Get-ChangedFiles {
    $files = @()
    $files += git diff --name-only HEAD 2>$null
    $files += git diff --name-only '@{u}..HEAD' 2>$null
    $files | Where-Object { $_ } | Sort-Object -Unique
}

$changed = @(Get-ChangedFiles)
$runFront = $Layer -eq "all" -or $Layer -eq "front" -or ($Layer -eq "auto" -and ($changed | Where-Object { $_ -like "Front/*" }))
$runBack = $Layer -eq "all" -or $Layer -eq "back" -or ($Layer -eq "auto" -and ($changed | Where-Object { $_ -like "Back/*" }))

Write-Host "Testing affected code (front=$([bool]$runFront), back=$([bool]$runBack))" -ForegroundColor Cyan

if ($runFront) {
    Set-Location "$projectRoot\Front"
    $frontFiles = @($changed | Where-Object { $_ -like "Front/src/*" } | ForEach-Object { $_.Substring(6) })
    $configChanged = $changed | Where-Object { $_ -match '^Front/(package\.json|vitest\.config\.ts|src/test/)' }

    if ($Layer -eq "all" -or $Layer -eq "front" -or $configChanged) {
        $testResult = npx vitest run --config vitest.config.ts 2>&1
    }
    elseif ($frontFiles.Count -gt 0) {
        $testResult = npx vitest related --run --config vitest.config.ts @frontFiles 2>&1
    }
    else {
        $testResult = $null
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend tests FAILED" -ForegroundColor Red
        Write-Host $testResult
        exit 1
    }
    Write-Host "Frontend tests passed" -ForegroundColor Green
}

if ($runBack) {
    Set-Location "$projectRoot\Back\ExtractionApi"
    $testResult = dotnet test --logger "console;verbosity=minimal" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend tests FAILED" -ForegroundColor Red
        Write-Host $testResult
        exit 1
    }
    Write-Host "Backend tests passed" -ForegroundColor Green
}
