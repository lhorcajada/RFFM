# ?? Troubleshooting: Token Validation Error en Producción

## ?? Error Reportado

```
Token inválido o expirado: IDX10517: Signature validation failed. 
The token's kid is missing.
```

## ?? Causa del Problema

Este error ocurre cuando:

1. **Frontend Secret no coincide** entre frontend y backend
2. **El token temporal no tiene el header correcto**
3. **El algoritmo de firma es diferente** entre frontend y backend
4. **La configuración de Azure no tiene el FrontendSecret**

---

## ? **Solución Paso a Paso**

### 1?? **Verificar Configuración en Azure**

#### En Azure Portal:

```
App Service ? rffmapi ? Configuration ? Application settings
```

**Buscar estas configuraciones:**

| Nombre | ¿Existe? | ¿Valor correcto? |
|--------|----------|------------------|
| `Authentication__FrontendSecret` | ? | ? |
| `Jwt__Key` | ? | ? |
| `Jwt__Issuer` | ? | ? |
| `Jwt__Audience` | ? | ? |

#### Azure CLI:

```bash
# Ver todas las configuraciones
az webapp config appsettings list \
  --name rffmapi \
  --resource-group rffm-resources \
  --output table

# Buscar específicamente FrontendSecret
az webapp config appsettings list \
  --name rffmapi \
  --resource-group rffm-resources \
  --query "[?name=='Authentication__FrontendSecret']"
```

#### Si falta, agregarla:

```bash
az webapp config appsettings set \
  --name rffmapi \
  --resource-group rffm-resources \
  --settings Authentication__FrontendSecret="+uKk4p9tQGf6q8F+N3UcN5e3zW0TzKf6bFz4fG+N2vUcN5N6zQGf6q8F3zW0TzKf6bFz4fG+N2vUcN5"
```

?? **IMPORTANTE**: Usa el **mismo valor** que tiene tu frontend.

---

### 2?? **Verificar que Frontend y Backend usen el mismo Secret**

#### En el Frontend:

Busca dónde se genera el token temporal. Debería verse algo así:

```typescript
// Frontend - Generación de token temporal
import jwt from 'jsonwebtoken';

const FRONTEND_SECRET = '+uKk4p9tQGf6q8F+N3UcN5e3zW0TzKf6bFz4fG+N2vUcN5N6zQGf6q8F3zW0TzKf6bFz4fG+N2vUcN5';

const tempToken = jwt.sign(
  { 
    username: user.username,
    password: user.password
  },
  FRONTEND_SECRET,
  { 
    algorithm: 'HS256',  // ?? DEBE ser HS256
    expiresIn: '5m'
  }
);
```

**Verificar**:
- ? `algorithm` debe ser `'HS256'`
- ? `FRONTEND_SECRET` debe coincidir exactamente con `Authentication__FrontendSecret` en Azure
- ? El payload debe tener los claims `username` y `password`

---

### 3?? **Verificar Logs en Azure**

```bash
# Ver logs en tiempo real
az webapp log tail \
  --name rffmapi \
  --resource-group rffm-resources

# Buscar errores específicos
az webapp log tail \
  --name rffmapi \
  --resource-group rffm-resources \
  | grep "Token"
```

**Logs que deberías ver**:

? **Si está funcionando**:
```
Validating temporary token...
Temporary token validated successfully
Token validated for user: username
JWT token generated successfully for user: username
```

? **Si hay error**:
```
Token signature key not found. Check that FrontendSecret matches
Invalid token signature. FrontendSecret mismatch
Security token validation failed: IDX10517
```

---

### 4?? **Test de Token Localmente**

Crea un script para probar la validación del token:

```powershell
# test-token.ps1
$frontendSecret = "+uKk4p9tQGf6q8F+N3UcN5e3zW0TzKf6bFz4fG+N2vUcN5N6zQGf6q8F3zW0TzKf6bFz4fG+N2vUcN5"

# Generar token temporal (usando jwt.io o similar)
$tempToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Probar login
$body = @{
    tempToken = $tempToken
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "https://rffmapi.azurewebsites.net/api/login" `
    -Method Post `
    -Body $body `
    -ContentType "application/json" `
    -ErrorAction Stop

Write-Host "? Token generado correctamente" -ForegroundColor Green
Write-Host $response
```

---

### 5?? **Verificar Claims en el Token**

Usa [jwt.io](https://jwt.io) para decodificar el token temporal que envía el frontend:

**Header esperado**:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload esperado**:
```json
{
  "username": "usuario",
  "password": "contraseña_en_texto_plano",
  "iat": 1234567890,
  "exp": 1234567890
}
```

?? **Verifica que**:
- `alg` sea `HS256` (no RS256, no HS512)
- Los claims `username` y `password` existan
- No haya claims adicionales que puedan causar conflicto

---

### 6?? **Reiniciar App Service**

Después de cambiar configuraciones:

```bash
# Reiniciar para aplicar cambios
az webapp restart \
  --name rffmapi \
  --resource-group rffm-resources

# Verificar que está running
az webapp show \
  --name rffmapi \
  --resource-group rffm-resources \
  --query state
```

---

## ?? **Soluciones Comunes**

### Problema 1: FrontendSecret no configurado en Azure

**Síntoma**: Error `The token's kid is missing`

**Solución**:
```bash
az webapp config appsettings set \
  --name rffmapi \
  --resource-group rffm-resources \
  --settings Authentication__FrontendSecret="[VALOR_DEL_FRONTEND]"
```

### Problema 2: FrontendSecret diferente entre Frontend y Backend

**Síntoma**: `Invalid token signature`

**Solución**:
1. Verificar valor en frontend (archivo de configuración o variable de entorno)
2. Actualizar en Azure con el mismo valor exacto
3. Reiniciar App Service

### Problema 3: Algoritmo diferente

**Síntoma**: `Signature validation failed`

**Solución**:
- Frontend debe usar `algorithm: 'HS256'`
- Backend ya está configurado para `HmacSha256`

### Problema 4: Token expirado muy rápido

**Síntoma**: A veces funciona, a veces no

**Solución**:
```typescript
// Frontend - Aumentar expiresIn
const tempToken = jwt.sign(payload, SECRET, { 
  algorithm: 'HS256',
  expiresIn: '10m'  // Aumentar a 10 minutos
});
```

---

## ?? **Checklist de Verificación**

Antes de hacer un push a producción, verificar:

- [ ] `Authentication__FrontendSecret` existe en Azure App Service
- [ ] El valor coincide exactamente con el del frontend (sin espacios extra)
- [ ] Frontend usa algoritmo `HS256`
- [ ] El token temporal incluye claims `username` y `password`
- [ ] Los logs de Azure no muestran errores de configuración
- [ ] Se reinició el App Service después de cambiar configuraciones

---

## ?? **Debug Avanzado**

### Ver configuración actual en producción:

```bash
# Ejecutar comando en el container
az webapp ssh --name rffmapi --resource-group rffm-resources

# Dentro del container
printenv | grep Authentication
printenv | grep Jwt
```

### Probar endpoint directamente:

```bash
# Generar token de prueba en jwt.io con:
# Header: {"alg":"HS256","typ":"JWT"}
# Payload: {"username":"testuser","password":"testpass"}
# Secret: [TU_FRONTEND_SECRET]

curl -X POST https://rffmapi.azurewebsites.net/api/login \
  -H "Content-Type: application/json" \
  -d '{"tempToken":"eyJhbGc..."}'
```

### Habilitar PII (Personally Identifiable Information) logging temporalmente:

```csharp
// Solo para debugging - NUNCA en producción permanente
Microsoft.IdentityModel.Logging.IdentityModelEventSource.ShowPII = true;
```

Esto mostrará el token completo en los logs para debug.

---

## ?? **Si nada funciona**

1. **Capturar el token que envía el frontend**:
   ```javascript
   console.log('Temp token:', tempToken);
   ```

2. **Decodificar en jwt.io** para ver header y payload

3. **Comparar con lo que espera el backend**

4. **Revisar logs completos de Azure**:
   ```bash
   az webapp log download \
     --name rffmapi \
     --resource-group rffm-resources \
     --log-file logs.zip
   ```

5. **Contactar con el equipo de frontend** para verificar cómo se genera el token

---

## ? **Configuración Correcta Final**

### Azure App Service - Application Settings:

```
Authentication__FrontendSecret = +uKk4p9tQGf6q8F+N3UcN5e3zW0TzKf6bFz4fG+N2vUcN5N6zQGf6q8F3zW0TzKf6bFz4fG+N2vUcN5
Jwt__Key = LZzwG7e9ZrrWOGt+frAb9ZRUQSFfaRW2VQIgA6GPjHI=
Jwt__Issuer = FutbolBaseAPI
Jwt__Audience = FutbolBaseAPIUsers
```

### Frontend Configuration:

```typescript
const FRONTEND_SECRET = '+uKk4p9tQGf6q8F+N3UcN5e3zW0TzKf6bFz4fG+N2vUcN5N6zQGf6q8F3zW0TzKf6bFz4fG+N2vUcN5';

const tempToken = jwt.sign(
  { username, password },
  FRONTEND_SECRET,
  { algorithm: 'HS256', expiresIn: '5m' }
);
```

### Request Example:

```http
POST /api/login
Content-Type: application/json

{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3QiLCJwYXNzd29yZCI6InRlc3QxMjMiLCJpYXQiOjE2MzQ1Njc4OTAsImV4cCI6MTYzNDU2ODE5MH0.xyz..."
}
```

### Expected Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

---

**Última actualización**: Diciembre 2025  
**Versión**: .NET 9 + Azure App Service
