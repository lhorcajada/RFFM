# Build All Platforms Script
# Compiles frontend and backend

param(
    [string]$Layer = "all"  # all, front, back
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

Write-Host "🔨 Building All Platforms" -ForegroundColor Cyan

# Frontend Build
if ($Layer -eq "all" -or $Layer -eq "front") {
    Write-Host "`n📦 Frontend Build (Vite)" -ForegroundColor Yellow
    Set-Location "$projectRoot\Front"

    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Gray
        npm install
    }

    $buildResult = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend build FAILED" -ForegroundColor Red
        Write-Host $buildResult
        exit 1
    }

    Write-Host "✅ Frontend build successful" -ForegroundColor Green
}

# Backend Build
if ($Layer -eq "all" -or $Layer -eq "back") {
    Write-Host "`n📦 Backend Build (.NET 9)" -ForegroundColor Yellow
    Set-Location "$projectRoot\Back\ExtractionApi"

    $buildResult = dotnet build --configuration Release 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Backend build FAILED" -ForegroundColor Red
        Write-Host $buildResult
        exit 1
    }

    Write-Host "✅ Backend build successful" -ForegroundColor Green
}

Write-Host "`n✅ All platforms built successfully" -ForegroundColor Green
