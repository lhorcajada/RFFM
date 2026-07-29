# Reglas de Arquitectura

Reglas que rigen cómo se organiza el sistema, cómo interactúan las capas y dónde debe ubicarse el código.

---

## 1 · Estructura de la Solución

```
CVL.SmartLocks/
├── src/
│   ├── aspire/              → Host de orquestación .NET Aspire
│   ├── identity/            → Librerías de Autenticación y Autorización
│   ├── libraries/           → Librerías core compartidas (sin lógica de dominio)
│   ├── services/
│   │   ├── infrastructure/  → EF Core, SQL Server, migraciones, pipeline behaviors
│   │   ├── mcp/             → API principal (CVL.SmartLocks.MCP + Host)
│   │   └── shared/          → Dominio, Shared kernel, ServiceDefaults, Host.Shared
│   └── web/                 → SPA Back-office (React)
├── tests/
│   ├── CVL.SmartLocks.Domain.Tests/
│   ├── CVL.SmartLocks.FunctionalTests/
│   └── shared/
└── packages/                → Caché de paquetes NuGet (Central Package Management)
```

---

## 2 · Grafo de Dependencias entre Proyectos

Las dependencias fluyen **hacia dentro**. Los proyectos exteriores pueden referenciar a los interiores; los interiores nunca deben referenciar a los exteriores.

```
CVL.SmartLocks.MCP.Host
  └─→ CVL.SmartLocks.MCP
        ├─→ CVL.SmartLocks.Shared
        │     └─→ Dorlet.Core
        │     └─→ Dorlet.Domain.Core
        │     └─→ Dorlet.FluentValidation
        │     └─→ Dorlet.Identity.Authorization
        ├─→ CVL.SmartLocks.Domain
        │     └─→ Dorlet.Domain.Core
        └─→ CVL.SmartLocks.Infrastructure.Data.SqlServer
              ├─→ CVL.SmartLocks.Domain
              └─→ Dorlet.Core
```

Las **librerías de Identity** (`Dorlet.Identity.Authentication`, `Dorlet.Identity.Authorization`) son independientes — no deben depender de ningún proyecto `CVL.SmartLocks.*`.

---

## 3 · Responsabilidades por Capa

| Capa | Proyecto(s) | Posee |
|---|---|---|
| **API Host** | `CVL.SmartLocks.MCP.Host` | Composition root, registro DI, pipeline de middleware, configuración de inicio |
| **API Feature** | `CVL.SmartLocks.MCP` | Controladores, carpetas de features (comandos, queries, handlers, respuestas), feature services, validación, cadenas de recursos |
| **Shared Kernel** | `CVL.SmartLocks.Shared` | `ApiControllerBase`, extensiones transversales, códigos de error, permisos, opciones, helpers MVC, seguridad, filtros de validación |
| **Dominio** | `CVL.SmartLocks.Domain` | Entidades, value objects, enums, constantes de dominio, métodos factoría de dominio (`Create()`) |
| **Infraestructura** | `CVL.SmartLocks.Infrastructure.Data.SqlServer` | `SmartLocksDbContext`, configuraciones EF, migraciones, queries de read-model, pipeline behaviors, seeds |
| **Librerías Core** | `Dorlet.Core`, `Dorlet.Domain.Core`, `Dorlet.Mediator`, `Dorlet.FluentValidation` | `Result<T>`, abstracciones del mediator, entidades base, infraestructura de validación |

---

## 4 · Estructura de Carpetas por Feature (Vertical Slices)

Cada feature vive bajo `CVL.SmartLocks.MCP/Features/<NombreFeature>/`.

### Slice de Comando

```
Features/Users/Create/
├── CreateUserCommand.cs           → Implementa IFeatureCommand
└── CreateUserCommandHandler.cs    → Implementa IFeatureCommandHandler
```

### Slice de Query

```
Features/Users/Search/
├── SearchUsersQuery.cs            → Implementa IFeatureQuery
└── SearchUsersQueryHandler.cs     → Implementa IFeatureQueryHandler
```

### Archivos Raíz del Feature

```
Features/Users/
├── UsersController.cs             → Controlador mínimo; delega a IMediator
├── UsersFeatureService.cs         → Queries entre acciones (verificaciones de existencia, lookups compartidos)
├── UsersValidationConstants.cs    → Constantes de reglas FluentValidation
├── UserErrorCodes.cs              → Constantes de cadena de códigos de error
├── Resources/                     → Cadenas de recursos localizadas
├── Create/
├── Update/
├── Delete/
├── Get/
├── Search/
└── …
```

**Reglas:**

- Un handler por comando/query — mantenido en la misma carpeta que el tipo de request.
- Los DTOs de respuesta permanecen en la carpeta del slice a menos que se compartan entre slices.
- Los archivos `*ErrorCodes.cs` agrupan todas las constantes de códigos de error del feature.
- `*FeatureService.cs` agrupa lookups de solo lectura en base de datos compartidos por múltiples handlers del mismo feature.
- Los validadores a nivel de feature viven en `Features/<NombreFeature>/<Accion>/` y siguen el pipeline de `FluentValidation`.

---

## 5 · Reglas de Controladores

- Los controladores heredan de `ApiControllerBase`.
- Los controladores deben contener **cero lógica de negocio** — solo:
  - Vinculan parámetros desde ruta/query/body.
  - Llaman a `mediator.Send(request)`.
  - Retornan `result.ToHttpResult()`.
- Convenciones REST:
  - Recursos en plural (`/api/sites/{siteId}/users`).
  - Identificadores obligatorios en la ruta; filtros opcionales en la query string.
  - Sin verbos en las URLs.
- La autorización usa constantes de permisos (`[Authorize(UsersPermissions.Create)]`).
- Rate limiting en endpoints públicos (`[EnableRateLimiting]`).

---

## 6 · Reglas de Handlers

- Los handlers implementan `IFeatureCommandHandler<TRequest, TResponse>` o `IFeatureQueryHandler<TRequest, TResponse>`.
- Los handlers **deben** retornar `Result<T>` o `Result`.
- Toda llamada a `Result.Failure(...)` **debe** incluir la constante de código de error correspondiente.
- Los handlers **nunca** deben llamar a `SaveChangesAsync()` — la persistencia la maneja `SaveDatabaseChangesPipelineBehavior`.
- Usar `AsNoTracking()` en queries de `DbContext` cuyos resultados no se mutan.
- Preferir variables descriptivas con nombre para condiciones compuestas en `if`.

---

## 7 · Reglas de Dominio

- Jerarquía de entidades: `EntityBase` → `TenantEntity` → `AuditableEntity` → `LogicDeletableEntity`.
- Todos los IDs de entidad son `Guid` (versión 7), generados en la construcción.
- Las entidades usan métodos factoría estáticos (`Create()`) — sin constructores públicos con invariantes de dominio.
- Los Value Objects viven en `CVL.SmartLocks.Domain/<Contexto>/` o `Dorlet.Domain.Core/ValueObjects/`.
- Los enums fuertemente tipados heredan de `TypeSafeEnumEntity` — sin magic strings.
- Los datos de referencia tipo enum (unidades de duración, tipos de credencial, etc.) se modelan como entidades EF-owned con seed data.

---

## 8 · Reglas de Infraestructura

- `SmartLocksDbContext` hereda del contexto de autorización de identidad y declara todas las propiedades `DbSet<>`.
- Las queries de read-model (búsqueda, listado, agregación) viven en `Infrastructure.Data.SqlServer/Queries/<Feature>/`.
- Las configuraciones de entidades EF viven en `EntitiesConfiguration/`.
- Las migraciones se generan contra el proyecto de infraestructura con el MCP Host como startup project.
- `SaveDatabaseChangesPipelineBehavior` auto-guarda tras comandos exitosos y ejecuta implementaciones de `IAfterSaveHook`.
- Las queries SQL siempre están parametrizadas vía Dapper o LINQ — sin interpolación de cadenas raw.

---

## 9 · Convenciones de Manejo de Errores

- Los códigos de error son constantes de cadena en archivos `*ErrorCodes.cs` (ej.: `UserErrorCodes.EmailAlreadyInUse`).
- Los mensajes localizados provienen de archivos de recursos en `Features/<Feature>/Resources/`.
- `Result.Failure(message, code)` se mapea a códigos de estado HTTP vía `ResultFailureType`.
- Los errores de validación son procesados por `SharedValidationFilter` y retornados como `ValidationProblemDetails`.

---

## 10 · Reglas de Testing

- **Tests de dominio** (`CVL.SmartLocks.Domain.Tests`) — tests unitarios para entidades, value objects y lógica de dominio.
- **Tests funcionales** (`CVL.SmartLocks.FunctionalTests`) — tests de integración por carpeta de feature (`Features/<Feature>/`).
- Los tests deben cubrir lógica de negocio y componentes complejos; evitar tests triviales.
- Seguir los patrones existentes de builders y fixtures.

---

## 11 · Servicios Comunes

Los servicios entre features viven en `CVL.SmartLocks.MCP.Common/Services/`:

```
Common/Services/
├── Email/               → Envío de notificaciones por email
├── Site/                → Asignación de sites, reloj del site
├── Users/               → Pre-chequeos de gestión de usuarios
├── Notifications/       → Envío de notificaciones
├── Credentials/         → Operaciones de credenciales
├── Doors/               → Acciones de puertas
├── SecureDevices/       → Operaciones de dispositivos seguros
└── Durations/           → Cálculos de duración
```

Los **helpers de validación** comunes viven en `Common/Validation/`.

Los **helpers** comunes viven en `Common/Helpers/`.

---

## 12 · Convenciones de Endpoints REST

Basado en [Web API Design Best Practices — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design).

### Diseño de URIs

- **Usar sustantivos para nombrar recursos**, nunca verbos. La acción la define el método HTTP.
  - ✅ `GET /api/sites/{siteId}/users`
  - ❌ `GET /api/get-users-by-site`
- **Usar sustantivos en plural** para colecciones: `/api/users`, `/api/sites`.
- **Identificadores obligatorios como parámetros de ruta**: `/api/sites/{siteId}/users`.
- **Filtros opcionales como query string**: `/api/users?status=active&role=admin`.
- **No anidar más de dos niveles** de colección. Máximo: `collection/item/collection`.
  - ✅ `/api/sites/{siteId}/users`
  - ✅ `/api/users/{userId}/roles`
  - ❌ `/api/sites/{siteId}/users/{userId}/roles/{roleId}/permissions`
- **No exponer la estructura interna de la base de datos** en las URIs. La API es una abstracción del dominio.

### Métodos HTTP y semántica

| Método | Semántica | Idempotente | Ejemplo |
|---|---|---|---|
| `GET` | Recuperar recurso(s) | Sí | `GET /api/users/{id}` |
| `POST` | Crear recurso en una colección | No | `POST /api/users` |
| `PUT` | Reemplazar recurso completo | Sí | `PUT /api/users/{id}` |
| `PATCH` | Actualización parcial del recurso | No | `PATCH /api/users/{id}` |
| `DELETE` | Eliminar recurso | Sí | `DELETE /api/users/{id}` |

- `POST` contra una colección (`/api/users`) crea un nuevo recurso; el servidor asigna el URI.
- `PUT` contra un recurso individual (`/api/users/{id}`) reemplaza el recurso completo.
- `PATCH` contra un recurso individual aplica cambios parciales.
- `DELETE` contra un recurso individual lo elimina.
- `POST` contra un recurso individual que no existe → `405 Method Not Allowed`.

### Códigos de estado HTTP

| Método | Código | Significado |
|---|---|---|
| `GET` | `200 OK` | Recurso encontrado y retornado |
| `GET` | `204 No Content` | Búsqueda sin resultados |
| `GET` | `404 Not Found` | Recurso no encontrado |
| `POST` | `201 Created` | Recurso creado; URI en header `Location` |
| `POST` | `204 No Content` | Procesado sin creación de recurso |
| `POST` | `400 Bad Request` | Datos inválidos en el cuerpo |
| `PUT` | `200 OK` / `204 No Content` | Recurso actualizado |
| `PUT` | `409 Conflict` | Conflicto con el estado actual |
| `PATCH` | `200 OK` / `204 No Content` | Recurso parcialmente actualizado |
| `PATCH` | `400 Bad Request` | Documento de patch malformado |
| `PATCH` | `409 Conflict` | Cambios no aplicables al estado actual |
| `DELETE` | `204 No Content` | Recurso eliminado |
| `DELETE` | `404 Not Found` | Recurso no existe |

### Paginación, filtrado y ordenación

- **Paginación** vía query string: `?limit=25&offset=0`.
  - Definir valores por defecto sensatos (`limit=25`, `offset=0`).
  - Imponer un límite máximo para prevenir abuso.
- **Filtrado** vía query string: `?status=active&siteId=xxx`.
- **Ordenación** vía query string: `?sort=createdAt:desc`.
- Validar siempre los campos permitidos para filtrado y ordenación.

### Operaciones asíncronas

- Si una operación requiere procesamiento prolongado, retornar `202 Accepted` con el URI de estado en el header `Location`.
- El endpoint de estado retorna el progreso actual y, al completarse, `303 See Other` con el URI del recurso creado.

---

## 12 · Contenido del Shared Kernel

`CVL.SmartLocks.Shared` debe mantenerse libre de lógica específica de dominio. Posee:

- `ApiControllerBase` — controlador base.
- `Extensions/` — `ResultExtensions`, `ServiceCollectionExtensions`, etc.
- `Errors/` — constantes de códigos de error compartidas.
- `Security/Permissions/` — constantes de cadena de permisos por recurso.
- `Options/` — clases de opciones de configuración.
- `Validation/` — `SharedValidationFilter`, `ValidationResultMapper`.
- `Infrastructure/` — caché, servicios transversales.
- `StepUp/` — helpers de autenticación elevada.
- `Json/` — configuración de serialización JSON.
- `Mvc/` — model binders HashId, helpers MVC.

---

## 13 · Patrones Prohibidos

| ❌ No Hacer | ✅ Hacer En Su Lugar |
|---|---|
| Llamar a `SaveChangesAsync()` en handlers | Dejar que el pipeline behavior auto-guarde |
| Poner lógica de negocio en controladores | Moverla a un handler |
| Usar `any` (frontend) / magic strings | Usar tipos fuertes / constantes de códigos de error |
| Retornar `Result.Failure` sin código de error | Siempre pasar la constante `*ErrorCodes` |
| Referenciar proyectos exteriores desde capas interiores | Seguir la dirección del grafo de dependencias |
| Añadir lógica de dominio a `CVL.SmartLocks.Shared` | Ubicarla en `CVL.SmartLocks.Domain` |
| Usar SQL raw con interpolación de cadenas | Usar queries parametrizadas |
| Hardcodear valores CSS o usar `style={{}}` (frontend) | Usar tokens del tema MUI y CSS Modules |
