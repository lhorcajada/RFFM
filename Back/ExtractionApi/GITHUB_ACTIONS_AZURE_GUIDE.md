# ?? GitHub Actions + Azure Deployment Guide

## ?? Configuración de Secretos en GitHub

### 1. Acceder a los Secretos del Repositorio

1. Ve a tu repositorio en GitHub: `https://github.com/lhorcajada/RFFM`
2. Click en `Settings` ? `Secrets and variables` ? `Actions`
3. Click en `New repository secret`

### 2. Secretos Requeridos

#### **ACR_LOGIN_SERVER**
```
Valor: rffmregistry-beg6cuaaa6ase9fk.azurecr.io
```
**Cómo obtenerlo:**
- Azure Portal ? Container Registry ? `rffmregistry` ? Overview
- Copiar el valor de "Login server"

#### **ACR_USERNAME**
```
Valor: rffmregistry
```
**Cómo obtenerlo:**
- Azure Portal ? Container Registry ? `rffmregistry` ? Access keys
- ?? **Primero:** Activar "Admin user" (toggle switch)
- Copiar el valor de "Username"

#### **ACR_PASSWORD**
```
Valor: [Tu contraseña de ACR]
```
**Cómo obtenerlo:**
- Azure Portal ? Container Registry ? `rffmregistry` ? Access keys
- Copiar el valor de "Password" (hay 2 contraseñas, usa cualquiera)

---

## ?? Configuración en Azure Portal

### 1. Habilitar Admin User en Azure Container Registry

```bash
# Opción A: Azure Portal
Azure Portal ? Container Registry ? rffmregistry ? Access keys
? Enable "Admin user"

# Opción B: Azure CLI
az acr update -n rffmregistry --admin-enabled true
```

### 2. Configurar Azure Web App para Container

#### Desde Azure Portal:

1. **Navegación:**
   ```
   Azure Portal ? App Services ? [Tu Web App] ? Deployment Center
   ```

2. **Configuración:**
   - **Registry source:** Azure Container Registry
   - **Registry:** `rffmregistry`
   - **Image:** `rffm-api`
   - **Tag:** `latest`
   - **Continuous deployment:** `On` (habilitar webhook)

3. **Guardar configuración**

#### Desde Azure CLI:

```bash
# Login
az login

# Configurar Web App para usar ACR
az webapp config container set \
  --name <your-webapp-name> \
  --resource-group <your-resource-group> \
  --docker-custom-image-name rffmregistry-beg6cuaaa6ase9fk.azurecr.io/rffm-api:latest \
  --docker-registry-server-url https://rffmregistry-beg6cuaaa6ase9fk.azurecr.io \
  --docker-registry-server-user rffmregistry \
  --docker-registry-server-password <acr-password>

# Habilitar Continuous Deployment
az webapp deployment container config \
  --name <your-webapp-name> \
  --resource-group <your-resource-group> \
  --enable-cd true
```

### 3. Configurar Variables de Entorno en Azure Web App

```
Azure Portal ? App Services ? [Tu Web App] ? Configuration ? Application settings
```

Añadir las siguientes configuraciones:

| Nombre | Valor | Tipo |
|--------|-------|------|
| `Jwt__Key` | `[Tu clave JWT secreta]` | Application Setting |
| `Jwt__Issuer` | `FutbolBaseAPI` | Application Setting |
| `Jwt__Audience` | `FutbolBaseAPIUsers` | Application Setting |
| `Authentication__FrontendSecret` | `[Tu secret del frontend]` | Application Setting |
| `ConnectionStrings__CatalogConnection` | `[Tu connection string SQL]` | Connection String (SQL Azure) |
| `ConnectionStrings__AzureBlobStorage` | `[Tu connection string Blob]` | Connection String (Custom) |
| `FrontUrlBase` | `https://rffm.netlify.app` | Application Setting |
| `Cors__AllowedOrigins__0` | `https://rffm.netlify.app` | Application Setting |
| `Cors__AllowedOrigins__1` | `https://localhost:5173` | Application Setting |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Application Setting |

**?? Importante:** Haz click en **"Save"** después de añadir todas las configuraciones.

---

## ?? Proceso de Deployment Automático

### Flujo de Trabajo

1. **Desarrollador hace push a `main`**
   ```bash
   git push origin main
   ```

2. **GitHub Actions ejecuta:**
   - ? Build de .NET 9
   - ? Restaura dependencias
   - ? Compila el proyecto
   - ? Ejecuta tests (si existen)
   - ? Build de Docker image
   - ? Push a Azure Container Registry con tags:
     - `latest`
     - `main-abc1234` (branch-sha)
     - `abc1234` (commit sha)

3. **Azure Web App detecta nuevo image:**
   - Webhook automáticamente pull la nueva imagen
   - Reinicia el container con la nueva versión
   - Health check verifica que todo funciona

4. **API actualizada disponible** ??

### Monitoreo del Deployment

#### En GitHub:
```
Repositorio ? Actions ? Seleccionar workflow run ? Ver logs
```

#### En Azure:
```
Azure Portal ? App Service ? [Tu Web App] ? Deployment Center ? Logs
```

---

## ?? Troubleshooting

### Error: "Authentication failed" en ACR

**Solución:**
1. Verificar que "Admin user" está habilitado en ACR
2. Verificar que los secretos en GitHub son correctos
3. Regenerar contraseña en Azure y actualizar en GitHub:
   ```
   Azure Portal ? Container Registry ? Access keys ? Regenerate password
   ```

### Error: "Image pull failed" en Web App

**Solución:**
1. Verificar que la imagen existe en ACR:
   ```bash
   az acr repository show-tags \
     --name rffmregistry \
     --repository rffm-api \
     --output table
   ```

2. Verificar credenciales en Web App:
   ```bash
   az webapp config container show \
     --name <your-webapp-name> \
     --resource-group <your-resource-group>
   ```

### Error: "Connection string" no funciona

**Solución:**
1. Verificar formato en Configuration:
   - Debe estar en la sección "Connection strings"
   - Tipo debe ser correcto (SQL Azure / Custom)
   
2. Verificar que el formato es correcto:
   ```
   Server=tcp:yourserver.database.windows.net,1433;Database=yourdb;User ID=yourusername;Password=yourpassword;Encrypt=True;TrustServerCertificate=False;
   ```

### Web App no actualiza después del push

**Solución:**
1. Verificar que Continuous Deployment está habilitado
2. Manualmente reiniciar Web App:
   ```bash
   az webapp restart \
     --name <your-webapp-name> \
     --resource-group <your-resource-group>
   ```

3. Forzar pull de nueva imagen:
   ```bash
   az webapp config container set \
     --name <your-webapp-name> \
     --resource-group <your-resource-group> \
     --docker-custom-image-name rffmregistry-beg6cuaaa6ase9fk.azurecr.io/rffm-api:latest
   ```

---

## ?? Monitoreo y Logs

### Ver logs de la aplicación:

```bash
# Stream de logs en vivo
az webapp log tail \
  --name <your-webapp-name> \
  --resource-group <your-resource-group>

# Descargar logs
az webapp log download \
  --name <your-webapp-name> \
  --resource-group <your-resource-group> \
  --log-file logs.zip
```

### En Azure Portal:

```
App Service ? [Tu Web App] ? Monitoring ? Log stream
```

---

## ? Checklist de Configuración

- [ ] Admin user habilitado en Azure Container Registry
- [ ] Secretos configurados en GitHub (ACR_LOGIN_SERVER, ACR_USERNAME, ACR_PASSWORD)
- [ ] Web App configurado para usar ACR
- [ ] Continuous Deployment habilitado en Web App
- [ ] Variables de entorno configuradas en Web App
- [ ] Primer push a main ejecutado exitosamente
- [ ] Verificar que la API responde correctamente
- [ ] Swagger disponible en `https://your-webapp.azurewebsites.net/swagger`

---

## ?? Seguridad - Mejores Prácticas

1. **Nunca commitear secretos en el código**
   - Usar GitHub Secrets para CI/CD
   - Usar Azure Key Vault para producción

2. **Rotar credenciales regularmente**
   - Cambiar ACR password cada 3-6 meses
   - Actualizar secretos en GitHub después de rotar

3. **Usar Managed Identity cuando sea posible**
   ```bash
   # Habilitar Managed Identity en Web App
   az webapp identity assign \
     --name <your-webapp-name> \
     --resource-group <your-resource-group>
   
   # Dar permisos al ACR
   az role assignment create \
     --assignee <managed-identity-principal-id> \
     --role AcrPull \
     --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.ContainerRegistry/registries/rffmregistry
   ```

---

## ?? Recursos Adicionales

- [Azure Container Registry Documentation](https://docs.microsoft.com/azure/container-registry/)
- [GitHub Actions for Azure](https://github.com/Azure/actions)
- [App Service Documentation](https://docs.microsoft.com/azure/app-service/)
