# ?? Docker Setup - RFFM API

## Prerrequisitos

- Docker Desktop instalado y ejecutándose
- .NET 9 SDK (para desarrollo local sin Docker)

## ?? Inicio Rápido

### 1. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus valores reales
```

### 2. Construir y ejecutar

#### Opción A: Usando el script de PowerShell

```powershell
# Construir imagen
.\docker-build-run.ps1 build

# Iniciar contenedores
.\docker-build-run.ps1 up

# Ver logs
.\docker-build-run.ps1 logs

# Detener
.\docker-build-run.ps1 down
```

#### Opción B: Usando docker-compose directamente

```bash
# Construir
docker-compose build

# Iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f rffm-api

# Detener
docker-compose down
```

## ?? Endpoints Disponibles

- **API**: https://localhost:7287
- **Swagger**: https://localhost:7287/swagger
- **SQL Server**: localhost:1433

## ?? Configuración

### Estructura de archivos Docker

```
.
??? docker-compose.yml              # Configuración base
??? docker-compose.override.yml     # Override para desarrollo
??? .env                            # Variables de entorno (no en Git)
??? .env.example                    # Ejemplo de variables
??? .dockerignore                   # Archivos ignorados en build
??? src/RFFM.Host/Dockerfile        # Dockerfile de la API
```

### Variables de entorno importantes

| Variable | Descripción |
|----------|-------------|
| `JWT_KEY` | Clave secreta para JWT (min 32 caracteres) |
| `FRONTEND_SECRET` | Secret compartido con el frontend |
| `AZURE_BLOB_STORAGE` | Connection string de Azure Blob |
| `SQL_SERVER_PASSWORD` | Contraseña de SQL Server |

## ??? Comandos Útiles

### Ver logs en tiempo real
```bash
docker-compose logs -f
```

### Reconstruir sin cache
```bash
docker-compose build --no-cache
```

### Ver estado de contenedores
```bash
docker-compose ps
```

### Ejecutar comandos dentro del contenedor
```bash
docker-compose exec rffm-api bash
```

### Limpiar todo (volúmenes incluidos)
```bash
docker-compose down -v --rmi all
```

## ?? Troubleshooting

### Error: "Port already in use"
```bash
# Verificar qué proceso usa el puerto
netstat -ano | findstr :7287

# Detener procesos conflictivos o cambiar puertos en docker-compose.override.yml
```

### Error: "Cannot connect to SQL Server"
```bash
# Verificar que el contenedor SQL está running
docker-compose ps

# Ver logs de SQL Server
docker-compose logs sqlserver

# Reiniciar SQL Server
docker-compose restart sqlserver
```

### Error de certificado HTTPS
```bash
# Generar certificado de desarrollo
dotnet dev-certs https -ep $env:USERPROFILE\.aspnet\https\aspnetapp.pfx -p YourPassword
dotnet dev-certs https --trust
```

## ?? Seguridad

?? **IMPORTANTE**: 
- Nunca commitear el archivo `.env` al repositorio
- Usar secretos diferentes para producción
- El archivo `.env.example` solo debe contener ejemplos sin valores reales

## ?? Actualización de .NET Version

El Dockerfile ahora usa **.NET 9.0**:
- Base image: `mcr.microsoft.com/dotnet/aspnet:9.0`
- SDK image: `mcr.microsoft.com/dotnet/sdk:9.0`

## ?? Próximos Pasos

1. Configurar GitHub Actions para CI/CD
2. Añadir healthchecks a los servicios
3. Configurar Docker Secrets para producción
4. Implementar multi-stage builds optimizados
