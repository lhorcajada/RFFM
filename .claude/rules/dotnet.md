# Reglas .NET — CVL.SmartLocks API

Reglas obligatorias para toda generación y modificación de código backend.
Respaldadas por los patrones y convenciones existentes del proyecto.

---

## 1. Arquitectura

### 1.1 Vertical Slices
- Cada feature vive en `Features/{FeatureName}/{Action}/`.
- Una carpeta contiene solo los artefactos de ese caso de uso: `Command`/`Query`, `Handler`, `Validator`, `Resources`.
- Lógica compartida entre slices del mismo agregado → `FeatureService` en la raíz de la feature.
- No compartas lógica entre slices a través de archivos sueltos fuera de la feature.

### 1.2 CQRS estricto
- **Comandos** (`*Command`): mutan estado, devuelven `Result` o `Result<CreateCommandResponse>`.
- **Queries** (`*Query`): solo lectura, devuelven `Result<T>`.
- Nunca mezcles lectura y escritura en un mismo handler.

### 1.3 Estructura de proyecto
```
src/services/mcp/CVL.SmartLocks.MCP/          → API (features, controllers, extensions)
src/services/infrastructure/CVL.SmartLocks.Infrastructure.Data.SqlServer/  → DbContext, migrations, queries, pipeline behaviors
src/services/shared/CVL.SmartLocks.Domain/     → Entidades, Value Objects, enums de dominio
src/services/shared/CVL.SmartLocks.Shared/      → Controller base, permisos, error codes, helpers, MVC extensions
src/libraries/Dorlet.Core/                      → Result, Mediator abstracciones, queries
src/libraries/Dorlet.Domain.Core/               → Entity base, AuditableEntity, TenantEntity, DomainOutcome
src/libraries/FluentValidations/Dorlet.FluentValidation/ → Validator<T> base
```

---

## 2. Controladores

### 2.1 Mínimos
- Heredan de `ApiControllerBase` (decorado con `[Authorize]` + `[ApiController]` + `Route("api/[controller]")`).
- Solo reciben la petición, la delegan al mediator y transforman el `Result` con `ToHttpResult()`.
- Cero lógica de negocio en controladores.

### 2.2 Un controlador por agregado
- `UsersController`, `SitesController`, `DoorsController`, etc.
- No un controlador por caso de uso.

### 2.3 Permisos
- Cada acción debe tener `[Authorize({Feature}Permissions.{Operation})]`.
- Si el endpoint debe ser público → `[AllowAnonymous]` explícito + `[EnableRateLimiting("ActivationPublicFlow")]`.
- Operaciones sensibles → `[Authorize({Feature}Permissions.StepUpAuth)]`.

### 2.4 Respuestas HTTP
- Usar `ProducesResponseType` para documentar los códigos de estado.
- `200 OK` para queries y updates con respuesta.
- `204 NoContent` para comandos sin respuesta de datos.
- `400 BadRequest` con `ValidationProblemDetails` para errores de validación.

### 2.5 Propagación de `CancellationToken`
- Todos los controladores deben aceptar `CancellationToken` en sus acciones y pasarlo al mediator.



---

## 3. Handlers

### 3.1 Firma
- Implementan `IFeatureCommandHandler<TCommand, TResponse>` o `IFeatureQueryHandler<TQuery, TResponse>`.
- Siempre devuelven `Result` o `Result<T>`. **Nunca** lanzar excepciones de negocio.
- Prefieren constructores primarios para inyectar dependencias.

### 3.2 Flujo canónico de un command handler
1. Validar precondiciones → `Result.Failure` si no se cumplen.
2. Ejecutar lógica de dominio sobre la entidad.
3. Persistir cambios (`dbContext.Entity.Add(...)` o modificación directa).
4. Retornar `Result.Success(...)` o propagar el fallo del dominio.

### 3.3 Early return
- Verifica condiciones de error y retorna inmediatamente.
- Evita bloques `if/else` anidados.
- Descriptores variables booleanas para condiciones compuestas:
  ```csharp
  var userAlreadyExists = existingUser is not null;
  if (userAlreadyExists)
      return Result.Failure<TResponse>(UsersResources.EmailAlreadyInUse, UserErrorCodes.EmailAlreadyInUse);
  ```

### 3.4 Persistencia
- **No llamar** `SaveChangesAsync()`. El `SaveDatabaseChangesPipelineBehavior` lo gestiona automáticamente.
- Usar `AsNoTracking()` en toda consulta cuyos resultados no se vayan a modificar.
- Usar `Include()` solo cuando sea estrictamente necesario.

### 3.5 Handlers de Query
- Solo lectura. Usar la interfaz de query del proyecto de Infrastructure (`ISearchUsersQuery`, etc.).
- No modificar estado de la base de datos.

---

## 4. Validación

### 4.1 FluentValidation con `Validator<T>`
- Toda validación de entrada (formato, rangos, obligatoriedad) va en un validator que herede de `Validator<T>`.
- El validator se anida dentro del archivo del Command/Query (misma carpeta del slice).
- Usar mensajes localizados desde los archivos `*Resources` (`.resx`).
- Asignar `ErrorCode` con la constante correspondiente de `*ErrorCodes`:
  ```csharp
  RuleFor(x => x.Name)
      .NotEmpty(UsersResources.User_Name_Required)
      .MaxLength(SmartLockUser.Rules.Name.MaxLength, UsersResources.User_Name_InvalidMaxLength)
      .ErrorCode(UserErrorCodes.UserNameInvalid);
  ```

### 4.2 Validación de entrada vs. reglas de dominio
- **Validación de entrada**: formato, longitud, obligatoriedad → FluentValidation (`Validator<T>`).
- **Reglas de dominio**: invariantes de negocio → dentro de la entidad / Value Object / `Create()`.
- No dupliques la misma regla en ambos sitios.

### 4.3 Validaciones con acceso a base de datos
- Hacerlas en `FeatureService` o directamente en el handler, **no** en el validator.
- Si la validación se usa en varios handlers → encapsular en `FeatureService`.

---

## 5. Dominio

### 5.1 Entidades
- Constructor privado o sin parámetros + factoría `Create()` estática.
- `Create()` valida todas las reglas y devuelve `DomainCreateOutcome<T>`.
- Modificaciones a través de métodos con intención (`UpdateEmail`, `Cancel`, `Lock`), nunca seteando propiedades directamente.
- Propiedades de navegación de colección → `IReadOnlyCollection<T>` expuestas desde `private readonly List<T>`.

### 5.2 Jerarquía de entidades base
- `EntityBase` → `IEntityBase<Guid>` con `Id = Guid.CreateVersion7()`.
- `TenantEntity : EntityBase` → añade `Tenant`.
- `AuditableEntity : TenantEntity` → añade `CreatedOn`, `CreatedBy`, `UpdatedOn`, `UpdatedBy`.
- `LogicDeletableEntity` → borrado lógico.
- Heredar del nivel apropiado según las necesidades de la entidad.

### 5.3 Value Objects
- Inmutables. Constructor privado + `Create()` estático.
- Validación encapsulada dentro del VO (`Email`, `ValidityWindow`, `Duration`).
- Comparación por valor, no por referencia.
- Heredar de `ValueObject` cuando se necesite igualdad por valor.

### 5.4 Tipos fuertes y enums
- Usar `TypeSafeEnum` / enums tipados en lugar de strings mágicos.
- Nunca comparar contra literales (`"Active"`, `"Admin"`); usar las constantes del enum: `CvlRoleEnum.Administrator.Name`.
- Las reglas de longitud y formato van dentro de la entidad como `Rules`:
  ```csharp
  public static class Rules
  {
      public const int NameMaxLength = 100;
  }
  ```

---

## 6. Errores y códigos

### 6.1 Siempre proporcionar error code
- Al retornar `Result.Failure(...)`, **siempre** incluir el código de error:
  ```csharp
  return Result.Failure<TResponse>(UsersResources.UserNotFound, UserErrorCodes.UserNotFound);
  ```

### 6.2 Ubicación de error codes
- Códigos de feature → `CVL.SmartLocks.Shared/Errors/{Feature}ErrorCodes.cs`.
- Códigos de autenticación → dentro de la feature (`Features/Auth/AuthErrorCodes.cs`).

### 6.3 Convención de nombres
- PascalCase, descriptivos, sin prefijos redundantes: `EmailAlreadyInUse`, `UserRoleInvalid`, `UserNotFound`.

### 6.4 ResultFailureType
- Usar el tipo apropiado: `BadRequest` (por defecto), `NotFound`, `Conflict`, `Unauthorized`, `Forbidden`.
- `Result.Failure(...)` usa `BadRequest` por defecto. Especificar cuando corresponda:
  ```csharp
  Result.Failure<T>(message, code, ResultFailureType.NotFound)
  ```

### 6.5 Propagación desde dominio
- Cuando un método de dominio devuelve `DomainOutcome` fallido:
  ```csharp
  if (updateResult.IsFailure)
      return Result.Failure<TResponse>(updateResult.Reason.Info.CreateResultMessage(stringLocalizer));
  ```

---

## 7. REST

### 7.1 Rutas
- Convencionales: `api/{resource}` o `api/{resource}/{id}`.
- Recursos obligatorios → ruta: `/locations/{locationId}/users`.
- Parámetros opcionales → query string: `?field=value`.
- Colecciones en plural; recursos individuales en singular.
- **No** usar verbos en la URL (`/by-email`, /activate` como ruta de colección).

### 7.2 Verbos HTTP
- `GET` para queries.
- `POST` para creación y acciones sin idempotencia.
- `PUT` / `PATCH` para actualización.
- `DELETE` para borrado.

### 7.3 Acciones sobre subrecursos
- Rutas anidadas para operaciones sobre subrecursos: `POST /users/{id}/otp/validation`.
- Usar `[Route]` a nivel de acción para sub-rutas.

---

## 8. Queries y búsqueda

### 8.1 Paginación
- Todo endpoint de colección debe soportar paginación mediante `PaginatedSearchRequest`.
- Tamaño de página por defecto: 10. Máximo: 100.
- Devolver `PaginatedQueryResult<T>`.

### 8.2 Estructura de queries
- La interfaz de la query vive en el proyecto de Infrastructure: `ISearchUsersQuery`.
- La implementación SQL vive también en Infrastructure: `SearchUsersSqlQuery : SearchQueryBase`.
- El handler delega en la interfaz de query.

### 8.3 Campos permitidos
- Toda subclase de `SearchQueryBase` debe declarar `AllowedSearchFields` y `AllowedOrderFields`.
- Las consultas se validan contra estas listas antes de ejecutarse.

### 8.4 SQL parametrizado
- Todo SQL dinámico debe usar `DynamicParameters` (Dapper) o parametrización de EF Core.
- Cero valores interpolados en strings dentro de consultas.

---

## 9. Mediator

### 9.1 Contratos
- Comandos: `IFeatureCommand<TResponse>` (ubicado en `Dorlet.Core.Mediator.Commands.Abstractions`).
- Queries: `IFeatureQuery<TResponse>` (ubicado en `Dorlet.Core.Mediator.Queries.Abstractions`).
- Handlers: `IFeatureCommandHandler<TCommand, TResponse>` / `IFeatureQueryHandler<TQuery, TResponse>`.

### 9.2 Envío
- Desde el controlador: `await mediator.Send(request)`.
- No usar `Publish` para comandos/queries.

### 9.3 Pipeline behaviors
- `SaveDatabaseChangesPipelineBehavior`: guarda cambios automáticamente tras comandos exitosos.
- `IAfterSaveHook`: hook post-save para lógica después de persistir.
- No duplicar lógica que ya esté en un pipeline behavior.

---

## 10. Recursos y localización

### 10.1 Archivos `.resx`
- Cada feature tiene sus recursos en `Features/{FeatureName}/Resources/{Feature}Resources.resx`.
- Idioma por defecto (español) en `.resx`; inglés en `.en.resx`.
- Los mensajes se acceden desde la clase generada automáticamente.

### 10.2 Convención de claves
- `{Entity}_{Property}_{Rule}`: `User_Name_Required`, `User_Email_Invalid`.
- Mensajes con formato: usar `Format()` para interpolación:
  ```csharp
  UsersResources.User_Name_InvalidMaxLength.Format(SmartLockUser.Rules.Name.MaxLength)
  ```

### 10.3 Tildes y caracteres del español
- Los archivos `.resx` en español deben usar directamente todos los caracteres propios del idioma:
  - Vocales con tilde: `á`, `é`, `í`, `ó`, `ú`.
  - `ñ` y `ü` (diaéresis).
  - Signos de apertura: `¿`, `¡`.
  - Comillas tipográficas: `«`, `»` cuando corresponda.
- **No** usar entidades HTML (`&aacute;`, `&ntilde;`), secuencias de escape (`\u00e1`, `\u00f1`) ni caracteres corruptos.
- **No** sustituir caracteres españoles por versiones sin acento: escribir `ubicación`, no `ubicacion`; `año`, no `ano`; `pingüino`, no `pinguino`.
- Asegurar que los `.resx` se guarden con codificación UTF-8.
- Si el editor o herramienta reemplaza tildes o ñ por caracteres extraños, verificar la codificación del archivo.

---

## 11. Permisos y seguridad

### 11.1 Permisos por recurso
- Cada recurso define `{Feature}Permissions : IProjectResourcePermissions`.
- Patrón: `{ResourceName}-{PermissionType}` (`Users-Read`, `Users-Create`, etc.).
- Registrar las clases de permisos para que el seeder las detecte.

### 11.2 Rate limiting
- Todo endpoint público → `[EnableRateLimiting("ActivationPublicFlow")]`.
- No añadir rate limiting a endpoints autenticados sin justificación.

### 11.3 Identificadores cifrados
- Los Guids internos se exponen como HashIds vía `IEncryptDecrypt`.
- Usar `HashIdGuid` route constraint en las rutas.

---

## 12. Testing

### 12.1 Qué probar
- Lógica de negocio y handlers.
- Entidades de dominio (factorías, métodos de modificación, invariantes).
- Validadores FluentValidation.
- Evitar pruebas triviales (getters, setters, AutoMapper).

### 12.2 Patrones
- Seguir el patrón existente en `tests/`.
- Builders para entidades de test cuando sea necesario.
- Usar `Result.IsSuccess` / `Result.IsFailure` para aserciones.

---

## 13. Convenciones generales de código

### 13.1 Estilo
- No añadir comentarios innecesarios.
- Eliminar `using` no utilizados.
- No dejar líneas en blanco innecesarias.
- Usar nombres descriptivos.
- No duplicar código.
- Los comentarios en español deben usar correctamente todos los caracteres del idioma (`á`, `é`, `í`, `ó`, `ú`, `ñ`, `ü`, `¿`, `¡`), sin entidades HTML, secuencias de escape ni caracteres corruptos.

### 13.2 NuGet y dependencias
- Usar Central Package Management (`Directory.Packages.props`).
- No añadir paquetes nuevos sin justificación.
- Versiones gestionadas centralmente.

### 13.3 Migraciones
- Crear migraciones desde el proyecto de Infrastructure:
  ```
  dotnet ef migrations add {Name} --startup-project {MCP.Host path}
  ```
- Nombres descriptivos: `AddNewEmailToExternalUserOtpRequest`.
