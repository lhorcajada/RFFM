## Proposal

### Why

Los coaches que compraron la app por su cuenta deben conservar la propiedad privada de los datos que introdujeron, mientras que los clubes que compran la app necesitan un espacio separado y seguro. Hoy el aislamiento depende de comprobaciones en cada handler, y una comprobación omitida filtraría datos entre clubes.

### What Changes

- Cada club recibe un tipo, Espacio personal o Club, que se muestra a los usuarios como "Espacio personal" y "Club"; todos los clubes existentes pasan a ser Espacio personal.
- Un Espacio personal solo es visible para sus miembros: no aparece en búsquedas ni sugerencias, y su nombre puede coincidir con el de otro club.
- Un coach puede pertenecer a varios espacios y clubes a la vez, cada uno aislado de los demás.
- Los datos de ámbito club se filtran por su `ClubId` en la capa de datos, de modo que pedir datos de otro club devuelve no encontrado.
- Los datos pertenecen a quien los creó, sin transferencia de propiedad ni reclamación de club; el aislamiento sigue siendo lógico, en una única base de datos.
- Fuera de este cambio: integración con pasarela de pagos, creación de clubes por directiva, límites de plan, cargos por plaza y copia de equipos (cortes posteriores).

## Design

### Target State

Tras el último paso, todos los clubes tienen tipo de espacio, los datos de ámbito club se filtran en `AppDbContext` por los clubes a los que pertenece el usuario autenticado, y los listados de clubes ocultan los Espacios personales a quienes no son miembros.

Forma final de los artefactos centrales:

```csharp
// Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs
public sealed class SpaceType : SmartEnum<SpaceType>
{
    public static readonly SpaceType PersonalSpace = new(nameof(PersonalSpace), 1, "Espacio personal");
    public static readonly SpaceType Club          = new(nameof(Club), 2, "Club");
    public string Label { get; }
}

// Club.cs: new property, default PersonalSpace
public SpaceType SpaceType { get; private set; } = SpaceType.PersonalSpace;
public static Club Create(/* existing args */, SpaceType? spaceType = null);

// AppDbContext.cs: second constructor + one filter per entity (Team, Player,
// TaskTrainingBase, PlayerModelBase, Season, UserActivityLog)
public AppDbContext(DbContextOptions<AppDbContext> options);                        // no user: filter off
public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService u); // DI: filter on for authenticated users
// filter: !ClubFilterActive || e.ClubId == null || UserClubs.Any(uc => uc.ApplicationUserId == CurrentUserId && uc.ClubId == e.ClubId)
```

```sql
-- migration AddSpaceTypeToClub
ALTER TABLE app."Clubs" ADD "SpaceType" integer NOT NULL DEFAULT 1;  -- every existing club = Personal space
```

Contrato del listado de clubes: `GetClubs` devuelve un club solo cuando es un espacio de tipo `Club` o el llamante es miembro de él, y cada elemento incluye `spaceTypeLabel` ("Espacio personal" o "Club").

### Goals / Non-Goals

**Goals**

- Dar a cada club un tipo de espacio (por defecto, Espacio personal) y migrar los clubes existentes sin tocar su propiedad, sus membresías ni sus datos.
- Filtrar las seis entidades de ámbito club por `ClubId` en la capa de datos, usando las filas `UserClubs` del usuario, de modo que los datos de otro club no se encuentren.
- Ocultar los Espacios personales a los no miembros en los listados y búsquedas de clubes; permitir que un Espacio personal comparta nombre con un club.
- Demostrar el aislamiento con pruebas de fuga sobre una base de datos real, una de lectura y una de modificación por entidad.

**Non-Goals**

- Integración con pasarela de pagos, creación de clubes por directiva, límites de plan, cargos por plaza y copia de equipos (cortes posteriores, según la propuesta).
- Transferencia o reclamación de propiedad de un Espacio personal; aislamiento físico (sigue siendo lógico, en una única base de datos).
- Ningún cambio de frontend; las etiquetas "Espacio personal" y "Club" viajan solo en el campo de API `spaceTypeLabel`.
- Fuera de alcance: ocultar un Espacio personal en la consulta directa por id (`GetClub`, `GetClubEmblem` público); revisar cuando una especificación pida privacidad del detalle o del escudo para no miembros.
- Fuera de alcance: un flujo que cree un club de tipo `Club`; revisar cuando se especifique la creación de clubes por directiva. Hasta entonces `CreateClub` siempre genera un Espacio personal.
- Fuera de alcance: un índice sobre `UserClubs(ApplicationUserId, ClubId)`; revisar si los planes de consulta muestran la subconsulta de membresía como cuello de botella.

### Decisions

#### D1. Space type is an int-backed SmartEnum on `Club`, defaulting to Personal space

`SpaceType : SmartEnum<SpaceType>` con `PersonalSpace = 1` y `Club = 2`, almacenado como entero NOT NULL con `HasDefaultValue(SpaceType.PersonalSpace)`, de modo que la migración asigna 1 a cada fila existente. `Club.Create` acepta un tipo opcional que por defecto es Espacio personal. La propiedad `Label` guarda la etiqueta en español, de modo que el valor interno nunca se muestra.

- **Provenance**: codebase-forced
- Alternativas: un `bool IsPersonal` simple (descartada: el proyecto modela los valores tipados como SmartEnum y la especificación nombra dos tipos etiquetados); columna de texto (descartada: el precedente `NewsStatus` es int).

#### D2. A global query filter on the six entities, driven by a membership subquery

`AppDbContext` registra un `HasQueryFilter` por entidad: `!ClubFilterActive || e.ClubId == null || UserClubs.Any(uc => uc.ApplicationUserId == CurrentUserId && uc.ClubId == e.ClubId)`. `ClubFilterActive` es verdadero solo cuando el contexto se construye con un `ICurrentUserService` cuyo `IsAuthenticated` es verdadero. La comprobación de membresía es un `EXISTS` correlacionado sobre `UserClubs` que se evalúa en cada consulta, no una lista cacheada al iniciar el contexto; así, una membresía creada durante la petición (unión por código de invitación, aprobación) aplica de inmediato. `UserClub` y `Club` no se filtran. Un `ClubId` nulo nunca se oculta.

- **Provenance**: user (el filtrado por las membresías del usuario, y no por un único club activo, se indica en las especificaciones)
- **Record family**: adr
- Alternativas consideradas: (a) lista de ids de membresía cargada una vez por contexto (descartada: queda obsoleta dentro de una petición y requiere una consulta antes del primer uso); (b) seguridad a nivel de fila de PostgreSQL (descartada: necesita variables de sesión por conexión y otra historia de migración, fuera de los patrones actuales de la pila); (c) mantener las comprobaciones por handler y añadir un linter (descartada: es precisamente el modo de fallo que el cambio elimina). Justificación: una declaración por entidad que ningún handler puede omitir, correcta tras cambios de membresía y traducida a un único `EXISTS` por EF Core.

#### D3. Two constructors, so the filter is opt-in by wiring

`AppDbContext(DbContextOptions<AppDbContext>)` se mantiene y construye un contexto con el filtro desactivado. Un segundo constructor añade `ICurrentUserService`; `AddDbContext` resuelve el constructor más completo que puede satisfacer, de modo que cada contexto de ámbito de petición recibe el filtro. La factoría de tiempo de diseño, los trabajos en segundo plano que construyen el contexto sin usuario, las pruebas existentes y las herramientas de migración siguen funcionando sin cambios. Los servicios alojados que resuelven el contexto de ámbito desde DI no tienen `HttpContext`, así que `IsAuthenticated` es falso y el filtro queda desactivado.

- **Provenance**: codebase-forced (cuatro llamadas directas `new AppDbContext(options)` y los flujos sin usuario de las especificaciones no dejan opción con parámetro obligatorio)
- Alternativa: un único constructor con `ICurrentUserService` obligatorio (descartada: rompe la factoría de tiempo de diseño y los fixtures, y no puede expresar "sin usuario").

#### D4. Legitimate non-member reads opt out explicitly with `IgnoreQueryFilters()`

Un punto de llamada que debe leer datos de ámbito club sin membresía sigue funcionando llamando a `IgnoreQueryFilters()` en esa consulta. Los puntos conocidos son la búsqueda y el borrado del registro de auditoría para Federación y Administrador, la rama de administrador de `UpdateTeamPlayer`, y los flujos de unión que leen Team por su código de unión o su id antes de que el usuario sea miembro: `ValidateTeamCode`, `ValidateTeamJoinCode`, `EnterClubTeamAsCoach`, `TeamInvitationValidation`, `ApproveClubJoinRequest` y `RejectClubJoinRequest`. Las exclusiones de los flujos de unión son condicionales: las pruebas de guardia escritas antes del filtro ejecutan cada flujo como no miembro autenticado, y solo a los handlers que esas pruebas muestran fallando se les añade `IgnoreQueryFilters()` en su única consulta a Team. La lista queda cerrada por las pruebas: la suite existente más pruebas específicas para la unión por código de invitación, la solicitud de unión y el trabajo en segundo plano. Cada exclusión es una sola consulta y lleva un comentario corto que nombra el flujo.

- **Provenance**: derived
- Alternativas: un bypass por rol dentro del filtro (descartada: oculta qué flujos no tienen ámbito y añade comportamiento que las especificaciones no piden); un método de contexto que desactiva el filtro para un ámbito (descartada: más amplia que una sola consulta).

#### D5. Personal-space visibility is an explicit predicate on club listings, not a filter on `Club`

`ClubVisibility.VisibleTo` conserva un club cuando su tipo es `Club` o el llamante tiene una fila en `UserClubs` para él. `GetClubs` lo aplica. `Club` no se filtra porque la búsqueda por código de invitación, las solicitudes de unión y la ruta pública del escudo leen clubes sin membresía. Cualquier listado o búsqueda de clubes que exista en otro lugar debe aplicar la misma extensión.

- **Provenance**: derived
- Alternativa: un filtro global sobre `Club` (descartada: rompe `ClubInvitationValidation` y `CreateUser`, que las especificaciones exigen que sigan funcionando).

#### D6. The club list stays uncached

Los resultados de `GetClubs` dependen ahora del llamante. `ClubsQueryApp` implementa `IQueryApp` sin `ICacheRequest`, y el Caching behavior solo cachea mensajes que implementan `ICacheRequest` (`CachingBehavior.cs:36-41`), así que la lista hoy no se cachea. Debe seguir así: no se añade `ICacheRequest` a `ClubsQueryApp`. `GetClub` (cacheado por id de club) no cambia, porque las especificaciones no piden ocultar un Espacio personal en la consulta directa por id.

- **Provenance**: codebase-forced (el Caching behavior solo indexa por `ICacheRequest.CacheKey`, que no lleva id de usuario)

#### D7. Leak tests run at the data layer against PostgreSQL, plus one handler-level not-found check

Por entidad, dos pruebas en la colección `PostgresContainerFixture`: un contexto para el usuario B (miembro solo del club B) no puede leer el registro del club A, y no puede modificarlo (una carga seguida de modificación no encuentra nada; un `ExecuteUpdate` masivo cambia cero filas; el registro no cambia al leerlo a través de un contexto sin filtrar). Una sobrecarga del fixture construye el contexto con un `ICurrentUserService` de prueba fijo. Una prueba a nivel de handler a través del host de pruebas existente confirma la forma 404 para una lectura y para una modificación.

- **Provenance**: user (base de datos real, sin mock, una prueba por entidad, lectura y modificación)

### Risks / Trade-offs

- [Handlers que cargan con `Find`/`FindAsync` pueden no aplicar el filtro de consulta] -> Mitigación: las pruebas de modificación por entidad usan la ruta de carga normal; cualquier ruta que filtre se cambia a un `FirstOrDefaultAsync` filtrado como parte del paso de esa entidad.
- [Un administrador o usuario de federación autenticado sin fila en `UserClubs` pierde el acceso de lectura a datos de ámbito club] -> Mitigación: exclusiones D4 en los handlers conocidos, encontradas ejecutando la suite existente y mediante una búsqueda en el repositorio de consumidores de `Teams`, `Players`, `Seasons` y `UserActivityLogs` en las funcionalidades de Federación y Admin.
- [Un flujo lee Team o Player de un club antes de que el usuario se una] -> Mitigación: pruebas específicas para la unión por código de invitación y para la creación, aprobación y rechazo de solicitudes de unión; se excluye solo la consulta que falla.
- [Los dependientes de una entidad filtrada (convocatorias, jugadores de equipo) desaparecen o provocan la advertencia de navegación requerida de EF cuando se oculta el principal] -> Mitigación: aceptar la ocultación (es el aislamiento previsto); revisar las advertencias de EF de la ejecución de pruebas y silenciar o corregir solo una incoherencia real.
- [`Seasons.ClubId` es nullable en la entidad y en el historial de migraciones, pero obligatorio en el snapshot y en la configuración] -> Mitigación: el filtro tolera un valor nulo en cualquiera de los dos casos; no hay cambio de esquema aquí; la prueba de fuga de Season siembra una temporada con y sin club.
- [Alguien hace cacheable `GetClubs` en el futuro y filtra la lista de un usuario a otro] -> Mitigación: D6 registra la restricción; una prueba lista clubes como dos usuarios en secuencia a través del mismo handler.
- [Las pruebas de integración existentes que se autentican como usuario de prueba sin fila `UserClub` dejan de encontrar sus Teams, Players o UserActivityLogs] -> Mitigación: cada una de esas pruebas siembra una fila `UserClub` para su usuario de prueba en el mismo paso que añade el filtro (listada en el campo de pruebas existentes de ese paso).
- [`CreateSeason` desactiva las Seasons activas de todos los clubes (`CreateSeason.cs:56-63`); con el filtro afecta solo a los clubes del llamante y a las temporadas sin club] -> Mitigación: aceptar; elimina una escritura entre clubes, que es el objetivo del aislamiento; una prueba fija el nuevo comportamiento.
- [La `EXISTS` de membresía añade una subconsulta a cada consulta filtrada] -> Mitigación: aceptable con el volumen actual; el índice es un no-objetivo registrado.
- [Se añade en el futuro una entidad de ámbito club sin filtro] -> Mitigación: una prueba que refleja sobre `Model.GetEntityTypes()` y falla para cualquier entidad con una propiedad `ClubId` que no tenga filtro de consulta y no esté en una lista explícita de permitidos.

### Migration Plan

- Una migración de esquema `AddSpaceTypeToClub`, generada desde el proyecto de infraestructura con `manage-migrations.ps1`: `AddColumn<int> SpaceType` NOT NULL con `defaultValue: 1` en `Clubs`. Comprobar que el archivo generado lleva el valor por defecto, para que las filas existentes pasen a Espacio personal.
- Orden de despliegue: aplicar primero la migración y después la nueva versión de la aplicación (la entidad y el filtro esperan la columna). La versión anterior de la aplicación sigue funcionando contra la nueva columna gracias al valor por defecto.
- Rollback: el método `Down` elimina la columna; los cambios de filtro y de visibilidad son solo de código y se revierten con la versión de la aplicación.
- La migración se confirma en un commit separado del código de la aplicación.

### Open Questions

- Ninguna: las tres preguntas surgidas durante la investigación están resueltas. `GetClubs` no se cachea (D6); los lectores sin membresía encontrados son la búsqueda y el borrado de auditoría para Federación y Administrador, la rama de administrador de `UpdateTeamPlayer` y los trabajos alojados, mientras que los flujos de unión anónimos (`CreateUser`, `ClubInvitationValidation`) se ejecutan sin usuario y por tanto con el filtro desactivado (D3, D4); `PlayerService` y `CreateSeason` obtienen un club solo por id conocido y no necesitan predicado de visibilidad.

### Manual Verification

- **Generated-artifact drift**: tras generar `AddSpaceTypeToClub`, confirmar que la migración y `AppDbContextModelSnapshot.cs` coinciden (no hay cambios de modelo pendientes al volver a ejecutar la herramienta de migraciones) y que la columna tiene `defaultValue: 1`.
- **End-to-end smoke across real runtimes**: aplicar la migración a una base de datos de desarrollo que ya contenga clubes, ejecutar `SELECT "SpaceType", count(*) FROM app."Clubs" GROUP BY 1` y confirmar una única fila con `SpaceType = 1` y el mismo recuento que antes; entrar como coach con un Espacio personal y llamar al listado de clubes para ver solo los espacios propios más los espacios de tipo Club.

## Step 1: Space type on Club with migration

### Interfaces

**Interfaces**:
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs`
  - `public sealed class SpaceType : SmartEnum<SpaceType>`
  - `public static readonly SpaceType PersonalSpace` (valor 1, etiqueta "Espacio personal")
  - `public static readonly SpaceType Club` (valor 2, etiqueta "Club")
  - `public string Label { get; }`
- `Club.cs`
  - `public SpaceType SpaceType { get; private set; }` (por defecto `SpaceType.PersonalSpace`)
  - `public static Club Create(<existing parameters>, SpaceType? spaceType = null)` (un `spaceType` nulo produce `SpaceType.PersonalSpace`)
- `ClubEntityConfiguration`: `SpaceType` mapeado como obligatorio, `HasDefaultValue(SpaceType.PersonalSpace)`.
- Migración `AddSpaceTypeToClub`: `AddColumn<int>(name: "SpaceType", table: "Clubs", nullable: false, defaultValue: 1)`; `Down` elimina la columna.

**Test assertions**:
- Club creado sin tipo explícito: `club.SpaceType == SpaceType.PersonalSpace` (`openspec/changes/personal-and-club-spaces/specs/space-types/spec.md`, Requirement "Every club has a space type", Scenario "New club without an explicit type").
- `SpaceType.PersonalSpace.Label == "Espacio personal"` y `SpaceType.Club.Label == "Club"`; ninguna etiqueta es igual a "PersonalSpace" (`.../space-types/spec.md`, Scenario "Type shown to the user").
- Club creado con `SpaceType.Club`: `club.SpaceType == SpaceType.Club` y se persiste como 2 al leerlo de nuevo.
- PostgreSQL: una fila insertada en `Clubs` con SQL directo que omite `SpaceType` se lee como `SpaceType.PersonalSpace`; sus filas de `UserClubs` y sus Teams no cambian (`.../space-types/spec.md`, Requirement "Existing clubs become Personal spaces", Scenario "Migration of existing clubs").

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs
- M Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Club.cs
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/ClubEntityConfiguration.cs
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddSpaceTypeToClub.cs — generated count=1
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddSpaceTypeToClub.Designer.cs — generated count=1
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SpaceTypeTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubSpaceTypePersistenceTests.cs
```

## Step 2: Hide Personal spaces from non-members in the club list

### Interfaces

**Interfaces**:
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubVisibility.cs`
  - `public static class ClubVisibility`
  - `public static IQueryable<Club> VisibleTo(this IQueryable<Club> clubs, AppDbContext db, string? userId)` (conserva un club cuando `SpaceType == SpaceType.Club` o `db.UserClubs` tiene una fila con `ApplicationUserId == userId` y `ClubId == club.Id`; un `userId` nulo conserva solo los espacios de tipo `Club`)
- `GetClubs.cs`: `ClubsResponse` gana `string SpaceTypeLabel` (aditivo, último campo); `ClubsQueryApp` sigue implementando solo `IQueryApp<...>`, nunca `ICacheRequest`.

**Test assertions**:
- Espacio personal P propiedad del usuario A; el usuario B (no miembro) lista clubes: el resultado no contiene P (`.../space-types/spec.md`, Scenario "Non-member lists clubs").
- El usuario A lista clubes: el resultado contiene P con `SpaceTypeLabel == "Espacio personal"` (`.../space-types/spec.md`, Scenario "Member lists clubs").
- Un espacio de tipo `Club` aparece para cualquier usuario con `SpaceTypeLabel == "Club"` (`.../space-types/spec.md`, Requirement "A Personal space is visible only to its members").
- Un Espacio personal creado con el mismo nombre que un club existente: la creación tiene éxito y la fila del club existente no cambia (`.../space-types/spec.md`, Scenario "Same name as another club").
- El usuario A y después el usuario B listan clubes en secuencia a través de la misma instancia del handler: el resultado de B nunca contiene el Espacio personal de A (`.../space-types/spec.md`, Scenario "Non-member lists clubs").
- Las aserciones existentes de invitación de administrador y director se mantienen cuando sus clubes son de tipo `Club` o el usuario es miembro.

## Step 3: Context wiring for the club filter, with no-user guard tests

### Interfaces

**Interfaces**:
- `AppDbContext.cs`
  - `public AppDbContext(DbContextOptions<AppDbContext> options)` (sin cambios; filtro desactivado)
  - `public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService currentUser)`
  - `public string? CurrentUserId { get; }` (nulo cuando no hay usuario)
  - `public bool ClubFilterActive { get; }` (verdadero solo cuando se construye con un servicio de usuario cuyo `IsAuthenticated` es verdadero)
- `Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/FixedCurrentUserService.cs`: `public sealed class FixedCurrentUserService(string? userId) : ICurrentUserService` (`IsAuthenticated == (userId != null)`).
- `PostgresContainerFixture`: `public AppDbContext CreateDbContext(string? userId)` (sobrecarga aditiva; el método sin parámetros existente no cambia).

**Test assertions**:
- `AddDbContext<AppDbContext>` resuelto desde un proveedor con un `ICurrentUserService("u1")` autenticado de prueba: `ClubFilterActive == true` y `CurrentUserId == "u1"`; con uno no autenticado: `ClubFilterActive == false` (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Requirement "Flows without a membership keep working").
- Contexto solo con opciones: `ClubFilterActive == false`; lee Teams de dos clubes distintos (`.../club-data-isolation/spec.md`, Scenario "Background work without an authenticated user").
- No miembro autenticado: encuentra el club por código de invitación, inserta su fila `UserClub` y la inserción tiene éxito (`.../club-data-isolation/spec.md`, Scenario "Join by invitation code").
- No miembro autenticado (contexto desde `CreateDbContext("nonMember")`, sin fila `UserClub` para ese club) ejecuta `ValidateTeamCode`, `ValidateTeamJoinCode`, `EnterClubTeamAsCoach`, `TeamInvitationValidation`, y los flujos de creación, aprobación y rechazo de solicitudes de unión con un código de unión de equipo válido: cada uno devuelve el mismo resultado de éxito que antes del cambio, y estas pruebas siguen en verde tras el Paso 4 (`.../club-data-isolation/spec.md`, Requirement "Flows without a membership keep working", Scenario "Join by invitation code").

## Step 4: Filter Team and Player with leak tests

### Interfaces

**Interfaces**:
- `AppDbContext.cs`: helper privado `Expression<Func<T, bool>> ClubScope<T>(Expression<Func<T, string?>> clubId) where T : class` que construye `!ClubFilterActive || clubId == null || UserClubs.Any(uc => uc.ApplicationUserId == CurrentUserId && uc.ClubId == clubId)`; `HasQueryFilter(ClubScope<Team>(t => t.ClubId))` y lo mismo para `Player`.
- `UpdateTeamPlayer.cs`: la consulta de la rama de administrador llama a `IgnoreQueryFilters()`; sin cambio de firma.
- `ValidateTeamCode.cs`, `ValidateTeamJoinCode.cs`, `EnterClubTeamAsCoach.cs`, `TeamInvitationValidation.cs`, `ApproveClubJoinRequest.cs`, `RejectClubJoinRequest.cs`: condicionalmente, la única consulta que lee `Team` antes de la membresía llama a `IgnoreQueryFilters()`, solo donde fallan las pruebas de guardia del Paso 3; sin cambio de firma.

**Test assertions**:
- Usuario del club B lee el Team del club A mediante `CreateDbContext("userB")`: `FirstOrDefaultAsync` devuelve null; lo mismo para Player (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Scenario "Read of another club's data", y Requirement "Isolation is proven by leak tests per filtered entity").
- Usuario del club B carga el Team del club A para modificarlo: el resultado es null; un `ExecuteUpdateAsync` masivo sobre el Team del club A a través del contexto de B devuelve 0 y la fila leída con un contexto sin filtrar no cambia; lo mismo para Player (`.../club-data-isolation/spec.md`, Scenario "Modification of another club's data").
- Miembro de los clubes A y B lista Players: el resultado contiene los Players de A y B y ninguno del club C (`.../club-data-isolation/spec.md`, Scenario "Member of several clubs").
- Miembro del club A lee el Team del club A: se devuelve (`.../club-data-isolation/spec.md`, Scenario "Member reads data of their club").
- Administrador autenticado en `UpdateTeamPlayer` para un equipo de un club al que no pertenece: sigue teniendo éxito como antes del cambio.
- Las pruebas existentes adaptadas pasan con una fila `UserClub` sembrada para su usuario de prueba.

### Tasks

**Files Affected**:
```text
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/UpdateTeamPlayer.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/ValidateTeamCode.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/EnterClubTeamAsCoach.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/TeamInvitationValidation.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/RejectClubJoinRequest.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationTeamPlayerTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamSanctionsEndpointTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamInjuriesEndpointTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/InjuryEndpointAuthorizationTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/FamilyMemberEndpointTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RatingOwnershipFilterTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateTeamPlayerSelfEditTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SetPlayerSanctionTeamFundTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/LotteryEndpointTests.cs
```

## Step 5: Filter Season and UserActivityLog with audit opt-outs

### Interfaces

**Interfaces**:
- `AppDbContext.cs`: `HasQueryFilter(ClubScope<Season>(s => s.ClubId))` y `HasQueryFilter(ClubScope<UserActivityLog>(l => l.ClubId))` (ambos `ClubId` son `string?`).
- `SearchAuditLog.cs`, `DeleteAuditLogEntries.cs`: las consultas sobre `UserActivityLogs` en las ramas de Federación y Administrador llaman a `IgnoreQueryFilters()`; sin cambio de firma.

**Test assertions**:
- Usuario del club B no puede leer ni modificar la Season ni la entrada de UserActivityLog del club A; un update masivo cambia 0 filas y la fila no cambia (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Scenarios "Read of another club's data" y "Modification of another club's data").
- Una Season con `ClubId` nulo y una entrada de auditoría con `ClubId` nulo se devuelven y son modificables para cualquier usuario autenticado; un registro de un club al que el usuario no pertenece sigue sin devolverse (`.../club-data-isolation/spec.md`, Requirement "Records without a ClubId are not hidden by the filter", Scenario "Record with a null ClubId").
- El llamante de Federación o Administrador en la búsqueda del registro de auditoría ve entradas de todos los clubes; esos mismos llamantes borran entradas de cualquier club; un director de club solo ve entradas de sus propios clubes (`.../club-data-isolation/spec.md`, Requirement "Flows without a membership keep working").
- `CreateSeason` por un coach del club A deja activas las temporadas del club B y desactiva las temporadas activas del club A (`.../club-data-isolation/spec.md`, Requirement "Club-scoped data is filtered by ClubId in the data layer").

### Tasks

**Files Affected**:
```text
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Audit/SearchAuditLog.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Audit/DeleteAuditLogEntries.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationSeasonActivityLogTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/DeleteAuditLogEntriesEndpointTests.cs
```

## Step 6: Filter TaskTrainingBase and PlayerModelBase

### Interfaces

**Interfaces**:
- `AppDbContext.cs`: `HasQueryFilter(ClubScope<TaskTrainingBase>(t => t.ClubId))` y `HasQueryFilter(ClubScope<PlayerModelBase>(m => m.ClubId))`, cada uno registrado en el tipo raíz de su jerarquía.

**Test assertions**:
- Usuario del club B no puede leer ni modificar el TaskTrainingBase ni el PlayerModelBase del club A, incluido un tipo derivado de cada jerarquía; un update masivo cambia 0 filas y la fila leída a través de un contexto sin filtrar no cambia (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Requirement "Isolation is proven by leak tests per filtered entity", Scenario "Leak test per entity").
- Un miembro del club A lee los registros del club A de ambas entidades (`.../club-data-isolation/spec.md`, Scenario "Member reads data of their club").

### Tasks

**Files Affected**:
```text
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationTaskModelTests.cs
```

## Step 7: Coverage guard and not-found response check

### Interfaces

**Interfaces**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterCoverageTests.cs`: clase de prueba que comprueba sobre `AppDbContext.Model.GetEntityTypes()` que cada tipo de entidad con una propiedad `ClubId` tiene un filtro de consulta, salvo la lista explícita `Club`, `UserClub` y los tipos de entidad de solicitud de unión.
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationEndpointTests.cs`: pruebas HTTP a través del host de pruebas.

**Test assertions**:
- Cada tipo de entidad con `ClubId` fuera de la lista explícita tiene un filtro de consulta no nulo; las seis entidades nombradas están entre ellas (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Requirement "Club-scoped data is filtered by ClubId in the data layer", Scenario "Filtered entities").
- Usuario autenticado sin membresía solicita un Team de otro club: respuesta 404 con cuerpo ProblemDetails (`.../club-data-isolation/spec.md`, Requirement "Another club's data returns not found", Scenario "Read of another club's data").
- El mismo usuario envía una modificación de ese Team: estado 404 y la fila del Team no cambia al leerla a través de un contexto sin filtrar (`.../club-data-isolation/spec.md`, Scenario "Modification of another club's data").
- Las pruebas se ejecutan contra una instancia real de PostgreSQL mediante `PostgresContainerFixture`, nunca una capa de datos simulada (`.../club-data-isolation/spec.md`, Scenario "Leak tests use a real database").

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterCoverageTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationEndpointTests.cs
```
