# Revisión de Código — Guardrails

Lista de verificación obligatoria antes de considerar una implementación completa.
Cada punto describe **lo que debe revisarse** para garantizar la calidad del cambio.

---

## 1. Cumplimiento de Reglas

### ✅ Verificar que el código respeta los patrones del proyecto

Antes de marcar una implementación como completa, comprobar que sigue las reglas de `copilot-instructions.md`, `AGENTS.md` y las rules de OpenSpec (`dotnet.md`, `architecture.md`, `testing.md`, `git.md`).

**Puntos clave:**

- **CQRS**: los commands mutan estado, las queries solo leen. No mezclar.
- **Result\<T\>**: todo handler devuelve `Result` o `Result<T>`. Nunca lanzar excepciones de negocio.
- **Error codes**: toda llamada a `Result.Failure(...)` incluye el código de error (`*ErrorCodes`).
- **SaveChanges**: no llamar `SaveChangesAsync`. El pipeline lo gestiona.
- **FluentValidation**: solo validación de formato y estructura del input. Las reglas de negocio van en el handler.
- **AsNoTracking**: usar en toda consulta cuyos resultados no se van a modificar.
- **Vertical Slices**: cada feature vive en `Features/{FeatureName}/{Action}/`. No lógica suelta fuera de la feature.
- **Controladores mínimos**: recibir request, delegar al mediator, devolver respuesta. Cero lógica de negocio.

**Incorrecto:**
```csharp
// Handler que lanza excepción, sin error code y llama a SaveChangesAsync
public async Task<UserDto> Execute(GetUserQuery request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.Id, ct);
    if (user is null)
        throw new NotFoundException(); // ❌ Excepción como flujo

    await _dbContext.SaveChangesAsync(ct); // ❌ SaveChanges manual
    return user.ToDto(); // ❌ Tipo crudo, no Result<T>
}
```

**Correcto:**
```csharp
public async Task<Result<UserDto>> Execute(GetUserQuery request, CancellationToken ct)
{
    var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.Id, ct);
    return user is null
        ? Result.Failure<UserDto>(UserErrors.NotFound, UserErrorCodes.UserNotFound)
        : Result.Success(user.ToDto());
}
```

---

## 2. Complejidad Innecesaria

### ✅ Verificar que el código es tan simple como el problema requiere

Si un método tiene más de 3 niveles de anidación, múltiples ramas condicionales encadenadas o abstracciones que no se justifican, simplificar antes de entregar.

**Incorrecto:**
```csharp
public async Task<Result> Execute(AssignRoleCommand request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.UserId, ct);
    if (user != null)
    {
        var role = await _dbContext.Roles.FindAsync(request.RoleId, ct);
        if (role != null)
        {
            var existing = await _dbContext.UserRoles
                .FirstOrDefaultAsync(ur => ur.UserId == request.UserId && ur.RoleId == request.RoleId, ct);
            if (existing == null)
            {
                if (user.Status == UserStatus.Active)
                {
                    user.AssignRole(role);
                    return Result.Success();
                }
                else
                {
                    return Result.Failure(UserErrors.UserNotActive, UserErrorCodes.UserNotActive);
                }
            }
            else
            {
                return Result.Failure(UserErrors.RoleAlreadyAssigned, UserErrorCodes.RoleAlreadyAssigned);
            }
        }
        else
        {
            return Result.Failure(RoleErrors.NotFound, RoleErrorCodes.RoleNotFound);
        }
    }
    else
    {
        return Result.Failure(UserErrors.NotFound, UserErrorCodes.UserNotFound);
    }
}
```

**Correcto:**
```csharp
public async Task<Result> Execute(AssignRoleCommand request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.UserId, ct);
    if (user is null)
        return Result.Failure(UserErrors.NotFound, UserErrorCodes.UserNotFound);

    var role = await _dbContext.Roles.FindAsync(request.RoleId, ct);
    if (role is null)
        return Result.Failure(RoleErrors.NotFound, RoleErrorCodes.RoleNotFound);

    var roleAlreadyAssigned = await _dbContext.UserRoles
        .AnyAsync(ur => ur.UserId == request.UserId && ur.RoleId == request.RoleId, ct);
    if (roleAlreadyAssigned)
        return Result.Failure(UserErrors.RoleAlreadyAssigned, UserErrorCodes.RoleAlreadyAssigned);

    var userNotActive = user.Status != UserStatus.Active;
    if (userNotActive)
        return Result.Failure(UserErrors.UserNotActive, UserErrorCodes.UserNotActive);

    user.AssignRole(role);
    return Result.Success();
}
```

**Indicadores de complejidad innecesaria:**

- Más de 3 niveles de anidación → aplicar early return.
- Condición compuesta sin nombre descriptivo → extraer variable con nombre claro.
- Métodos con más de 30 líneas → dividir en pasos con intención.
- Abstracciones con un solo consumidor → evaluar si son necesarias.

---

## 3. Duplicación de Código

### ✅ Verificar que no existe lógica duplicada dentro del cambio ni contra el código existente

Si dos o más fragments comparten la misma estructura y comportamiento, extraer la lógica compartida. La reutilización debe respetar la arquitectura de vertical slices: lógica compartida entre handlers del mismo agregado va en un `FeatureService`.

**Incorrecto:**
```csharp
// CreateExternalUserCommandHandler.cs
var normalizedEmail = request.Email.Trim().ToUpperInvariant();
var existingUser = await _dbContext.Users
    .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);
if (existingUser is not null)
    return Result.Failure<CreateCommandResponse>(UsersResources.EmailAlreadyInUse, UserErrorCodes.EmailAlreadyInUse);

// UpdateExternalUserEmailCommandHandler.cs
var normalizedEmail = request.NewEmail.Trim().ToUpperInvariant();
var existingUser = await _dbContext.Users
    .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, ct);
if (existingUser is not null)
    return Result.Failure<CreateCommandResponse>(UsersResources.EmailAlreadyInUse, UserErrorCodes.EmailAlreadyInUse);
```

**Correcto:**
```csharp
// ExternalUserFeatureService.cs
public async Task<bool> IsEmailAlreadyInUseAsync(string email, CancellationToken ct)
{
    var normalizedEmail = email.Trim().ToUpperInvariant();
    return await _dbContext.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail, ct);
}

// CreateExternalUserCommandHandler.cs
var emailAlreadyInUse = await _featureService.IsEmailAlreadyInUseAsync(request.Email, ct);
if (emailAlreadyInUse)
    return Result.Failure<CreateCommandResponse>(UsersResources.EmailAlreadyInUse, UserErrorCodes.EmailAlreadyInUse);

// UpdateExternalUserEmailCommandHandler.cs
var emailAlreadyInUse = await _featureService.IsEmailAlreadyInUseAsync(request.NewEmail, ct);
if (emailAlreadyInUse)
    return Result.Failure<CreateCommandResponse>(UsersResources.EmailAlreadyInUse, UserErrorCodes.EmailAlreadyInUse);
```

**⚠️ No compartir lógica entre features distintas.** Si dos features de agregados diferentes necesitan la misma verificación, cada una mantiene su propia versión. La duplicación entre límites de agregado es preferible a un acoplamiento indebido.

---

## 4. Manejo de Errores

### ✅ Verificar que todos los caminos de error están cubiertos y son consistentes

Cada escenario de fallo debe retornar un `Result.Failure` con mensaje localizado y código de error. No dejar caminos sin cubrir, no lanzar excepciones de negocio, no devolver errores genéricos.

**Incorrecto:**
```csharp
public async Task<Result> Execute(DeleteSiteCommand request, CancellationToken ct)
{
    var site = await _dbContext.Sites.FindAsync(request.Id, ct);
    _dbContext.Sites.Remove(site!); // ❌ NullReference si no existe
    return Result.Success();
}

public async Task<Result<UserDto>> Execute(GetUserQuery request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.Id, ct);
    return Result.Success(user!.ToDto()); // ❌ NullReference si no existe
}
```

**Correcto:**
```csharp
public async Task<Result> Execute(DeleteSiteCommand request, CancellationToken ct)
{
    var site = await _dbContext.Sites.FindAsync(request.Id, ct);
    if (site is null)
        return Result.Failure(SiteErrors.NotFound, SiteErrorCodes.SiteNotFound);

    _dbContext.Sites.Remove(site);
    return Result.Success();
}

public async Task<Result<UserDto>> Execute(GetUserQuery request, CancellationToken ct)
{
    var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.Id, ct);
    return user is null
        ? Result.Failure<UserDto>(UserErrors.NotFound, UserErrorCodes.UserNotFound)
        : Result.Success(user.ToDto());
}
```

**Puntos a revisar:**

- Todo `FindAsync` / `FirstOrDefaultAsync` debe comprobar null antes de usar el resultado.
- No usar el operador `!` (null-forgiving) para silenciar advertencias sin garantizar la precondición.
- Todo error debe usar `ResultFailureType` apropiado: `NotFound`, `Conflict`, `Unauthorized`, `Forbidden`.
- Los errores de validación → `BadRequest` (por defecto). Recurso no encontrado → `NotFound`. Invariante violado → `Conflict`.
- Si la condición es compuesta, usar variable descriptiva:
  ```csharp
  var userCannotBeDeleted = site.ActiveDoors.Any();
  if (userCannotBeDeleted)
      return Result.Failure(SiteErrors.HasActiveDoors, SiteErrorCodes.HasActiveDoors);
  ```

---

## 5. Posibles Impactos Secundarios

### ✅ Verificar que el cambio no introduce efectos colaterales no deseados

Todo cambio en un handler, entidad o consulta puede afectar a otros consumidores. Revisar explícitamente antes de considerar la implementación completa.

### 5.1 Cambios en entidades y Value Objects

- ¿Se modificó un método de entidad que otros handlers usan? Verificar que los demás handlers siguen funcionando correctamente.
- ¿Se añadió o eliminó una propiedad? Los queries de lectura y los mapeos deben actualizarse.
- ¿Se cambió un `Create()` factoría? Todos los puntos de creación deben adaptarse.

### 5.2 Cambios en la base de datos

- ¿Se añadió una columna o tabla? Verificar que la migración existe y es correcta.
- ¿Se modificó un campo de búsqueda u ordenación? Actualizar `AllowedSearchFields` y `AllowedOrderFields` en la query correspondiente.
- ¿Se cambió un tipo de dato? Las consultas SQL parametrizadas deben reflejar el nuevo tipo.

### 5.3 Cambios en queries y endpoints

- ¿Se añadió o eliminó un campo de la respuesta? Los consumidores (frontend, otros servicios) deben adaptarse.
- ¿Se cambió una ruta REST? Actualizar el frontend y la documentación.
- ¿Se modificó la paginación o los filtros? Los tests de integración deben actualizarse.

### 5.4 Cambios en permisos y autorización

- ¿Se añadió un nuevo endpoint? Definir el permiso correspondiente en `{Feature}Permissions`.
- ¿Se cambió la autorización de un endpoint existente? Verificar que los roles afectados siguen teniendo acceso adecuado.
- ¿Se añadió un permiso nuevo? Registrar la clase de permisos para que el seeder la detecte.

### 5.5 Notificaciones y side effects

- ¿El cambio afecta cuándo se envían notificaciones? Recordar: solo se envían al crear usuarios o asignar roles, no al asignar ubicaciones.
- ¿Se introdujo un `IAfterSaveHook`? Verificar que no se duplica lógica ya existente en otro hook.

---

## 6. Checklist Rápido

Antes de marcar una implementación como completa, verificar cada punto:

| # | Revisión | ✓ |
|---|---|---|
| 1 | ¿El código cumple todas las reglas del proyecto (CQRS, Result, error codes, SaveChanges)? | ☐ |
| 2 | ¿La complejidad es mínima (early return, condiciones con nombre, sin anidación excesiva)? | ☐ |
| 3 | ¿No hay duplicación de código (o está extraída en FeatureService / utilidad compartida)? | ☐ |
| 4 | ¿Todos los caminos de error devuelven `Result.Failure` con mensaje localizado y error code? | ☐ |
| 5 | ¿No hay null-forgiving (`!`) sin garantía de precondición? | ☐ |
| 6 | ¿Los cambios en entidades/VOs no rompen otros handlers? | ☐ |
| 7 | ¿Las migraciones, queries y mapeos están actualizados? | ☐ |
| 8 | ¿Los permisos de los endpoints están definidos y registrados? | ☐ |
| 9 | ¿Las reglas de negocio (notificaciones, validaciones) se respetan? | ☐ |
| 10 | ¿Los tests cubren la lógica nueva y los cambios en la existente? | ☐ |
