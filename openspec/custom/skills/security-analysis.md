# Security Analysis Skill

Aplicar cuando la feature afecta: autenticación, autorización, datos personales, permisos o tokens.

---

## Propósito

Guiar la revisión de seguridad en cada cambio que involucre mecanismos de autenticación, autorización, manejo de datos personales, permisos o tokens, asegurando que no se introduzcan vulnerabilidades y que se respeten los controles existentes del proyecto.

Usar este skill cuando:

- Se crea o modifica un endpoint que requiere autenticación o autorización.
- Se cambia la lógica de permisos o roles (`[Authorize]`, `PermissionRequirement`, `RequesterAuthorization`).
- Se manejan datos personales (email, nombre, teléfono) en requests, responses o migraciones.
- Se generan, validan o consumen tokens (JWT, Step-Up).
- Se implementa o modifica validación de entrada en handlers o validators.
- Se añaden endpoints nuevos que exponen datos de usuarios.
- Se cambia la configuración de autenticación o autorización en `Program.cs` o extensiones.
- Se trabaja con OTP, activación de usuarios, o cambios de credenciales.

---

## Antes del Cambio

Analizar antes de tocar cualquier archivo:

### 1. Superficie de autenticación

- Identificar si el endpoint está protegido con `[Authorize]` y con qué permiso.
- Verificar si la operación requiere Step-Up authentication (`[Authorize(Permissions.StepUpAuth)]`).
- Revisar si se usa `ICurrentExternalUserService` para obtener el usuario autenticado.
- Confirmar que el handler no acepta identificadores de usuario desde el request cuando debe usar el claim del token.

### 2. Control de acceso

- Verificar si la operación requiere `IUserManagementPreCheck.AuthorizeRequesterAsync()` para validar que el solicitante tiene permisos sobre el sitio y el rol adecuado.
- Revisar si `RequesterAuthorization.CanGrantRole()` aplica cuando se asignan roles.
- Confirmar que los roles temporales no pueden realizar operaciones administrativas (reglas en `UserManagementPreCheck`).
- Verificar que las validaciones de permisos usan `ResultFailureType.Forbidden` (403) cuando corresponde, no `BadRequest` (400).

### 3. Exposición de información

- Los responses nunca deben incluir `PasswordHash`, `SecurityStamp`, ni datos internos de la identidad.
- Verificar que los DTOs de respuesta exponen solo los campos necesarios; no replicar la entidad de dominio.
- Los emails y datos personales en migraciones deben manejarse con cuidado (columnas nullable primero, migración de datos protegida).
- Verificar que los logs no registran datos sensibles (contraseñas, tokens, datos personales).

### 4. Validación de entrada

- Todo input del usuario pasa por FluentValidation en `{Feature}Validator.cs`.
- Los campos de búsqueda y ordenación deben validarse contra una lista de campos permitidos.
- Los identificadores recibidos por ruta deben validarse como GUIDs válidos.
- Los tipos fuertes del dominio no deben construirse sin validación; usar factorías `Create()`.

### 5. Gestión de tokens

- Los Step-Up tokens tienen expiración corta (`StepUpTokenExpirationInSeconds`).
- Las claims del token se leen con `StepUpClaimNames` (`ReadSub`, `ReadTokenUse`, `ReadAcr`, `ReadAuthorizationDetails`), nunca con nombres arbitrarios.
- La validación de Step-Up usa `IStepUpAuthorizationValidator.Validate()` con el `authorizationDetailType` correcto.
- Si se añade un nuevo tipo de autorización Step-Up, registrar el `authorizationDetailType` correspondiente.

### 6. Manejo de secretos

- Nunca hardcodear secretos, claves o connection strings en el código.
- Usar `appsettings.json` con User Secrets en desarrollo y variables de entorno/configuración segura en producción.
- Las opciones JWT (`JwtOptions`) se configuran mediante el sistema de configuración de .NET, no en código.
- Los endpoints de activación y OTP no deben exponer información sobre si un usuario existe o no (evitar enumeración).

---

## Durante el Cambio

### 1. Estructura de autorización por capa

```
Controller/Endpoint  →  [Authorize(Permission)]
Handler              →  IStepUpAuthorizationValidator.Validate() + IUserManagementPreCheck.AuthorizeRequesterAsync()
Domain               →  Factorías Create() con validación + Value Objects
Validator            →  FluentValidation (formato, rangos, campos permitidos)
```

- El controller/endpoint define **qué** permiso se requiere.
- El handler valida **quién** es el solicitante y **si** tiene permisos específicos sobre el recurso.
- El dominio valida **consistencia** de los datos.
- El validator valida **formato** de la entrada.

### 2. Result.Failure con error codes

Siempre incluir el código de error correspondiente al devolver `Result.Failure`:

```csharp
// Bien: con error code
return Result.Failure(UsersResources.NotPermissions, UserErrorCodes.NotPermissions, ResultFailureType.Forbidden);

// Bien: con error code para errores de negocio
return Result.Failure<RequesterContext>(UsersResources.UserRequestingNotFound, UserErrorCodes.UserRequestingNotFound);

// Mal: sin error code
return Result.Failure("Not authorized");
```

Los error codes se definen en `src/services/shared/CVL.SmartLocks.Shared/Errors/`:
- `UserErrorCodes` para errores de usuarios.
- `SiteErrorCodes` para errores de sitios.
- `StepUpErrorCodes` para errores de Step-Up.
- `NotificationErrorCodes` para errores de notificaciones.

Si el error no tiene código existente, crear uno nuevo en la clase correspondiente.

### 3. Patrón de revisión de autorización en handler

```csharp
public async Task<Result> Execute(MyCommand request, CancellationToken cancellationToken)
{
    // 1. Obtener solicitante autenticado
    var requesterIdResult = await currentExternalUserService.GetExternalUserIdAsync(cancellationToken);
    if (requesterIdResult.IsFailure)
        return Result.Failure(requesterIdResult.Reason);

    // 2. Validar autorización del solicitante sobre el recurso
    var authorization = await userManagementPreCheck.AuthorizeRequesterAsync(request.SiteId, cancellationToken);
    if (authorization.IsDenied)
        return authorization.ToResult();

    // 3. Validar Step-Up si la operación lo requiere
    var stepUpResult = stepUpValidator.Validate(AuthorizationDetailTypes.MyAction, request.SiteId);
    if (stepUpResult is not null && stepUpResult.IsFailure)
        return stepUpResult;

    // 4. Lógica de negocio
    ...
}
```

### 4. Prevención de enumeración de usuarios

- Los endpoints públicos (login, activación, OTP) no deben revelar si un email existe.
- Usar mensajes genéricos: "Si el usuario existe, se enviará un email" en lugar de "Usuario no encontrado".
- Los tiempos de respuesta no deben diferir según si el usuario existe o no.

---

## Después del Cambio

### Verificar autorización

- Todo endpoint que modifica datos tiene `[Authorize]` con el permiso correcto.
- Las operaciones sensibles requieren Step-Up authentication.
- Los handlers validan que el solicitante tiene permisos sobre el sitio y rol adecuados.
- No hay endpoints que expongan datos sin autenticación cuando no deberían.

### Verificar exposición de datos

- Los responses no incluyen datos sensibles (`PasswordHash`, `SecurityStamp`, tokens internos).
- Los DTOs solo contienen los campos estrictamente necesarios.
- No hay logs que registren datos personales o secretos.

### Verificar validación

- Los validators rechazan entradas mal formadas.
- Los campos de búsqueda y ordenación están restringidos a los permitidos.
- Los GUIDs de ruta se validan antes de usarlos en consultas.

### Verificar error codes

- Todos los `Result.Failure` incluyen el error code correspondiente.
- Los errores de autorización usan `ResultFailureType.Forbidden`.
- Los nuevos errores tienen código en la clase `*ErrorCodes` correspondiente.

### Verificar compilación

```
dotnet build src/services/mcp/CVL.SmartLocks.MCP.Api/
```

### Verificar pruebas

- Probar que usuarios sin permisos reciben 403.
- Probar que usuarios sin autenticación reciben 401.
- Probar que operaciones Step-Up fallan sin token Step-Up válido.
- Probar que datos sensibles no aparecen en responses.

---

## Evitar

### ❌ Confiar en el cliente para autorización

```csharp
// Mal: el userId viene del request, cualquiera puede pasar otro ID
var user = await dbContext.ExternalUsers.FindAsync(request.UserId);

// Bien: el userId se obtiene del claim del token
var requesterId = await currentExternalUserService.GetExternalUserIdAsync(cancellationToken);
var user = await dbContext.ExternalUsers.FindAsync(requesterId.Value);
```

### ❌ Exponer datos sensibles en responses

```csharp
// Mal: DTO que replica la entidad
public record UserResponse(Guid Id, string Email, string PasswordHash, string SecurityStamp);

// Bien: DTO con solo lo necesario
public record UserResponse(Guid Id, string Email);
```

### ❌ Validación incompleta de permisos

```csharp
// Mal: solo verifica autenticación, no autorización
[Authorize]
public Task<Result> DeleteUser(Guid userId) => ...

// Bien: verifica permiso específico
[Authorize(UsersPermissions.Delete)]
public Task<Result> DeleteUser(Guid userId) => ...
```

### ❌ Mensajes de error que revelan información

```csharp
// Mal: revela que el usuario existe
return Result.Failure("The password for user@example.com is incorrect");

// Bien: mensaje genérico
return Result.Failure(AuthResources.InvalidCredentials, AuthErrorCodes.InvalidCredentials);
```

### ❌ Step-Up sin validación de detalle

```csharp
// Mal: valida Step-Up sin verificar el tipo específico de autorización
var isStepUp = principal.FindFirst(StepUpClaimNames.ReadTokenUse)?.Value == "step_up";

// Bien: usa el validador centralizado con el tipo correcto
var stepUpResult = stepUpValidator.Validate(AuthorizationDetailTypes.ChangeEmail, siteId, userId);
```

---

## Patrones Comunes

### Endpoint con autorización y Step-Up

```csharp
[Authorize(UsersPermissions.StepUpAuth)]
[HttpPut("api/users/{userId}/email")]
public Task<IResult> ChangeEmail(Guid userId, ChangeEmailCommand command) =>
    mediator.Execute(command with { UserId = userId });
```

### Validación de solicitante en handler

```csharp
var authorization = await userManagementPreCheck.AuthorizeRequesterAsync(request.SiteId, cancellationToken);
if (authorization.IsDenied)
    return authorization.ToResult();

var context = authorization.GetContextOrThrow();
```

### Nuevo error code

```csharp
// En src/services/shared/CVL.SmartLocks.Shared/Errors/UserErrorCodes.cs
public const string UserCannotChangeOwnRole = "UserCannotChangeOwnRole";
```

---

## Checklist Rápido

- [ ] Todo endpoint modificado tiene `[Authorize]` con el permiso correcto.
- [ ] Las operaciones sensibles requieren Step-Up authentication.
- [ ] Los handlers validan autorización del solicitante sobre el recurso.
- [ ] Los identificadores de usuario se obtienen del token, no del request.
- [ ] Los responses no exponen datos sensibles.
- [ ] Los logs no registran datos personales ni secretos.
- [ ] Todos los `Result.Failure` incluyen error code.
- [ ] Los errores de autorización usan `ResultFailureType.Forbidden`.
- [ ] La validación de entrada rechaza campos no permitidos.
- [ ] No hay mensajes de error que revelen información interna.
