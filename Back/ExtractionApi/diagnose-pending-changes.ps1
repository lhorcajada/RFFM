# Script para diagnosticar cambios pendientes en el modelo
# Uso: .\diagnose-pending-changes.ps1

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("AppDbContext", "IdentityDbContext", "Both")]
    [string]$Context = "Both"
)

$projectPath = "src\RFFM.Api\RFFM.Api.csproj"
$startupProject = "src\RFFM.Host\RFFM.Host.csproj"

Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "   Diagnóstico de Cambios Pendientes" -ForegroundColor Cyan
Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

function Test-PendingChanges {
    param (
        [string]$ContextName
    )
    
    Write-Host "?? Verificando $ContextName..." -ForegroundColor Yellow
    Write-Host ""
    
    # Intentar agregar una migración temporal para ver los cambios
    $tempMigrationName = "TempDiagnostic_$(Get-Date -Format 'yyyyMMddHHmmss')"
    
    $output = dotnet ef migrations add $tempMigrationName `
        --project $projectPath `
        --startup-project $startupProject `
        --context "RFFM.Api.Infrastructure.Persistence.$ContextName" `
        --output-dir "Infrastructure/Migrations/Temp" `
        --no-build `
        2>&1 | Out-String
    
    if ($output -match "No changes") {
        Write-Host "? No hay cambios pendientes en $ContextName" -ForegroundColor Green
        return $false
    }
    else {
        Write-Host "??  CAMBIOS PENDIENTES DETECTADOS en $ContextName" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Salida de EF Core:" -ForegroundColor Cyan
        Write-Host $output
        Write-Host ""
        
        # Intentar remover la migración temporal
        Write-Host "Limpiando migración temporal..." -ForegroundColor Gray
        dotnet ef migrations remove `
            --project $projectPath `
            --startup-project $startupProject `
            --context "RFFM.Api.Infrastructure.Persistence.$ContextName" `
            --force `
            2>&1 | Out-Null
        
        return $true
    }
    
    Write-Host ""
}

$hasPendingChanges = $false

if ($Context -eq "AppDbContext" -or $Context -eq "Both") {
    $result = Test-PendingChanges -ContextName "AppDbContext"
    $hasPendingChanges = $hasPendingChanges -or $result
}

if ($Context -eq "IdentityDbContext" -or $Context -eq "Both") {
    $result = Test-PendingChanges -ContextName "IdentityDbContext"
    $hasPendingChanges = $hasPendingChanges -or $result
}

Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan

if ($hasPendingChanges) {
    Write-Host ""
    Write-Host "?? ACCIONES RECOMENDADAS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Revisar los cambios mostrados arriba" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Crear migración para AppDbContext:" -ForegroundColor White
    Write-Host "   .\manage-migrations.ps1 -Action create -MigrationName `"SyncModelChanges`" -Context AppDbContext" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. O para IdentityDbContext:" -ForegroundColor White
    Write-Host "   .\manage-migrations.ps1 -Action create -MigrationName `"SyncModelChanges`" -Context IdentityDbContext" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Aplicar migración:" -ForegroundColor White
    Write-Host "   .\manage-migrations.ps1 -Action apply" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. Ejecutar la aplicación de nuevo" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "? No hay cambios pendientes en ningún contexto" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si sigues viendo el error, intenta:" -ForegroundColor Yellow
    Write-Host "  1. Limpiar y reconstruir: dotnet clean && dotnet build" -ForegroundColor White
    Write-Host "  2. Eliminar carpeta bin/obj" -ForegroundColor White
    Write-Host "  3. Reiniciar Visual Studio" -ForegroundColor White
    Write-Host ""
}

Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""
