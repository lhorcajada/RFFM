# Protección de Arquitectura — Guardrails

Reglas inviolables para preservar la integridad arquitectónica del proyecto CVL.SmartLocks.
Cada regla describe **lo que NO debe hacerse** para no romper los patrones establecidos.

---

## Backend — CQRS y Vertical Slices

### ❌ No introducir lógica de negocio en los controladores

Los controladores deben ser exclusivamente puntos de entrada HTTP: recibir la request, delegar al mediator y devolver la respuesta. Cualquier decisión de negocio, validación o transformación de datos pertenece al handler.

**Incorrecto:**
```csharp
[HttpPost]
public async Task<IActionResult> Create([FromBody] CreateUserCommand request)
{
    if (string.IsNullOrEmpty(request.Email))
        return BadRequest("Email is required"); // ❌ Validación en controller

    var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
    if (user != null)
        return Conflict("Email already exists"); // ❌ Lógica de negocio en controller

    await _mediator.Send(request);
    return Ok();
}
```

**Correcto:**
```csharp
[HttpPost]
public async Task<IActionResult> Create([FromBody] CreateUserCommand request)
{
    var result = await _mediator.Send(request);
    return result.ToHttpResult();
}
```

### ❌ No devolver tipos distintos de `Result<T>` o `Result` en los handlers

Todos los handlers deben devolver `Result<T>` o `Result`. No se permiten excepciones de dominio, tuples, ni tipos crudos como mecanismo de retorno de la lógica de aplicación.

**Incorrecto:**
```csharp
public async Task<UserDto> Execute(GetUserQuery request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.Id);
    return user ?? throw new NotFoundException(); // ❌ Excepción como flujo
}
```

**Correcto:**
```csharp
public async Task<Result<UserDto>> Execute(GetUserQuery request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.Id);
    return user is null
        ? Result.Failure<UserDto>(UserErrors.NotFound, UserErrorCodes.UserNotFound)
        : Result.Success(user.ToDto());
}
```

### ❌ No llamar a `SaveChangesAsync` manualmente desde los handlers

La persistencia se gestiona automáticamente mediante `SaveDatabaseChangesPipelineBehavior`. Llamar a `SaveChangesAsync` en un handler duplica la escritura o introduce transacciones parciales no deseadas. Solo los seeders y la infraestructura de persistencia pueden invocarlo.

**Incorrecto:**
```csharp
public async Task<Result> Execute(DeleteCompanyCommand request, CancellationToken ct)
{
    var company = await _dbContext.Companies.FindAsync(request.Id, ct);
    _dbContext.Companies.Remove(company!);
    await _dbContext.SaveChangesAsync(ct); // ❌ SaveChanges manual
    return Result.Success();
}
```

**Correcto:**
```csharp
public async Task<Result> Execute(DeleteCompanyCommand request, CancellationToken ct)
{
    var company = await _dbContext.Companies.FindAsync(request.Id, ct);
    _dbContext.Companies.Remove(company!);
    return Result.Success(); // ✅ El pipeline guarda automáticamente
}
```

### ❌ No omitir el error code en `Result.Failure(...)`

Toda invocación a `Result.Failure` debe incluir el código de error correspondiente definido en la clase `*ErrorCodes` del dominio o de Shared. Esto garantiza que los errores sean legibles por máquina y consistentes.

**Incorrecto:**
```csharp
return Result.Failure<CreateCommandResponse>("Company not found"); // ❌ Sin error code
```

**Correcto:**
```csharp
return Result.Failure<CreateCommandResponse>(CompanyErrors.NotFound, CompanyErrorCodes.CompanyNotFound);
```

### ❌ No mezclar lógica de Query y Command en un mismo handler

Cada handler resuelve exactamente una operación (Command o Query). Si un Query necesita mutar estado, repensar el diseño. Si un Command necesita devolver datos complejos más allá del `Result`, revisar la responsabilidad.

### ❌ No crear handlers genéricos que procesen múltiples entidades no relacionadas

Cada vertical slice corresponde a una feature cohesiva. Un handler no debe operar sobre entidades de dominios distintos sin una relación explícita y natural.

---

## Backend — Validación

### ❌ No validar reglas de negocio en FluentValidation

FluentValidation se usa exclusivamente para validación de formato y estructura del input (campos requeridos, formato de email, rango de valores). Las reglas de negocio (conflictos, autorizaciones, estados) pertenecen al handler.

**Incorrecto:**
```csharp
public class CreateCompanyValidator : Validator<CreateCompanyCommand>
{
    public CreateCompanyValidator(SmartLocksDbContext dbContext)
    {
        RuleFor(x => x.Cif)
            .MustAsync(async (cif, ct) => !await dbContext.Companies.AnyAsync(c => c.Cif == cif, ct))
            .WithMessage("CIF already exists"); // ❌ Validación de negocio en validator
    }
}
```

**Correcto:**
```csharp
// En el Validator: solo formato
public class CreateCompanyValidator : Validator<CreateCompanyCommand>
{
    public CreateCompanyValidator()
    {
        RuleFor(x => x.Cif).NotEmpty().MaximumLength(20);
    }
}

// En el Handler: regla de negocio
var exists = await companiesFeatureService.CheckExists(request, cancellationToken);
if (exists.IsDuplicate)
    return Result.Failure<CreateCommandResponse>(CompanyErrors.DuplicateCif, CompanyErrorCodes.DuplicateCif);
```

### ❌ No duplicar validaciones entre validator y handler

Si una regla de formato ya está cubierta por FluentValidation, no añadirla de nuevo en el handler. Si una regla es de negocio, no meterla en el validator.

---

## Backend — Dominio

### ❌ No instanciar entidades con `new` desde fuera del dominio

Las entidades del dominio se crean mediante factorías estáticas `Create()`. Esto encapsula las invariantes de creación y valida la consistencia del objeto. El constructor sin parámetros es privado para EF Core.

**Incorrecto:**
```csharp
var user = new ExternalUser
{
    CompanyId = company.Id,
    SmartLockUserId = smartLockUser.Id,
    SmartLockUser = smartLockUser
}; // ❌ Instanciación directa
```

**Correcto:**
```csharp
var result = ExternalUser.Create(name, surname1, surname2, email, password, company);
if (result.CouldNotBeCreated)
    return Result.Failure<CreateCommandResponse>(result.Reason.Info, UserErrorCodes.UserCannotBeCreated);
var user = result.Data;
```

### ❌ No usar strings mágicos para estados, tipos o categorías

Usar enums del dominio (`CvlRoleEnum`, `CredentialType`, `ExternalUserOtpPurpose`, etc.) o tipos fuertes. No comparar con literales de texto.

**Incorrecto:**
```csharp
if (role == "Admin") // ❌ String mágico
if (credential.Type == "card") // ❌ String mágico
```

**Correcto:**
```csharp
if (role == CvlRoleEnum.Admin)
if (credential.Type == CredentialType.Card)
```

### ❌ No exponer setters públicos en las entidades del dominio

Las propiedades de las entidades deben tener setters privados o protegidos. Las mutaciones se realizan mediante métodos de dominio que encapsulan las reglas de negocio.

**Incorrecto:**
```csharp
public string Name { get; set; } // ❌ Setter público
```

**Correcto:**
```csharp
public string Name { get; private set; } // ✅ Setter privado, mutación vía método de dominio
```

### ❌ No ignorar los Value Objects cuando el concepto lo requiere

Si un concepto tiene invariantes (dirección, duración, ventana de validez), modelarlo como Value Object, no como tipos primitivos sueltos en la firma de un método.

**Incorrecto:**
```csharp
public static DomainCreateOutcome<Door> Create(string name, int unlockTimeSeconds, int extendedUnlockTimeSeconds)
```

**Correcto:**
```csharp
public static DomainCreateOutcome<Door> Create(string name, Site site, Duration defaultUnlockTime, Duration extendedUnlockTime)
```

---

## Backend — Datos y Persistencia

### ❌ No usar `AsNoTracking()` en consultas cuyos resultados se van a modificar

`AsNoTracking()` es para consultas de solo lectura. Si la entidad se va a modificar y persistir por el pipeline, debe ser trackeada por EF Core.

**Incorrecto:**
```csharp
var company = await _dbContext.Companies
    .AsNoTracking()        // ❌ No se podrá persistir el cambio
    .FirstOrDefaultAsync(c => c.Id == request.Id, ct);
company.UpdateName(request.Name);
```

**Correcto:**
```csharp
var company = await _dbContext.Companies
    .FirstOrDefaultAsync(c => c.Id == request.Id, ct); // ✅ Trackeado
company.UpdateName(request.Name);
```

### ❌ No olvidar `AsNoTracking()` en consultas de solo lectura

En queries que solo leen datos (búsquedas, listados, exportaciones), usar siempre `AsNoTracking()` para mejorar el rendimiento.

**Incorrecto:**
```csharp
var users = await _dbContext.ExternalUsers
    .Include(u => u.SmartLockUser)
    .Where(u => u.SiteId == siteId)
    .ToListAsync(ct); // ❌ Trackeando entidades de solo lectura
```

**Correcto:**
```csharp
var users = await _dbContext.ExternalUsers
    .AsNoTracking()
    .Include(u => u.SmartLockUser)
    .Where(u => u.SiteId == siteId)
    .ToListAsync(ct);
```

### ❌ No escribir consultas SQL sin parametrizar

Todas las consultas SQL (raw queries, Dapper, etc.) deben usar parámetros. Nunca concatenar valores en la cadena SQL.

**Incorrecto:**
```csharp
var sql = $"SELECT * FROM Users WHERE Email = '{email}'"; // ❌ SQL injection
```

**Correcto:**
```csharp
var sql = "SELECT * FROM Users WHERE Email = @Email";
await connection.QueryAsync<User>(sql, new { Email = email });
```

### ❌ No aceptar campos de búsqueda u ordenación sin validar

Los endpoints de búsqueda deben validar que los campos de `sortBy`, `searchField` y similares pertenezcan a una lista explícita de campos permitidos. Nunca pasar directamente el input del usuario a una consulta dinámica.

**Incorrecto:**
```csharp
query = query.OrderBy(sortBy + " " + sortDirection); // ❌ Campo sin validar
```

**Correcto:**
```csharp
var allowedSortFields = new[] { "Name", "Email", "CreatedAt" };
if (!allowedSortFields.Contains(sortBy))
    return Result.Failure<SearchResult<UserDto>>(...);
query = query.OrderBy(sortBy + " " + sortDirection);
```

### ❌ No poner lógica de consultas SQL directamente en los handlers

Las consultas complejas de búsqueda y listado deben extraerse a interfaces (`ISearchUsersQuery`, `ISearchCompaniesQuery`) implementadas en el proyecto de infraestructura. Los handlers consumen la abstracción, no la implementación concreta.

---

## Backend — API REST

### ❌ No usar verbos en las rutas URL

Las rutas REST representan recursos, no acciones. Usar sustantivos y los verbos HTTP para expresar la intención.

**Incorrecto:**
```
POST /users/activate        ❌ Verbo en la URL
POST /users/by-email        ❌ Verbo en la URL
GET  /companies/search      ❌ Verbo en la URL
```

**Correcto:**
```
POST /users/activation      ✅ Sustantivo
GET  /users?email={email}   ✅ Filtro en query string
GET  /companies?search={q}  ✅ Filtro en query string
```

### ❌ No usar singular para colecciones ni plural para recursos individuales

Las colecciones van en plural (`/users`, `/companies`). Los recursos individuales se acceden por ID (`/users/{id}`).

**Incorrecto:**
```
GET /user           ❌ Singular para colección
GET /userss/{id}    ❌ Doble plural
POST /companie      ❌ Singular
```

**Correcto:**
```
GET /users           ✅ Plural para colección
GET /users/{id}      ✅ Recurso individual
POST /companies      ✅ Plural
```

### ❌ No poner parámetros obligatorios en query string

Si un parámetro es necesario para identificar el recurso (como `locationId` en usuarios de una ubicación), debe ir en la ruta. Los query string son para filtros opcionales.

**Incorrecto:**
```
GET /users?siteId={siteId}  ❌ Identificador en query string
```

**Correcto:**
```
GET /sites/{siteId}/users   ✅ Identificador en la ruta
```

### ❌ No anidar más de dos niveles de colección en la ruta

Máximo permitido: `collection/item/collection`. URIs más profundas son difíciles de mantener, inflexibles ante cambios de relaciones y generan rutas frágiles.

**Incorrecto:**
```
GET /sites/{siteId}/users/{userId}/roles/{roleId}/permissions  ❌ 4 niveles
```

**Correcto:**
```
GET /sites/{siteId}/users                ✅ Navegar desde la colección padre
GET /users/{userId}/roles                ✅ Relación desde el recurso individual
GET /roles/{roleId}/permissions          ✅ Relación directa
```

### ❌ No usar `POST` contra un recurso individual para crear subrecursos con URI asignada por el cliente

El cliente no debe construir el URI del recurso nuevo. `POST` para creación va contra la colección; el servidor asigna el identificador y lo devuelve en el header `Location`.

**Incorrecto:**
```
POST /users/{userId}/roles/{roleId}  ❌ POST contra recurso individual para crear
```

**Correcto:**
```
POST /users/{userId}/roles           ✅ POST contra la colección; el servidor asigna el URI
Response: 201 Created
Location: /users/{userId}/roles/{roleId}
```

### ❌ No usar `PUT` para actualizaciones parciales

`PUT` reemplaza el recurso completo. Para cambios parciales, usar `PATCH`. Usar `PUT` con datos incompletos puede dejar campos en null o valores por defecto no deseados.

**Incorrecto:**
```
PUT /users/{id}               ❌ PUT para cambiar solo el nombre
Body: { "name": "New Name" }  ❌ El resto de campos se perderían
```

**Correcto:**
```
PATCH /users/{id}             ✅ PATCH para actualización parcial
Body: { "name": "New Name" }
```

### ❌ No devolver códigos de estado HTTP incorrectos

Cada método HTTP tiene códigos de estado semánticos. No usar `200 OK` para todo. Seguir las convenciones:

| Método | Código correcto | ❌ No usar |
|---|---|---|
| `POST` (creación) | `201 Created` + `Location` | `200 OK` |
| `DELETE` (éxito) | `204 No Content` | `200 OK` |
| `GET` (sin resultados) | `204 No Content` o lista vacía | `404 Not Found` |
| `POST`/`PUT`/`PATCH` (datos inválidos) | `400 Bad Request` | `422 Unprocessable Entity` |
| `PUT`/`PATCH` (conflicto de estado) | `409 Conflict` | `400 Bad Request` |

### ❌ No exponer la estructura de la base de datos en las URIs

La API es una abstracción del dominio, no un espejo de las tablas. No mapear tablas directamente como recursos ni incluir nombres de columnas en las rutas.

**Incorrecto:**
```
GET /external-user-site-roles           ❌ Nombre de tabla como recurso
GET /tbl_credentials/{id}              ❌ Prefijo de tabla en la ruta
GET /users?sortBy=USR_NAME             ❌ Nombre de columna en query string
```

**Correcto:**
```
GET /users/{userId}/roles              ✅ Recurso del dominio
GET /credentials/{id}                  ✅ Recurso del dominio
GET /users?sort=name                   ✅ Campo del modelo de dominio
```

### ❌ No implementar paginación sin límite máximo

Todo endpoint paginado debe definir valores por defecto (`limit=25`, `offset=0`) y un límite máximo para prevenir abuso o ataques DoS. No permitir que el cliente solicite conjuntos ilimitados de datos.

**Incorrecto:**
```
GET /users?limit=999999  ❌ Sin límite máximo
GET /users               ❌ Sin paginación por defecto
```

**Correcto:**
```
GET /users?limit=25&offset=0  ✅ Valores por defecto; límite máximo impuesto por el servidor
GET /users?limit=200          ✅ Si el máximo es 200; si el cliente pide más, devolver 400 o capar al máximo
```

### ❌ No omitir la validación de campos permitidos para búsqueda y ordenación en endpoints de búsqueda

Los parámetros `sort`, `searchField`, `filter` y similares deben validarse contra una lista explícita de campos permitidos. Nunca pasar directamente el input del usuario a una cláusula `ORDER BY` o `WHERE` dinámica.

---

## Backend — Estructura de Features

### ❌ No crear archivos fuera de la estructura de feature correspondiente

Cada feature es una carpeta vertical que contiene su controller, handlers, commands, queries y validators. No crear handlers sueltos en `Common/` ni controladores genéricos que acumulen endpoints de varias features.

**Estructura correcta:**
```
Features/
  Users/
    UsersController.cs
    UsersFeatureService.cs
    Create/
      CreateUserCommand.cs
      CreateUserCommandHandler.cs
    Search/
      SearchUsersQuery.cs
      SearchUsersQueryHandler.cs
    ...
```

### ❌ No duplicar lógica compartida entre handlers de la misma feature

Si dos o más handlers de la misma feature comparten lógica (como `CheckExists`), extraerla a un `FeatureService` dentro de la feature (p.ej. `UsersFeatureService`, `CompaniesFeatureService`). No duplicar el código ni crear clases helper genéricas fuera de la feature.

### ❌ No crear FeatureServices cross-feature

Los `FeatureService` contienen lógica compartida dentro de una misma feature. Si hay lógica que cruza features, mediar a través de interfaces de dominio o servicios de aplicación, no con FeatureServices de otra feature.

---

## Frontend — TypeScript y Estructura

### ❌ No usar `any` en TypeScript

El proyecto usa `strict` mode. Nunca usar `any`, ni siquiera en castings. Usar tipos específicos, `unknown` con type guards, o `Record<string, unknown>` para datos dinámicos.

### ❌ No hardcodear textos visibles

Todo texto que vea el usuario debe ir por `i18next`. No hay excepciones: labels, placeholders, mensajes de error, títulos, tooltips.

**Incorrecto:**
```tsx
<Button>Save</Button>           // ❌ Texto hardcodeado
<Typography>User List</Typography>  // ❌ Texto hardcodeado
```

**Correcto:**
```tsx
<Button>{t('common.save')}</Button>
<Typography>{t('users.list.title')}</Typography>
```

### ❌ No hacer llamadas HTTP fuera de `src/core/api/client.ts`

Toda llamada HTTP pasa por el cliente centralizado. No usar `fetch`, `axios` directo, ni instancias propias de axios en los componentes o hooks.

### ❌ No poner lógica de UI fuera de la feature correspondiente

Cada feature tiene `api/`, `components/`, `pages/`. No crear componentes de una feature en `src/components/` global ni mezclar features.

---

## Frontend — Estilos

### ❌ No usar `style={{}}` inline

Nunca aplicar estilos inline con el prop `style`. Usar CSS Modules o el prop `sx` de MUI para ajustes puntuales.

**Incorrecto:**
```tsx
<Box style={{ display: 'flex', gap: 8 }}>  // ❌ Inline style
```

**Correcto:**
```tsx
<Box sx={{ display: 'flex', gap: 1 }}>      // ✅ sx prop con tokens del tema
```

### ❌ No usar `styled()` de MUI

El proyecto usa CSS Modules como sistema de estilos principal. No usar `styled()` de `@mui/material/styles`.

### ❌ No hardcodear valores de color, tipografía o espaciado

Usar exclusivamente los tokens CSS y el tema MUI (`theme.palette.*`, `theme.spacing.*`, etc.). No hardcodear hex, rem o px para valores que el tema ya define.

**Incorrecto:**
```tsx
<Box sx={{ color: '#1976d2', marginTop: '16px' }}>  // ❌ Hardcode
```

**Correcto:**
```tsx
<Box sx={{ color: 'primary.main', mt: 2 }}>         // ✅ Tokens del tema
```

---

## General

### ❌ No duplicar código

Si una pieza de lógica se repite, extraerla a una función, hook, servicio o clase base. La duplicación es la raíz de inconsistencias y bugs futuros.

### ❌ No añadir comentarios innecesarios

El código debe ser autoexplicativo. No comentar lo que el código ya dice. Los comentarios solo se justifican para aclarar decisiones de diseño no obvias o restricciones externas.

### ❌ No dejar `using` innecesarios ni líneas en blanco sin propósito

Mantener los archivos limpios: eliminar `using` no referenciados y líneas en blanco que no aporten separación lógica.

### ❌ No usar nombres no descriptivos

Evitar nombres como `data`, `info`, `temp`, `item`, `result2`. Los nombres deben revelar la intención y el dominio.

**Incorrecto:**
```csharp
var data = await GetUsersAsync();
var temp = data.FirstOrDefault();
```

**Correcto:**
```csharp
var externalUsers = await GetExternalUsersAsync();
var matchingUser = externalUsers.FirstOrDefault();
```

### ❌ No extraer condiciones compuestas sin nombre

Si un `if` tiene una expresión booleana compuesta o no trivial, extraerla a una variable con nombre descriptivo.

**Incorrecto:**
```csharp
if (user.IsActive && user.SiteId == siteId && user.Role != CvlRoleEnum.Temporary)
```

**Correcto:**
```csharp
var canAccessSiteFeatures = user.IsActive && user.SiteId == siteId && user.Role != CvlRoleEnum.Temporary;
if (canAccessSiteFeatures)
```
