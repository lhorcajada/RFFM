# Script para construir y ejecutar la aplicación con Docker
# Uso: .\docker-build-run.ps1

param(
    [string]$Action = "build"
)

Write-Host "=== RFFM Docker Build & Run ===" -ForegroundColor Cyan

switch ($Action.ToLower()) {
    "build" {
        Write-Host "Construyendo imagen Docker..." -ForegroundColor Yellow
        docker-compose build --no-cache
        Write-Host "? Imagen construida exitosamente" -ForegroundColor Green
    }
    "up" {
        Write-Host "Iniciando contenedores..." -ForegroundColor Yellow
        docker-compose up -d
        Write-Host "? Contenedores iniciados" -ForegroundColor Green
        Write-Host "API disponible en: https://localhost:7287" -ForegroundColor Cyan
        Write-Host "Swagger disponible en: https://localhost:7287/swagger" -ForegroundColor Cyan
    }
    "down" {
        Write-Host "Deteniendo contenedores..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "? Contenedores detenidos" -ForegroundColor Green
    }
    "logs" {
        Write-Host "Mostrando logs..." -ForegroundColor Yellow
        docker-compose logs -f rffm-api
    }
    "restart" {
        Write-Host "Reiniciando contenedores..." -ForegroundColor Yellow
        docker-compose restart
        Write-Host "? Contenedores reiniciados" -ForegroundColor Green
    }
    "clean" {
        Write-Host "Limpiando todo (contenedores, imágenes, volúmenes)..." -ForegroundColor Red
        $confirm = Read-Host "¿Estás seguro? (s/n)"
        if ($confirm -eq "s") {
            docker-compose down -v --rmi all
            Write-Host "? Limpieza completa realizada" -ForegroundColor Green
        }
    }
    default {
        Write-Host "Uso: .\docker-build-run.ps1 [build|up|down|logs|restart|clean]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Comandos disponibles:" -ForegroundColor Cyan
        Write-Host "  build   - Construir imagen Docker"
        Write-Host "  up      - Iniciar contenedores"
        Write-Host "  down    - Detener contenedores"
        Write-Host "  logs    - Ver logs de la API"
        Write-Host "  restart - Reiniciar contenedores"
        Write-Host "  clean   - Limpiar todo (cuidado!)"
    }
}
