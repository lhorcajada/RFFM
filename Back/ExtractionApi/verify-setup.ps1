# Script de verificación de configuración de Azure y GitHub
# Uso: .\verify-setup.ps1

param(
    [string]$ResourceGroup = "rffm-resources",
    [string]$WebAppName = "rffmapi",
    [string]$AcrName = "rffmregistry"
)

Write-Host ""
Write-Host "??????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "?   RFFM - Verificación de Configuración    ?" -ForegroundColor Cyan
Write-Host "??????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

$allOk = $true

# 1. Verificar Azure CLI
Write-Host "?? Verificando Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az version | ConvertFrom-Json
    Write-Host "   ? Azure CLI instalado: $($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Host "   ? Azure CLI no encontrado" -ForegroundColor Red
    $allOk = $false
}

# 2. Verificar sesión Azure
Write-Host "?? Verificando sesión de Azure..." -ForegroundColor Yellow
try {
    $account = az account show | ConvertFrom-Json
    Write-Host "   ? Logueado como: $($account.user.name)" -ForegroundColor Green
    Write-Host "   ? Subscription: $($account.name)" -ForegroundColor Green
} catch {
    Write-Host "   ? No estás logueado en Azure" -ForegroundColor Red
    Write-Host "   ? Ejecuta: az login" -ForegroundColor Yellow
    $allOk = $false
}

Write-Host ""

# 3. Verificar ACR
Write-Host "?? Verificando Azure Container Registry..." -ForegroundColor Yellow
try {
    $acr = az acr show --name $AcrName | ConvertFrom-Json
    Write-Host "   ? ACR encontrado: $($acr.name)" -ForegroundColor Green
    Write-Host "   ? Login Server: $($acr.loginServer)" -ForegroundColor Green
    
    # Verificar Admin User
    $acrCreds = az acr credential show --name $AcrName | ConvertFrom-Json
    if ($acrCreds.username) {
        Write-Host "   ? Admin user habilitado" -ForegroundColor Green
    } else {
        Write-Host "   ? Admin user NO habilitado" -ForegroundColor Red
        Write-Host "   ? Ejecuta: az acr update --name $AcrName --admin-enabled true" -ForegroundColor Yellow
        $allOk = $false
    }
    
    # Verificar imágenes
    $images = az acr repository list --name $AcrName | ConvertFrom-Json
    if ($images -contains "rffm-api") {
        Write-Host "   ? Repositorio 'rffm-api' existe" -ForegroundColor Green
        $tags = az acr repository show-tags --name $AcrName --repository rffm-api | ConvertFrom-Json
        Write-Host "   ? Tags disponibles: $($tags.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "   ? Repositorio 'rffm-api' no encontrado (se creará en el primer push)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ? Error al acceder a ACR" -ForegroundColor Red
    $allOk = $false
}

Write-Host ""

# 4. Verificar Web App
Write-Host "?? Verificando Azure Web App..." -ForegroundColor Yellow
try {
    $webapp = az webapp show --name $WebAppName --resource-group $ResourceGroup | ConvertFrom-Json
    Write-Host "   ? Web App encontrada: $($webapp.name)" -ForegroundColor Green
    Write-Host "   ? Estado: $($webapp.state)" -ForegroundColor Green
    Write-Host "   ? URL: https://$($webapp.defaultHostName)" -ForegroundColor Green
    
    # Verificar configuración de container
    $containerConfig = az webapp config container show --name $WebAppName --resource-group $ResourceGroup | ConvertFrom-Json
    if ($containerConfig[0].value -like "*$AcrName*") {
        Write-Host "   ? Configurado para usar ACR" -ForegroundColor Green
    } else {
        Write-Host "   ? NO configurado para usar ACR" -ForegroundColor Red
        $allOk = $false
    }
    
    # Verificar App Settings críticos
    $appSettings = az webapp config appsettings list --name $WebAppName --resource-group $ResourceGroup | ConvertFrom-Json
    $requiredSettings = @("Jwt__Key", "Jwt__Issuer", "Authentication__FrontendSecret")
    $missingSettings = @()
    
    foreach ($setting in $requiredSettings) {
        if (-not ($appSettings | Where-Object { $_.name -eq $setting })) {
            $missingSettings += $setting
        }
    }
    
    if ($missingSettings.Count -eq 0) {
        Write-Host "   ? Variables de entorno críticas configuradas" -ForegroundColor Green
    } else {
        Write-Host "   ? Variables faltantes:" -ForegroundColor Yellow
        foreach ($missing in $missingSettings) {
            Write-Host "     - $missing" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ? Error al acceder a Web App" -ForegroundColor Red
    $allOk = $false
}

Write-Host ""

# 5. Verificar Dockerfile
Write-Host "?? Verificando Dockerfile..." -ForegroundColor Yellow
$dockerfilePath = ".\src\RFFM.Host\Dockerfile"
if (Test-Path $dockerfilePath) {
    Write-Host "   ? Dockerfile encontrado" -ForegroundColor Green
    $content = Get-Content $dockerfilePath -Raw
    if ($content -match "dotnet/aspnet:9\.0") {
        Write-Host "   ? Usando .NET 9.0" -ForegroundColor Green
    } else {
        Write-Host "   ? No está usando .NET 9.0" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ? Dockerfile no encontrado en $dockerfilePath" -ForegroundColor Red
    $allOk = $false
}

Write-Host ""

# 6. Verificar GitHub Workflow
Write-Host "?? Verificando GitHub Workflow..." -ForegroundColor Yellow
$workflowPath = "..\..\..\.github\workflows\back-azure-acr-deploy.yml"
if (Test-Path $workflowPath) {
    Write-Host "   ? Workflow encontrado" -ForegroundColor Green
    $workflowContent = Get-Content $workflowPath -Raw
    if ($workflowContent -match "DOTNET_VERSION.*9\.0") {
        Write-Host "   ? Configurado para .NET 9.0" -ForegroundColor Green
    } else {
        Write-Host "   ? No está configurado para .NET 9.0" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ? Workflow no encontrado" -ForegroundColor Red
    $allOk = $false
}

Write-Host ""

# 7. Test de conectividad API
Write-Host "?? Probando conectividad con la API..." -ForegroundColor Yellow
try {
    $url = "https://$WebAppName.azurewebsites.net/swagger/index.html"
    $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ? API responde (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host "   ? Swagger disponible en: $url" -ForegroundColor Green
} catch {
    Write-Host "   ? API no responde o Swagger no disponible" -ForegroundColor Yellow
    Write-Host "   ? Esto es normal si aún no has hecho el primer deployment" -ForegroundColor Gray
}

Write-Host ""
Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan

if ($allOk) {
    Write-Host ""
    Write-Host "? CONFIGURACIÓN COMPLETA" -ForegroundColor Green
    Write-Host ""
    Write-Host "Todo está configurado correctamente." -ForegroundColor White
    Write-Host "Puedes hacer push a main para deployar:" -ForegroundColor White
    Write-Host ""
    Write-Host "  git add ." -ForegroundColor Gray
    Write-Host "  git commit -m 'feat: configure CI/CD pipeline'" -ForegroundColor Gray
    Write-Host "  git push origin main" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "??  CONFIGURACIÓN INCOMPLETA" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Hay algunos problemas que necesitan atención." -ForegroundColor White
    Write-Host "Revisa los mensajes arriba marcados con ?" -ForegroundColor White
    Write-Host ""
    Write-Host "Documentación:" -ForegroundColor White
    Write-Host "  - SETUP_CHECKLIST.md" -ForegroundColor Gray
    Write-Host "  - GITHUB_ACTIONS_AZURE_GUIDE.md" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

# 8. Mostrar información útil
Write-Host "?? Información Útil:" -ForegroundColor Cyan
Write-Host ""
Write-Host "ACR Login Server:" -ForegroundColor White
try {
    $acrInfo = az acr show --name $AcrName | ConvertFrom-Json
    Write-Host "  $($acrInfo.loginServer)" -ForegroundColor Green
} catch {}

Write-Host ""
Write-Host "Web App URL:" -ForegroundColor White
Write-Host "  https://$WebAppName.azurewebsites.net" -ForegroundColor Green

Write-Host ""
Write-Host "Swagger UI:" -ForegroundColor White
Write-Host "  https://$WebAppName.azurewebsites.net/swagger" -ForegroundColor Green

Write-Host ""
Write-Host "GitHub Actions:" -ForegroundColor White
Write-Host "  https://github.com/lhorcajada/RFFM/actions" -ForegroundColor Green

Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Cyan
Write-Host "  Ver logs:     az webapp log tail --name $WebAppName --resource-group $ResourceGroup" -ForegroundColor Gray
Write-Host "  Reiniciar:    az webapp restart --name $WebAppName --resource-group $ResourceGroup" -ForegroundColor Gray
Write-Host "  Ver imágenes: az acr repository show-tags --name $AcrName --repository rffm-api" -ForegroundColor Gray
Write-Host ""
