# Script para configurar Azure Container Registry y Web App
# Uso: .\setup-azure.ps1 -ResourceGroup "your-rg" -WebAppName "your-webapp"

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "rffm-resources",
    
    [Parameter(Mandatory=$false)]
    [string]$WebAppName = "rffmapi",
    
    [Parameter(Mandatory=$false)]
    [string]$AcrName = "rffmregistry",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "westeurope"
)

Write-Host "=== RFFM Azure Setup Script ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si está logueado en Azure
Write-Host "Verificando sesión de Azure..." -ForegroundColor Yellow
$azAccount = az account show 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "? No estás logueado en Azure. Ejecutando 'az login'..." -ForegroundColor Red
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "? Error al hacer login en Azure" -ForegroundColor Red
        exit 1
    }
}

$account = az account show | ConvertFrom-Json
Write-Host "? Logueado como: $($account.user.name)" -ForegroundColor Green
Write-Host "? Subscription: $($account.name)" -ForegroundColor Green
Write-Host ""

# 1. Habilitar Admin User en ACR
Write-Host "1. Habilitando Admin User en Azure Container Registry..." -ForegroundColor Yellow
az acr update --name $AcrName --admin-enabled true
if ($LASTEXITCODE -eq 0) {
    Write-Host "? Admin user habilitado" -ForegroundColor Green
} else {
    Write-Host "? Error al habilitar admin user" -ForegroundColor Red
}
Write-Host ""

# 2. Obtener credenciales de ACR
Write-Host "2. Obteniendo credenciales de ACR..." -ForegroundColor Yellow
$acrCreds = az acr credential show --name $AcrName | ConvertFrom-Json
$acrLoginServer = az acr show --name $AcrName --query loginServer --output tsv

Write-Host "? Login Server: $acrLoginServer" -ForegroundColor Green
Write-Host "? Username: $($acrCreds.username)" -ForegroundColor Green
Write-Host "? Password: ****** (obtenida)" -ForegroundColor Green
Write-Host ""

# 3. Configurar Web App para usar ACR
Write-Host "3. Configurando Web App para usar Container Registry..." -ForegroundColor Yellow
az webapp config container set `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --docker-custom-image-name "$acrLoginServer/rffm-api:latest" `
    --docker-registry-server-url "https://$acrLoginServer" `
    --docker-registry-server-user $acrCreds.username `
    --docker-registry-server-password $acrCreds.passwords[0].value

if ($LASTEXITCODE -eq 0) {
    Write-Host "? Web App configurada" -ForegroundColor Green
} else {
    Write-Host "? Error al configurar Web App" -ForegroundColor Red
}
Write-Host ""

# 4. Habilitar Continuous Deployment
Write-Host "4. Habilitando Continuous Deployment..." -ForegroundColor Yellow
az webapp deployment container config `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --enable-cd true

if ($LASTEXITCODE -eq 0) {
    Write-Host "? Continuous Deployment habilitado" -ForegroundColor Green
} else {
    Write-Host "? Error al habilitar Continuous Deployment" -ForegroundColor Red
}
Write-Host ""

# 5. Mostrar información para GitHub Secrets
Write-Host "=== Información para GitHub Secrets ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configura estos secretos en GitHub:" -ForegroundColor Yellow
Write-Host "Repository ? Settings ? Secrets and variables ? Actions ? New repository secret" -ForegroundColor Gray
Write-Host ""
Write-Host "ACR_LOGIN_SERVER:" -ForegroundColor White
Write-Host $acrLoginServer -ForegroundColor Green
Write-Host ""
Write-Host "ACR_USERNAME:" -ForegroundColor White
Write-Host $acrCreds.username -ForegroundColor Green
Write-Host ""
Write-Host "ACR_PASSWORD:" -ForegroundColor White
Write-Host $acrCreds.passwords[0].value -ForegroundColor Green
Write-Host ""

# 6. Verificar configuración actual de Web App
Write-Host "=== Configuración actual de Web App ===" -ForegroundColor Cyan
Write-Host ""
$webappConfig = az webapp config show --name $WebAppName --resource-group $ResourceGroup | ConvertFrom-Json
Write-Host "? Linux FX Version: $($webappConfig.linuxFxVersion)" -ForegroundColor Green
Write-Host "? Always On: $($webappConfig.alwaysOn)" -ForegroundColor Green
Write-Host ""

# 7. Verificar Application Settings
Write-Host "=== Application Settings Configuradas ===" -ForegroundColor Cyan
$appSettings = az webapp config appsettings list --name $WebAppName --resource-group $ResourceGroup | ConvertFrom-Json
Write-Host ""
Write-Host "Settings encontradas:" -ForegroundColor Yellow
$appSettings | Where-Object { $_.name -notlike "WEBSITE_*" } | ForEach-Object {
    Write-Host "  - $($_.name)" -ForegroundColor Gray
}
Write-Host ""

# 8. Comandos útiles
Write-Host "=== Comandos Útiles ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ver logs en tiempo real:" -ForegroundColor Yellow
Write-Host "  az webapp log tail --name $WebAppName --resource-group $ResourceGroup" -ForegroundColor Gray
Write-Host ""
Write-Host "Reiniciar Web App:" -ForegroundColor Yellow
Write-Host "  az webapp restart --name $WebAppName --resource-group $ResourceGroup" -ForegroundColor Gray
Write-Host ""
Write-Host "Ver imágenes en ACR:" -ForegroundColor Yellow
Write-Host "  az acr repository show-tags --name $AcrName --repository rffm-api --output table" -ForegroundColor Gray
Write-Host ""
Write-Host "Forzar pull de imagen:" -ForegroundColor Yellow
Write-Host "  az webapp config container set --name $WebAppName --resource-group $ResourceGroup --docker-custom-image-name `"$acrLoginServer/rffm-api:latest`"" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Setup Completado ===" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Configura los secretos en GitHub usando los valores mostrados arriba" -ForegroundColor White
Write-Host "2. Configura las variables de entorno en Azure Portal (Configuration ? Application settings)" -ForegroundColor White
Write-Host "3. Haz push a main para probar el deployment automático" -ForegroundColor White
Write-Host "4. Verifica que la API responde en: https://$WebAppName.azurewebsites.net/swagger" -ForegroundColor White
Write-Host ""
