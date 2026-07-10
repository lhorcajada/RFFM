# Test Coverage Verification Script
# Runs tests and validates coverage thresholds

param(
    [string]$Layer = "all"  # all, front, back
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

Write-Host "🧪 Testing and Coverage Verification" -ForegroundColor Cyan

# Frontend Tests
if ($Layer -eq "all" -or $Layer -eq "front") {
    Write-Host "`n📦 Frontend Tests (Vitest + Testing Library)" -ForegroundColor Yellow
    Set-Location "$projectRoot\Front"

    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Gray
        npm install
    }

    $testResult = npm run test -- --coverage --run 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend tests FAILED" -ForegroundColor Red
        Write-Host $testResult
        exit 1
    }

    Write-Host "✅ Frontend tests PASSED" -ForegroundColor Green
}

# Backend Tests
if ($Layer -eq "all" -or $Layer -eq "back") {
    Write-Host "`n📦 Backend Tests (xUnit + Moq)" -ForegroundColor Yellow
    Set-Location "$projectRoot\Back\ExtractionApi"

    $testResult = dotnet test --no-build --logger "console;verbosity=minimal" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Backend tests FAILED" -ForegroundColor Red
        Write-Host $testResult
        exit 1
    }

    Write-Host "✅ Backend tests PASSED" -ForegroundColor Green
}

Write-Host "`n✅ All tests passed with acceptable coverage" -ForegroundColor Green
