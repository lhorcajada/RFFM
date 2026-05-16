# Script para obtener la cadena de conexi�n de Azure SQL Database
# Uso: .\get-azure-sql-connection.ps1

param(
    [string]$ResourceGroup = "rffm-resources",
    [string]$ServerName = "",  # D�jalo vac�o para listar todos
    [string]$DatabaseName = "FutbolBase"
)

Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "   Azure SQL Database - Connection String" -ForegroundColor Cyan
Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

# Login en Azure (si no est� logueado)
Write-Host "?? Verificando sesi�n de Azure..." -ForegroundColor Yellow
$azAccount = az account show 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ejecutando 'az login'..." -ForegroundColor Yellow
    az login
}

$account = az account show | ConvertFrom-Json
Write-Host "? Logueado como: $($account.user.name)" -ForegroundColor Green
Write-Host ""

# Si no se especific� servidor, listar todos
if ([string]::IsNullOrEmpty($ServerName)) {
    Write-Host "?? Listando SQL Servers en la suscripci�n..." -ForegroundColor Yellow
    Write-Host ""
    
    $servers = az sql server list | ConvertFrom-Json
    
    if ($servers.Count -eq 0) {
        Write-Host "? No se encontraron SQL Servers" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Servers encontrados:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $servers.Count; $i++) {
        Write-Host "  [$i] $($servers[$i].name) (RG: $($servers[$i].resourceGroup))" -ForegroundColor White
    }
    
    Write-Host ""
    $selection = Read-Host "Selecciona el n�mero del servidor"
    $selectedServer = $servers[[int]$selection]
    $ServerName = $selectedServer.name
    $ResourceGroup = $selectedServer.resourceGroup
    
    Write-Host ""
    Write-Host "? Seleccionado: $ServerName" -ForegroundColor Green
    Write-Host ""
}

# Obtener informaci�n del servidor
Write-Host "?? Obteniendo informaci�n del servidor..." -ForegroundColor Yellow
$server = az sql server show `
    --name $ServerName `
    --resource-group $ResourceGroup | ConvertFrom-Json

Write-Host "? Servidor: $($server.fullyQualifiedDomainName)" -ForegroundColor Green
Write-Host "? Admin: $($server.administratorLogin)" -ForegroundColor Green
Write-Host ""

# Listar bases de datos
Write-Host "?? Bases de datos disponibles:" -ForegroundColor Yellow
$databases = az sql db list `
    --server $ServerName `
    --resource-group $ResourceGroup | ConvertFrom-Json

$databases | Where-Object { $_.name -ne "master" } | ForEach-Object {
    Write-Host "  - $($_.name)" -ForegroundColor White
}
Write-Host ""

# Construir connection string
$fqdn = $server.fullyQualifiedDomainName
$admin = $server.administratorLogin

Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "   CONNECTION STRING" -ForegroundColor Cyan
Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

Write-Host "??  NECESITAS RESETEAR LA CONTRASE�A:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opci�n 1 - Azure Portal:" -ForegroundColor White
Write-Host "  1. Ir a: Azure Portal ? SQL servers ? $ServerName" -ForegroundColor Gray
Write-Host "  2. Click en: Reset password" -ForegroundColor Gray
Write-Host "  3. Ingresar nueva contrase�a" -ForegroundColor Gray
Write-Host ""

Write-Host "Opci�n 2 - Azure CLI (ejecutar ahora):" -ForegroundColor White
$newPassword = Read-Host "Ingresa nueva contrase�a para SQL Admin (min 8 chars, may�sculas, min�sculas, n�meros)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($newPassword)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

if ($plainPassword.Length -ge 8) {
    Write-Host ""
    Write-Host "Reseteando contrase�a..." -ForegroundColor Yellow
    
    az sql server update `
        --name $ServerName `
        --resource-group $ResourceGroup `
        --admin-password $plainPassword
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "? Contrase�a actualizada exitosamente" -ForegroundColor Green
        Write-Host ""
        
        # Construir connection string completa
        $connectionString = "Server=tcp:$fqdn,1433;Initial Catalog=$DatabaseName;Persist Security Info=False;User ID=$admin;Password=$plainPassword;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
        
        Write-Host "???????????????????????????????????????????" -ForegroundColor Green
        Write-Host "   CONNECTION STRING COMPLETA:" -ForegroundColor Green
        Write-Host "???????????????????????????????????????????" -ForegroundColor Green
        Write-Host ""
        Write-Host $connectionString -ForegroundColor White
        Write-Host ""
        
        # Copiar al portapapeles
        $connectionString | Set-Clipboard
        Write-Host "? Connection string copiada al portapapeles" -ForegroundColor Green
        Write-Host ""
        
        # Guardar en archivo
        $outputFile = "azure-sql-connection.txt"
        @"
# Azure SQL Database Connection String
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# Server: $ServerName
# Database: $DatabaseName
# Admin User: $admin

# Full Connection String:
$connectionString

# For Azure App Service Configuration:
Name: ConnectionStrings__FutbolBaseConnection
Value: $connectionString
Type: SQL Azure

# For appsettings.json (development):
"ConnectionStrings": {
    "FutbolBaseConnection": "$connectionString"
}
"@ | Out-File $outputFile -Encoding UTF8
        
        Write-Host "? Connection string guardada en: $outputFile" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
        Write-Host "   PR�XIMOS PASOS:" -ForegroundColor Cyan
        Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Configurar en Azure Web App:" -ForegroundColor Yellow
        Write-Host "   Portal ? App Service ? Configuration ? Connection strings" -ForegroundColor Gray
        Write-Host "   Name: FutbolBaseConnection" -ForegroundColor Gray
        Write-Host "   Value: [la connection string de arriba]" -ForegroundColor Gray
        Write-Host "   Type: SQL Azure" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Configurar Firewall si es necesario:" -ForegroundColor Yellow
        Write-Host "   az sql server firewall-rule create \\" -ForegroundColor Gray
        Write-Host "     --server $ServerName \\" -ForegroundColor Gray
        Write-Host "     --resource-group $ResourceGroup \\" -ForegroundColor Gray
        Write-Host "     --name AllowAzureServices \\" -ForegroundColor Gray
        Write-Host "     --start-ip-address 0.0.0.0 \\" -ForegroundColor Gray
        Write-Host "     --end-ip-address 0.0.0.0" -ForegroundColor Gray
        Write-Host ""
        Write-Host "3. Test de conexi�n:" -ForegroundColor Yellow
        Write-Host "   Usar SQL Server Management Studio o Azure Data Studio" -ForegroundColor Gray
        Write-Host "   Server: $fqdn" -ForegroundColor Gray
        Write-Host "   Login: $admin" -ForegroundColor Gray
        Write-Host "   Password: [la que ingresaste]" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "? Error al actualizar contrase�a" -ForegroundColor Red
    }
} else {
    Write-Host "? Contrase�a muy corta (m�nimo 8 caracteres)" -ForegroundColor Red
}

Write-Host "???????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""
