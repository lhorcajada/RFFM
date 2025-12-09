# ?? RFFM - Real Federación de Fútbol de Madrid API

API para la gestión de competiciones, equipos y jugadores de la RFFM.

## ?? Quick Start

### Desarrollo Local

```bash
# Restaurar dependencias
dotnet restore

# Ejecutar la aplicación (migraciones se aplican automáticamente)
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

### Migraciones Automáticas

Las migraciones de Entity Framework Core se aplican **automáticamente** al iniciar la aplicación.

### Gestión Manual de Migraciones

Usa el script de PowerShell incluido:

```powershell
# Crear nueva migración
.\manage-migrations.ps1 -Action create -MigrationName "AddNewTable"

# Aplicar migraciones
.\manage-migrations.ps1 -Action apply

# Listar migraciones
.\manage-migrations.ps1 -Action list

# Generar script SQL
.\manage-migrations.ps1 -Action script

# Eliminar última migración
.\manage-migrations.ps1 -Action remove

# Reset completo de base de datos (PELIGRO)
.\manage-migrations.ps1 -Action reset
```

### Comandos EF Core directos

```bash
# Crear migración
dotnet ef migrations add MigrationName --project src/RFFM.Api --startup-project src/RFFM.Host

# Aplicar migraciones
dotnet ef database update --project src/RFFM.Api --startup-project src/RFFM.Host

# Ver migraciones pendientes
dotnet ef migrations list --project src/RFFM.Api --startup-project src/RFFM.Host
```

## ?? Documentación

### Para Desarrollo
- ?? **[Docker Setup](DOCKER_README.md)** - Guía completa de Docker
- ?? **[Variables de Entorno](.env.example)** - Configuración requerida

### Para Deployment
- ?? **[GitHub Actions + Azure](GITHUB_ACTIONS_AZURE_GUIDE.md)** - Guía completa de CI/CD
- ? **[Setup Checklist](SETUP_CHECKLIST.md)** - Lista de verificación paso a paso
- ?? **Scripts de automatización:**
  - `setup-azure.ps1` - Configuración automática de Azure
  - `verify-setup.ps1` - Verificación de configuración
  - `docker-build-run.ps1` - Build y ejecución de Docker

## ??? Arquitectura

```
RFFM/
??? Back/ExtractionApi/
?   ??? src/
?   ?   ??? RFFM.Api/              # Lógica de negocio y features
?   ?   ??? RFFM.Host/             # Entry point y configuración
?   ??? docker-compose.yml          # Configuración Docker
?   ??? Dockerfile                  # Imagen .NET 9
?   ??? ...
??? .github/
?   ??? workflows/
?       ??? back-azure-acr-deploy.yml  # CI/CD Pipeline
??? Front/                          # Aplicación React (separado)
```

## ??? Tecnologías

- **.NET 9** - Framework principal
- **ASP.NET Core** - Web API
- **Entity Framework Core** - ORM
- **Azure Container Registry** - Registro de imágenes Docker
- **Azure App Service** - Hosting
- **GitHub Actions** - CI/CD
- **SQL Server** - Base de datos
- **Azure Blob Storage** - Almacenamiento de archivos

## ?? Configuración de Seguridad

### Secrets en GitHub
Configurar en: `Repository ? Settings ? Secrets and variables ? Actions`

- `ACR_LOGIN_SERVER` - Login server del Container Registry
- `ACR_USERNAME` - Usuario del Container Registry  
- `ACR_PASSWORD` - Contraseña del Container Registry

### Variables de Entorno en Azure
Configurar en: `App Service ? Configuration ? Application settings`

Ver lista completa en [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)

## ?? CI/CD Pipeline

### Workflow Automático

Cada push a `main` ejecuta:

1. ? Build de .NET 9
2. ? Tests (si existen)
3. ? Build de imagen Docker
4. ? Push a Azure Container Registry
5. ? Deployment automático a Azure Web App

### Monitoreo

- **GitHub Actions**: https://github.com/lhorcajada/RFFM/actions
- **Azure Portal**: App Service ? Deployment Center ? Logs

## ?? Endpoints Principales

### API Base
- **Production**: `https://rffmapi.azurewebsites.net`
- **Swagger**: `https://rffmapi.azurewebsites.net/swagger`
- **Health**: `https://rffmapi.azurewebsites.net/health`

### Features
- `/api/teams` - Gestión de equipos
- `/api/players` - Gestión de jugadores
- `/api/competitions` - Gestión de competiciones
- `/api/calendar` - Calendario de partidos
- `/api/acta` - Actas de partidos

## ?? Testing

```bash
# Ejecutar todos los tests
dotnet test

# Con cobertura
dotnet test --collect:"XPlat Code Coverage"
```

## ?? Comandos Útiles

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

# Ver imágenes en ACR
az acr repository show-tags --name rffmregistry --repository rffm-api

# Verificar configuración
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

Ver más en [GITHUB_ACTIONS_AZURE_GUIDE.md](GITHUB_ACTIONS_AZURE_GUIDE.md#-troubleshooting)

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

## ?? Contribución

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## ?? Licencia

Este proyecto es privado y confidencial.

## ?? Equipo

- **Desarrollador Principal**: Luis Horcajada
- **Organización**: RFFM (Real Federación de Fútbol de Madrid)

## ?? Enlaces

- [Documentación de Azure](https://docs.microsoft.com/azure/)
- [.NET Documentation](https://docs.microsoft.com/dotnet/)
- [GitHub Actions Documentation](https://docs.github.com/actions)

---

**Última actualización**: Diciembre 2025 - .NET 9 + GitHub Actions CI/CD
