# ?? RFFM - Real Federaci�n de F�tbol de Madrid API

API para la gesti�n de competiciones, equipos y jugadores de la RFFM.

## ?? Quick Start

### Desarrollo Local

```bash
# Restaurar dependencias
dotnet restore

# Ejecutar la aplicaci�n (migraciones se aplican autom�ticamente)
dotnet run --project src/RFFM.Host

# Acceder a Swagger
https://localhost:7287/swagger
```

### Docker

```bash
# Usando el script de PowerShell
.\docker-build-run.ps1 build
.\docker-build-run.ps1 up

# O directamente con docker-compose
docker-compose up -d
```

## ??? Database Migrations

### Migraciones Autom�ticas

Las migraciones de Entity Framework Core se aplican **autom�ticamente** al iniciar la aplicaci�n.

### Gesti�n Manual de Migraciones

Usa el script de PowerShell incluido:

```powershell
# Crear nueva migraci�n
.\manage-migrations.ps1 -Action create -MigrationName "AddNewTable"

# Aplicar migraciones
.\manage-migrations.ps1 -Action apply

# Listar migraciones
.\manage-migrations.ps1 -Action list

# Generar script SQL
.\manage-migrations.ps1 -Action script

# Eliminar �ltima migraci�n
.\manage-migrations.ps1 -Action remove

# Reset completo de base de datos (PELIGRO)
.\manage-migrations.ps1 -Action reset
```

### Comandos EF Core directos

```bash
# Crear migraci�n
dotnet ef migrations add MigrationName --project src/RFFM.Api --startup-project src/RFFM.Host

# Aplicar migraciones
dotnet ef database update --project src/RFFM.Api --startup-project src/RFFM.Host

# Ver migraciones pendientes
dotnet ef migrations list --project src/RFFM.Api --startup-project src/RFFM.Host
```

## ?? Documentaci�n

### Para Desarrollo

- ?? **[Docker Setup](DOCKER_README.md)** - Gu�a completa de Docker
- ?? **[Variables de Entorno](.env.example)** - Configuraci�n requerida

### Para Deployment

- ?? **[GitHub Actions + Azure](GITHUB_ACTIONS_AZURE_GUIDE.md)** - Gu�a completa de CI/CD
- ? **[Setup Checklist](SETUP_CHECKLIST.md)** - Lista de verificaci�n paso a paso
- ?? **Scripts de automatizaci�n:**
  - `setup-azure.ps1` - Configuraci�n autom�tica de Azure
  - `verify-setup.ps1` - Verificaci�n de configuraci�n
  - `docker-build-run.ps1` - Build y ejecuci�n de Docker

## ??? Arquitectura

```
RFFM/
??? Back/ExtractionApi/
?   ??? src/
?   ?   ??? RFFM.Api/              # L�gica de negocio y features
?   ?   ??? RFFM.Host/             # Entry point y configuraci�n
?   ??? docker-compose.yml          # Configuraci�n Docker
?   ??? Dockerfile                  # Imagen .NET 9
?   ??? ...
??? .github/
?   ??? workflows/
?       ??? back-azure-acr-deploy.yml  # CI/CD Pipeline
??? Front/                          # Aplicaci�n React (separado)
```

## ??? Tecnolog�as

- **.NET 9** - Framework principal
- **ASP.NET Core** - Web API
- **Entity Framework Core** - ORM
- **Azure Container Registry** - Registro de im�genes Docker
- **Azure App Service** - Hosting
- **GitHub Actions** - CI/CD
- **SQL Server** - Base de datos
- **Azure Blob Storage** - Almacenamiento de archivos

## ?? Configuraci�n de Seguridad

### Secrets en GitHub

Configurar en: `Repository ? Settings ? Secrets and variables ? Actions`

- `ACR_LOGIN_SERVER` - Login server del Container Registry
- `ACR_USERNAME` - Usuario del Container Registry
- `ACR_PASSWORD` - Contrase�a del Container Registry

### Variables de Entorno en Azure

Configurar en: `App Service ? Configuration ? Application settings`

Ver lista completa en [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)

## ?? CI/CD Pipeline

### Workflow Autom�tico

Cada push a `main` ejecuta:

1. ? Build de .NET 9
2. ? Tests (si existen)
3. ? Build de imagen Docker
4. ? Push a Azure Container Registry
5. ? Deployment autom�tico a Azure Web App

### Monitoreo

- **GitHub Actions**: https://github.com/lhorcajada/RFFM/actions
- **Azure Portal**: App Service ? Deployment Center ? Logs

## ?? Endpoints Principales

### API Base

- **Production**: `https://rffmapi.azurewebsites.net`
- **Swagger**: `https://rffmapi.azurewebsites.net/swagger`
- **Health**: `https://rffmapi.azurewebsites.net/health`

### Features

- `/api/teams` - Gesti�n de equipos
- `/api/players` - Gesti�n de jugadores
- `/api/competitions` - Gesti�n de competiciones
- `/api/calendar` - Calendario de partidos
- `/api/acta` - Actas de partidos

## ?? Testing

```bash
# Ejecutar todos los tests
dotnet test

# Con cobertura
dotnet test --collect:"XPlat Code Coverage"
```

## ?? Comandos �tiles

### Docker Local

```bash
# Build
.\docker-build-run.ps1 build

# Start
.\docker-build-run.ps1 up

# Logs
.\docker-build-run.ps1 logs

# Stop
.\docker-build-run.ps1 down

# Clean
.\docker-build-run.ps1 clean
```

### Azure CLI

```bash
# Ver logs en tiempo real
az webapp log tail --name rffmapi --resource-group rffm-resources

# Reiniciar app
az webapp restart --name rffmapi --resource-group rffm-resources

# Ver im�genes en ACR
az acr repository show-tags --name rffmregistry --repository rffm-api

# Verificar configuraci�n
.\verify-setup.ps1
```

## ?? Troubleshooting

### La API no responde

```bash
# Verificar logs
az webapp log tail --name rffmapi --resource-group rffm-resources

# Reiniciar
az webapp restart --name rffmapi --resource-group rffm-resources
```

### Error en GitHub Actions

1. Verificar secretos en GitHub (typos)
2. Verificar Admin user habilitado en ACR
3. Ver logs detallados en Actions

### Error CORS desde frontend

- Verificar `Cors__AllowedOrigins__0` en App Settings
- Debe ser la URL exacta del frontend

Ver m�s en [GITHUB_ACTIONS_AZURE_GUIDE.md](GITHUB_ACTIONS_AZURE_GUIDE.md#-troubleshooting)

## ?? Estructura de Features

La API usa una arquitectura basada en features (Vertical Slice):

```
src/RFFM.Api/Features/
??? Federation/
?   ??? Teams/
?   ?   ??? Queries/
?   ?   ??? Commands/
?   ?   ??? Models/
?   ?   ??? Services/
?   ??? Players/
?   ??? Competitions/
??? Coaches/
```

## ?? Contribuci�n

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## ?? Licencia

Este proyecto es privado y confidencial.

## ?? Equipo

- **Desarrollador Principal**: Luis Horcajada
- **Organizaci�n**: RFFM (Real Federaci�n de F�tbol de Madrid)

## ?? Enlaces

- [Documentaci�n de Azure](https://docs.microsoft.com/azure/)
- [.NET Documentation](https://docs.microsoft.com/dotnet/)
- [GitHub Actions Documentation](https://docs.github.com/actions)

---

**�ltima actualizaci�n**: Diciembre 2025 - .NET 9 + GitHub Actions CI/CD

## Migrarions Entity Framework

### Add migration

dotnet ef migrations add NombreDeLaMigracion --project src/RFFM.Api --startup-project src/RFFM.Host --context AppDbContext

### Update database

dotnet ef database update --project src/RFFM.Api --startup-project src/RFFM.Host --context AppDbContext
