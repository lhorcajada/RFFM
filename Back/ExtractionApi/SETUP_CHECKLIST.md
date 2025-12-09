# ? Azure + GitHub Actions - Setup Checklist

## ?? Preparación Inicial

- [ ] Tener cuenta de Azure activa
- [ ] Azure CLI instalado localmente (`az --version`)
- [ ] Docker Desktop instalado y funcionando
- [ ] Permisos de Owner/Contributor en la suscripción de Azure
- [ ] Acceso de Admin al repositorio de GitHub

---

## ?? Configuración de Azure Container Registry

### Paso 1: Habilitar Admin User

**Opción A - Azure Portal:**
- [ ] Ir a Azure Portal ? Container Registry ? `rffmregistry`
- [ ] Click en "Access keys" en el menú lateral
- [ ] Activar toggle "Admin user"
- [ ] Copiar:
  - [ ] Login server
  - [ ] Username
  - [ ] Password (cualquiera de las dos)

**Opción B - Script PowerShell:**
```powershell
.\setup-azure.ps1
```
- [ ] Ejecutar script
- [ ] Copiar las credenciales que muestra al final

**Opción C - Azure CLI:**
```bash
az acr update -n rffmregistry --admin-enabled true
az acr credential show --name rffmregistry
```

---

## ?? Configuración de GitHub Secrets

### Ir a: `https://github.com/lhorcajada/RFFM/settings/secrets/actions`

- [ ] Click en "New repository secret"

### Crear estos 3 secretos:

#### Secret 1: ACR_LOGIN_SERVER
- [ ] Name: `ACR_LOGIN_SERVER`
- [ ] Value: `rffmregistry-beg6cuaaa6ase9fk.azurecr.io`
- [ ] Click "Add secret"

#### Secret 2: ACR_USERNAME
- [ ] Name: `ACR_USERNAME`
- [ ] Value: `rffmregistry`
- [ ] Click "Add secret"

#### Secret 3: ACR_PASSWORD
- [ ] Name: `ACR_PASSWORD`
- [ ] Value: `[Tu password de ACR copiado anteriormente]`
- [ ] Click "Add secret"

### Verificar:
- [ ] Los 3 secretos aparecen en la lista
- [ ] No hay typos en los nombres

---

## ?? Configuración de Azure Web App

### Paso 1: Configurar Container Registry

#### Azure Portal:
- [ ] Ir a: App Service ? `rffmapi` ? Deployment Center
- [ ] Settings:
  - [ ] Registry source: `Azure Container Registry`
  - [ ] Registry: `rffmregistry`
  - [ ] Image: `rffm-api`
  - [ ] Tag: `latest`
- [ ] Habilitar: `Continuous deployment` (webhook)
- [ ] Click "Save"

#### Azure CLI (alternativa):
```bash
az webapp config container set \
  --name rffmapi \
  --resource-group rffm-resources \
  --docker-custom-image-name rffmregistry-beg6cuaaa6ase9fk.azurecr.io/rffm-api:latest \
  --docker-registry-server-url https://rffmregistry-beg6cuaaa6ase9fk.azurecr.io

az webapp deployment container config \
  --name rffmapi \
  --resource-group rffm-resources \
  --enable-cd true
```

### Paso 2: Configurar Variables de Entorno

#### Ir a: App Service ? `rffmapi` ? Configuration ? Application settings

- [ ] Click "New application setting" para cada una:

| Setting Name | Value | Notas |
|-------------|-------|-------|
| `Jwt__Key` | `[Tu clave secreta JWT]` | Min 32 caracteres |
| `Jwt__Issuer` | `FutbolBaseAPI` | - |
| `Jwt__Audience` | `FutbolBaseAPIUsers` | - |
| `Authentication__FrontendSecret` | `[Secret compartido]` | Mismo que en frontend |
| `FrontUrlBase` | `https://rffm.netlify.app` | URL del frontend |
| `Cors__AllowedOrigins__0` | `https://rffm.netlify.app` | - |
| `Cors__AllowedOrigins__1` | `https://localhost:5173` | Para desarrollo |
| `ASPNETCORE_ENVIRONMENT` | `Production` | - |

#### Connection Strings (separado):
- [ ] Click "New connection string"

| Name | Value | Type |
|------|-------|------|
| `CatalogConnection` | `Server=tcp:yourserver.database.windows.net,1433;Database=FutbolBase;User ID=user;Password=pass;Encrypt=True;` | SQL Azure |
| `AzureBlobStorage` | `DefaultEndpointsProtocol=https;AccountName=futbolbase;AccountKey=...;EndpointSuffix=core.windows.net` | Custom |

- [ ] Click "Save" (importante!)
- [ ] Click "Continue" en el diálogo de confirmación

---

## ?? Primer Deployment

### Paso 1: Verificar Workflow
- [ ] Verificar que existe: `.github/workflows/back-azure-acr-deploy.yml`
- [ ] El archivo tiene las rutas correctas del proyecto

### Paso 2: Commit y Push
```bash
git add .
git commit -m "feat: configure GitHub Actions for Azure deployment"
git push origin main
```

### Paso 3: Monitorear Deployment
- [ ] Ir a: `https://github.com/lhorcajada/RFFM/actions`
- [ ] Verificar que el workflow se está ejecutando
- [ ] Esperar a que termine (verde ?)

### Paso 4: Verificar en Azure
- [ ] Ir a: App Service ? `rffmapi` ? Deployment Center ? Logs
- [ ] Verificar que aparece el nuevo deployment
- [ ] Estado debe ser "Success"

---

## ? Verificación Final

### API Funcionando:
- [ ] Acceder a: `https://rffmapi.azurewebsites.net/swagger`
- [ ] Swagger UI se carga correctamente
- [ ] Los endpoints aparecen en la lista

### Health Check:
- [ ] Acceder a: `https://rffmapi.azurewebsites.net/health` (si existe)
- [ ] Responde con status 200 OK

### Logs:
```bash
az webapp log tail --name rffmapi --resource-group rffm-resources
```
- [ ] Los logs muestran la aplicación iniciando correctamente
- [ ] No hay errores críticos

### Test de Login (desde frontend):
- [ ] El frontend puede hacer login correctamente
- [ ] El token JWT se genera correctamente
- [ ] Las peticiones autenticadas funcionan

---

## ?? Workflow de Desarrollo Continuo

Ahora, cada vez que hagas:
```bash
git push origin main
```

Automáticamente:
1. ? GitHub Actions compila el proyecto
2. ? Ejecuta tests (si existen)
3. ? Construye imagen Docker
4. ? Sube imagen a Azure Container Registry
5. ? Azure Web App detecta nueva imagen
6. ? Azure Web App descarga y ejecuta nueva imagen
7. ? API actualizada en producción

---

## ?? Si algo falla...

### Workflow falla en "Build and push Docker image"
- [ ] Verificar secretos en GitHub (typos?)
- [ ] Verificar que Admin user está habilitado en ACR

### Web App no actualiza
- [ ] Verificar Continuous Deployment está ON
- [ ] Manualmente reiniciar: `az webapp restart --name rffmapi --resource-group rffm-resources`

### Error 500 en la API
- [ ] Revisar logs: `az webapp log tail --name rffmapi --resource-group rffm-resources`
- [ ] Verificar variables de entorno en Configuration
- [ ] Verificar connection strings

### CORS errors desde frontend
- [ ] Verificar `Cors__AllowedOrigins__0` en App Settings
- [ ] Debe incluir la URL exacta del frontend (sin trailing slash)

---

## ?? Comandos de Diagnóstico

```bash
# Ver logs en tiempo real
az webapp log tail --name rffmapi --resource-group rffm-resources

# Ver configuración actual
az webapp config show --name rffmapi --resource-group rffm-resources

# Ver variables de entorno
az webapp config appsettings list --name rffmapi --resource-group rffm-resources

# Ver imágenes en ACR
az acr repository show-tags --name rffmregistry --repository rffm-api --output table

# Reiniciar Web App
az webapp restart --name rffmapi --resource-group rffm-resources

# Forzar pull de última imagen
az webapp config container set \
  --name rffmapi \
  --resource-group rffm-resources \
  --docker-custom-image-name rffmregistry-beg6cuaaa6ase9fk.azurecr.io/rffm-api:latest
```

---

## ?? Todo Listo!

Si todos los checkboxes están marcados, tu pipeline de CI/CD está completamente configurado y funcional.

**Siguiente commit a `main` = Deployment automático a producción** ??
