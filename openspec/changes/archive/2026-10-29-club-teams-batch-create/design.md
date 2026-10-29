## Context

`CreateTeam.tsx` (`/coach/clubs/:id/teams/new`) crea un equipo con `POST api/catalog/team` (`multipart/form-data`, `CreateTeamCommand`). `SeasonId` es obligatorio: el servicio de front lo rellena con la temporada activa (`seasonService.getActiveSeason`). `GET api/catalog/teams?clubId=` ya devuelve los equipos de la **temporada activa** del club con su categoría (`category.id`, `category.name`), por lo que el front puede deducir qué letras existen sin endpoint nuevo. `ClubTeamCard` pinta un icono (`GroupsIcon`) cuando no hay foto.

## Goals / Non-Goals

**Goals**
- Crear en una petición N equipos `{Categoría} {Letra}` de una categoría, omitiendo los existentes (club + temporada) en cliente y servidor.
- Formulario con dos modos, responsive, siguiendo el diseño aprobado (`.design/teams-new`).
- Escudo genérico para equipos sin foto.

**Non-Goals**: ver `proposal.md`.

## Decisions

### Backend — `Features/Coaches/Teams/Commands/CreateTeamsBatch.cs` (1 feature = 1 archivo)

- **Endpoint**: `POST api/catalog/teams/batch`, cuerpo **JSON** (no hay archivo, así que no `multipart`). Tags `TeamConstants.TeamFeature`; `Produces<CreateTeamsBatchResponse>(200)` y `ProblemDetails` 400.
- **Contrato**:
  ```csharp
  public record CreateTeamsBatchRequest(string ClubId, string SeasonId, int CategoryId, int? LeagueId, string[] Letters);
  public record CreateTeamsBatchCommand(CreateTeamsBatchRequest Request) : ICommand<CreateTeamsBatchResponse>, IInvalidateCacheRequest, IRequireFeaturePermission;
  public record CreatedTeamDto(string Id, string Name);
  public record CreateTeamsBatchResponse(CreatedTeamDto[] Created, string[] Skipped);
  ```
  `IInvalidateCacheRequest` con `TeamConstants.CachePrefix`; `FeatureRoute = CoachFeatureRoutes.ClubTeams`, `RequiredPermission = "ReadWrite"` (igual que `CreateTeam`).
- **Validador** (FluentValidation): `ClubId`, `SeasonId` no vacíos; `CategoryId > 0`; `Letters` no vacío, ≤ 26, cada elemento coincide con `^[A-Za-z]$`, sin repetidos (tras normalizar a mayúscula). Errores → `ProblemDetails` 400 por el pipeline existente.
- **Handler**:
  1. Cargar `Category` por id (si no existe → `DomainException`, como el resto de features).
  2. Nombre objetivo por letra: `{category.Name} {LETRA}` (letra en mayúscula).
  3. Una consulta `AsNoTracking` de los nombres de `Teams` con `ClubId` + `SeasonId` (comparación sin distinguir mayúsculas ni espacios laterales); los coincidentes van a `Skipped`.
  4. Para el resto, `new Team(new TeamModel { Name, ClubId, CategoryId, LeagueId, SeasonId, UrlPhoto = null })` (el `JoinCode` lo genera la entidad), `AddRangeAsync` y **un único** `SaveChangesAsync`.
  5. Devolver `Created` (id + nombre) y `Skipped` (nombres). Si todo se omite → 200 con `Created` vacío (no es error).
- **Concurrencia**: no hay índice único de nombre; dos lotes simultáneos podrían duplicar. Se acepta (uso manual y poco frecuente); no se añade migración.
- **Descartado**: reutilizar `CreateTeam` en bucle desde el front (N peticiones, sin atomicidad, deduplicación solo en cliente).

### Frontend

- **Servicio** `teamService.createTeamsBatch(clubId, { categoryId, leagueId, letters, seasonId? })`: resuelve `seasonId` con la temporada activa igual que `createTeam` y hace `client.post("/api/catalog/teams/batch", body)`; tipos `CreateTeamsBatchResponse` co-ubicados.
- **Lógica pura** `apps/coach/pages/clubTeams/create/teamBatch.ts`: `LETTERS` (A–Z), `buildTeamName(categoryName, letter)`, `getExistingLetters(teams, categoryId, categoryName)` (equipos de esa categoría cuyo nombre es `{categoría} {letra}`, sin distinguir mayúsculas), `lettersRange(count, existing)` para los atajos. Testeable sin DOM.
- **Componentes** (CSS Modules co-ubicados, tokens de `:root`/tema, sin `style={{}}` ni tablas):
  - `CreateTeam.tsx`: estado `mode` (`single` | `batch`), reutiliza el formulario actual para `single`; en `batch` carga `getTeams(clubId)` una vez para calcular letras existentes por categoría. Al cambiar de categoría se vacía la selección.
  - `components/TeamLettersPicker.tsx`: cuadrícula `repeat(auto-fill, minmax(64px, 1fr))` de botones con `aria-pressed`, deshabilitados con etiqueta «existe», más los atajos A–D, A–H, A–Z y Limpiar (≥44px).
  - `components/BatchSummary.tsx`: contadores «se crearán» / «ya existen», lista de nombres con insignia «Nuevo» y botón «Crear N equipos» (deshabilitado con N = 0). En escritorio es una columna lateral y en móvil se apila debajo (`flex-wrap`, patrón del diseño).
  - `apps/coach/components/TeamCrest/TeamCrest.tsx`: SVG del escudo genérico (`role="img"`, `aria-label`), usado en el aviso «Foto del equipo» del formulario, en el resumen y como fallback en `ClubTeamCard` en lugar de `GroupsIcon`.
- **Envío**: en `batch`, `createTeamsBatch`; éxito → `rffm.show_snackbar` («N equipos creados» y, si procede, «M ya existían») y navegación como hoy (`/coach/settings` si viene de ajustes, si no `/coach/clubs/:id/teams`); error → snackbar de error con el `detail` de `ProblemDetails` o un texto genérico, sin perder el estado.
- **Selector «Un equipo / Varios equipos»**: botones con `aria-pressed` en un `role="group"`; modo por defecto `single` para no alterar el flujo actual.

### Pruebas

- **Back** (xUnit + Moq, `RFFM.Api.Tests/UnitTests`): validador (vacío, letra inválida, repetidas, > 26, ids vacíos) y handler (crea todas; omite existentes sin distinguir mayúsculas; todo omitido → `Created` vacío; categoría inexistente; sin foto).
- **Front** (Vitest + Testing Library, `__tests__/`): `teamBatch` (nombres, existentes, rangos), `TeamLettersPicker` (bloqueadas, atajos, toggle), `BatchSummary` (contadores, botón deshabilitado), `CreateTeam` (modo `single` intacto, modo `batch` envía letras al servicio, reinicio al cambiar categoría, snackbar/navegación, error), `ClubTeamCard` (escudo sin foto) y `teamService.createTeamsBatch`.

## Risks / Trade-offs

- Las letras existentes se calculan por nombre `{Categoría} {Letra}`; un equipo con otro nombre en la misma categoría no bloquea ninguna letra. El servidor es la fuente de verdad y reporta lo omitido.
- `GetTeams` solo lista equipos de la temporada activa; el lote crea en esa misma temporada, así que ambos criterios coinciden.
- El escudo es un recurso del front: solo cambia `ClubTeamCard`; otras vistas con `GroupsIcon` no se tocan (no se amplía el alcance).
