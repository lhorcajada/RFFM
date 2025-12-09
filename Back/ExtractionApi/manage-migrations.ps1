# Script para gestionar migraciones de Entity Framework Core
# Uso: .\manage-migrations.ps1 -Action [create|apply|remove|list|reset]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("create", "apply", "remove", "list", "reset", "script")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [string]$MigrationName = "",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("AppDbContext", "IdentityDbContext")]
    [string]$Context = "AppDbContext",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputScript = "migration-script.sql"
)

$projectPath = "src\RFFM.Host\RFFM.Host.csproj"
$startupProject = "src\RFFM.Host\RFFM.Host.csproj"
$apiProject = "src\RFFM.Api\RFFM.Api.csproj"

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Entity Framework Core - Migrations" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    "create" {
        if ([string]::IsNullOrWhiteSpace($MigrationName)) {
            $MigrationName = Read-Host "Nombre de la migración"
        }
        
        Write-Host "📝 Creando migración: $MigrationName" -ForegroundColor Yellow
        Write-Host "   Context: $Context" -ForegroundColor Gray
        Write-Host ""
        
        dotnet ef migrations add $MigrationName `
            --project $apiProject `
            --startup-project $startupProject `
            --context "RFFM.Api.Infrastructure.Persistence.$Context" `
            --output-dir "Infrastructure/Migrations"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Migración creada exitosamente" -ForegroundColor Green
            Write-Host ""
            Write-Host "Próximos pasos:" -ForegroundColor Cyan
            Write-Host "  1. Revisar el archivo de migración generado" -ForegroundColor White
            Write-Host "  2. Aplicar: .\manage-migrations.ps1 -Action apply" -ForegroundColor White
            Write-Host "  3. Commit: git add . && git commit -m 'feat: add $MigrationName migration'" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "❌ Error al crear migración" -ForegroundColor Red
        }
    }
    
    "apply" {
        Write-Host "🚀 Aplicando migraciones..." -ForegroundColor Yellow
        Write-Host "   Context: $Context" -ForegroundColor Gray
        Write-Host ""
        
        dotnet ef database update `
            --project $apiProject `
            --startup-project $startupProject `
            --context "RFFM.Api.Infrastructure.Persistence.$Context"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Migraciones aplicadas exitosamente" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Error al aplicar migraciones" -ForegroundColor Red
        }
    }
    
    "remove" {
        Write-Host "🗑️  Eliminando última migración..." -ForegroundColor Yellow
        Write-Host "   Context: $Context" -ForegroundColor Gray
        Write-Host ""
        
        $confirm = Read-Host "¿Estás seguro? (s/n)"
        if ($confirm -eq "s") {
            dotnet ef migrations remove `
                --project $apiProject `
                --startup-project $startupProject `
                --context "RFFM.Api.Infrastructure.Persistence.$Context" `
                --force
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✓ Migración eliminada exitosamente" -ForegroundColor Green
            } else {
                Write-Host ""
                Write-Host "❌ Error al eliminar migración" -ForegroundColor Red
            }
        } else {
            Write-Host "Cancelado" -ForegroundColor Yellow
        }
    }
    
    "list" {
        Write-Host "📋 Listando migraciones..." -ForegroundColor Yellow
        Write-Host "   Context: $Context" -ForegroundColor Gray
        Write-Host ""
        
        dotnet ef migrations list `
            --project $apiProject `
            --startup-project $startupProject `
            --context "RFFM.Api.Infrastructure.Persistence.$Context"
        
        Write-Host ""
        Write-Host "Leyenda:" -ForegroundColor Cyan
        Write-Host "  (Pending) - No aplicada" -ForegroundColor Yellow
        Write-Host "  (Applied) - Aplicada" -ForegroundColor Green
    }
    
    "script" {
        Write-Host "📜 Generando script SQL..." -ForegroundColor Yellow
        Write-Host "   Context: $Context" -ForegroundColor Gray
        Write-Host "   Output: $OutputScript" -ForegroundColor Gray
        Write-Host ""
        
        dotnet ef migrations script `
            --project $apiProject `
            --startup-project $startupProject `
            --context "RFFM.Api.Infrastructure.Persistence.$Context" `
            --output $OutputScript `
            --idempotent
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Script SQL generado: $OutputScript" -ForegroundColor Green
            Write-Host ""
            Write-Host "Puedes ejecutar este script en:" -ForegroundColor Cyan
            Write-Host "  - SQL Server Management Studio" -ForegroundColor White
            Write-Host "  - Azure Data Studio" -ForegroundColor White
            Write-Host "  - sqlcmd" -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "❌ Error al generar script" -ForegroundColor Red
        }
    }
    
    "reset" {
        Write-Host "⚠️  PELIGRO: Esto eliminará todas las migraciones y recreará la base de datos" -ForegroundColor Red
        Write-Host "   Context: $Context" -ForegroundColor Gray
        Write-Host ""
        
        $confirm = Read-Host "¿Estás SEGURO? Escribe 'RESET' para confirmar"
        if ($confirm -eq "RESET") {
            Write-Host ""
            Write-Host "1️⃣ Eliminando base de datos..." -ForegroundColor Yellow
            
            dotnet ef database drop `
                --project $apiProject `
                --startup-project $startupProject `
                --context "RFFM.Api.Infrastructure.Persistence.$Context" `
                --force
            
            Write-Host ""
            Write-Host "2️⃣ Aplicando migraciones..." -ForegroundColor Yellow
            
            dotnet ef database update `
                --project $apiProject `
                --startup-project $startupProject `
                --context "RFFM.Api.Infrastructure.Persistence.$Context"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✓ Base de datos recreada exitosamente" -ForegroundColor Green
            } else {
                Write-Host ""
                Write-Host "❌ Error al recrear base de datos" -ForegroundColor Red
            }
        } else {
            Write-Host "Cancelado" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Comandos útiles de referencia
if ($Action -eq "create" -and $LASTEXITCODE -eq 0) {
    Write-Host "Comandos útiles:" -ForegroundColor Cyan
    Write-Host "  Ver cambios:  git diff src/RFFM.Api/Infrastructure/Migrations/" -ForegroundColor Gray
    Write-Host "  Aplicar:      .\manage-migrations.ps1 -Action apply" -ForegroundColor Gray
    Write-Host "  Listar:       .\manage-migrations.ps1 -Action list" -ForegroundColor Gray
    Write-Host "  Remover:      .\manage-migrations.ps1 -Action remove" -ForegroundColor Gray
    Write-Host ""
}
