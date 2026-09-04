## Context

`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/ClubKit.cs` ya existe: entidad
con factoría `Create(clubId, seasonId, kitNumber, shirtColor, shortsColor, socksColor)`,
`kitNumber` 1 o 2, columnas `ShirtColor`/`ShortsColor`/`SocksColor` de `HasMaxLength(7)` y un
índice único `(ClubId, SeasonId, KitNumber)`
(`ClubKitEntityConfiguration.cs`). Los datos de seed (`ClubKitsSeeder.cs`) ya usan hex de 7
caracteres (`"#0000FF"`), y el frontend (`Jersey.tsx`, prop `primary`) ya consume colores en
ese mismo formato hex por defecto (`"#0b63d6"`) — confirma que el color es hex, no un nombre
de color.

Lectura existente: `GET /api/teams/{teamId}/kits` (`Features/Coaches/Kits/GetTeamKits.cs`),
resuelve `ClubId`/`SeasonId` a partir de `teamId` vía `AppDbContext.Teams`, y devuelve un
array `ClubKitResponse[]` (`KitNumber, ShirtColor, ShortsColor, SocksColor`) ordenado por
`KitNumber`. Esa query **no** implementa `ICacheRequest` (revisado en
`Common/Behaviors/CachingBehavior.cs` — solo cachea si el mensaje implementa `ICacheRequest`
Y `IBaseQuery`), así que hoy no pasa por caché en absoluto.

No hay ningún comando de escritura para `ClubKit`. El comando hermano más cercano en el mismo
dominio es `Features/Coaches/SportEvents/Commands/UpdateEventKit.cs` (selección de kit por
evento, no configuración de colores) — sirve de referencia de estilo Minimal API +
`AppDbContext` directo, pero no de referencia de autorización (no tiene
`RequireAuthorization`). El patrón de autorización por rol real y activo en el repo, con
exactamente el conjunto de roles pedido, está en
`Features/Coaches/SportEvents/Commands/DeleteSportEvent.cs` /
`DeleteLeagueMatchesBefore.cs`:
`.RequireAuthorization(new AuthorizeAttribute { Roles = "Administrator,Coach,ClubDirector,ClubMember" })`.
Se sigue ese patrón en vez del de `UpdateEventKit.cs`.

## Goals / Non-Goals

**Goals:**
- Un único comando que cree o actualice (upsert) las dos equipaciones de un club+temporada
  en una sola llamada/transacción.
- Contrato de request/response estable y documentado para que `front-specialist` construya
  el panel de configuración sin ida y vuelta.
- Reutilizar el índice único ya existente `(ClubId, SeasonId, KitNumber)` para decidir
  create vs. update — no se necesita migración.

**Non-Goals:**
- Borrar equipaciones existentes.
- Soportar un número de kits distinto de 2 (siempre exactamente kit 1 + kit 2 juntos).
- Validar el color contra una paleta cerrada — eso es una decisión de UI en el frontend; el
  backend solo valida formato hex.
- Cambiar `GetTeamKits` (no necesita cache-invalidation porque no está cacheada).
- Trabajo de frontend (lo hace `front-specialist` sobre este contrato).

## Decisions

### 1. Ruta y verbo HTTP
`PUT /api/teams/{teamId}/kits` — mismo recurso de colección que `GET
/api/teams/{teamId}/kits`, verbo `PUT` porque la operación es un reemplazo idempotente del
estado completo de las dos equipaciones del club+temporada (no un `PATCH` parcial de un solo
campo, ni un `POST` de creación de un recurso nuevo cada vez — llamar dos veces con el mismo
body dos veces dejará el mismo estado). Resuelve `ClubId`/`SeasonId` a partir de `teamId`
igual que `GetTeamKits.Handler`, para que el frontend nunca tenga que conocer o enviar
`clubId`/`seasonId` directamente (mismo principio que la query ya expone).

### 2. Forma del contrato

Request (`SaveClubKitsRequest`, body JSON):

```json
{
  "kits": [
    { "kitNumber": 1, "shirtColor": "#0000FF", "shortsColor": "#0000FF", "socksColor": "#0000FF" },
    { "kitNumber": 2, "shirtColor": "#FF0000", "shortsColor": "#FFFFFF", "socksColor": "#111111" }
  ]
}
```

- `kits` debe contener **exactamente 2 elementos**, con `kitNumber` 1 y 2 (uno de cada, sin
  duplicados) — validado por FluentValidation, no por convención de posición en el array (el
  frontend puede enviarlos en cualquier orden).
- `shirtColor` / `shortsColor` / `socksColor`: string hex `#RRGGBB` (7 caracteres, `#` + 6
  dígitos hexadecimales), los tres obligatorios.

**Actualización (2026-09-04):** el enunciado inicial autocompletaba `socksColor` con el mismo
valor que `shortsColor` porque el request no lo incluía. El usuario ahora quiere elegir el
color de las medias de forma independiente, así que el request pasa a exigir `socksColor`
explícito por cada kit — igual formato y misma validación (`NotEmpty()` +
`^#[0-9A-Fa-f]{6}$`) que `shirtColor`/`shortsColor`. El handler usa directamente
`kitRequest.SocksColor` (ya no deriva nada de `ShortsColor`). No hace falta migración: la
columna `SocksColor` en `ClubKit` ya existía (`HasMaxLength(7)`), solo cambia de dónde viene
el valor.

Response (`200 OK`, mismo DTO que `GetTeamKits.ClubKitResponse` para que el frontend pueda
reusar el mismo tipo tras guardar):

```json
[
  { "kitNumber": 1, "shirtColor": "#0000FF", "shortsColor": "#0000FF", "socksColor": "#0000FF" },
  { "kitNumber": 2, "shirtColor": "#FF0000", "shortsColor": "#FFFFFF", "socksColor": "#FFFFFF" }
]
```

Ordenado por `KitNumber` ascendente, igual que `GetTeamKits`.

Errores:
- `team` con `teamId` inexistente → `404 Not Found` (`ProblemDetails`), vía
  `RFFM.Api.Domain.NotFoundException` (mismo tipo que usa `SaveTeamRules.cs` para el mismo
  caso — el pipeline `ProblemDetails` de Hellang ya sabe mapearlo).
- Validación de formato/cantidad de kits → `400 Bad Request`
  (`ValidationProblemDetails` vía `ValidationBehavior`, patrón FluentValidation estándar del
  proyecto).
- Rol no autorizado → `403 Forbidden` (vía `RequireAuthorization` + `AuthorizeAttribute`,
  igual que `DeleteSportEvent`).

### 3. Formato de color: hex `#RRGGBB`

Decisión explícita porque el enunciado deja abierto "nombre de color o código hex": se elige
**hex de 7 caracteres** porque (a) es el formato que ya usan los datos de seed
(`ClubKitsSeeder`) y la columna EF (`HasMaxLength(7)`), y (b) es lo que `Jersey.tsx` consume
directamente como `primary`/`--jersey-primary` sin conversión. Un nombre de color habría
exigido una capa de traducción nombre→hex en el frontend que ya no hace falta. Regex de
validación: `^#[0-9A-Fa-f]{6}$`.

### 4. Upsert por índice único existente, sin nueva migración
El handler busca los `ClubKit` existentes para `(ClubId, SeasonId)` con
`AsNoTracking()` desactivado (se necesitan trackeados para `SaveChangesAsync`), indexa por
`KitNumber`, y por cada entrada del request: si existe un `ClubKit` con ese `KitNumber` lo
actualiza con un nuevo método de intención en la entidad (`UpdateColors(shirtColor,
shortsColor, socksColor)` — no había ningún método de mutación en `ClubKit`, solo la
factoría `Create`); si no existe, crea uno nuevo vía `ClubKit.Create(...)` y lo añade al
`DbSet`. Los dos kits se guardan en un único `SaveChangesAsync` (una sola transacción
implícita de EF Core) — cumple el criterio de "una sola llamada/transacción".

Alternativa descartada: dos comandos separados (uno por kit). Se descarta porque el
frontend edita ambos kits en el mismo panel y el enunciado pide explícitamente guardar
ambos juntos; forzar dos llamadas HTTP introduciría un estado intermedio inconsistente si
la segunda falla.

### 5. Autorización
`.RequireAuthorization(new AuthorizeAttribute { Roles =
"Administrator,Coach,ClubDirector,ClubMember" })` en el `MapPut`, replicando exactamente el
mecanismo y el conjunto de roles de `DeleteSportEvent.cs`/`DeleteLeagueMatchesBefore.cs`. Se
descarta `IRequireFeaturePermission` (usado en otra zona del código, `Features/Mobile/...`)
porque el resto del feature `Coaches/Kits` y sus hermanos directos (`SportEvents/Commands`)
no lo usan — se sigue el patrón del vecino más cercano, no el de otra área del código.

### 6. Caché
`GetTeamKits.TeamKitsQuery` no implementa `ICacheRequest` → no pasa por
`CachingBehavior` → no hay nada que invalidar. Se documenta aquí en vez de añadir
`IInvalidateCacheRequest` al comando "por si acaso", para que quede explícito que la
ausencia es una comprobación deliberada y no un olvido. Si en el futuro se cachea
`GetTeamKits`, este comando deberá añadir `IInvalidateCacheRequest` con
`PrefixCacheKey` igual al prefijo de esa query.

### 7. Validación (FluentValidation)
Sigue el patrón de `UpdateClubValidator`/`SaveTeamRules.Validator` (validador anidado en el
mismo archivo, `AbstractValidator<TCommand>`):
- `Kits`: `NotEmpty()`, `Must(k => k.Count == 2)`, `Must(k => k contiene exactamente
  KitNumber 1 y 2 sin duplicados)`.
- Por cada kit (`RuleForEach`): `KitNumber` en `{1,2}`; `ShirtColor`/`ShortsColor`
  `NotEmpty()` + `Matches(@"^#[0-9A-Fa-f]{6}$")`.

### 8. Entidad de dominio: nuevo método `UpdateColors`
`ClubKit` no tiene ningún método de mutación hoy (solo `Create`). Se añade:

```csharp
public void UpdateColors(string shirtColor, string shortsColor, string socksColor)
{
    ShirtColor = shirtColor;
    ShortsColor = shortsColor;
    SocksColor = socksColor;
}
```

Sin validación de formato dentro del método (esa es responsabilidad del validator de
entrada, igual que el resto de comandos del repo separan validación de formato de reglas de
invariante de dominio) — el único invariante de dominio real de `ClubKit` (`kitNumber` 1 o
2) ya vive en `Create` y no cambia con esta actualización de colores.

## Risks / Trade-offs

- [Enviar solo 1 kit o kits duplicados] → Mitigado por el validator (`Count == 2` + números
  distintos 1 y 2), responde `400` antes de tocar la base de datos.
- [Condición de carrera entre dos guardados simultáneos del mismo club+temporada] → El
  índice único de BD ya existente sigue siendo la última línea de defensa; fuera de alcance
  optimizar concurrencia más allá de eso (no se ha pedido, y no hay patrón de
  `RowVersion`/optimistic concurrency en `ClubKit` hoy).
- [Color hex sin validar contra paleta permitida] → Aceptado explícitamente por el
  enunciado: la paleta es una decisión de frontend, no una regla de negocio de backend.

## Open Questions

Ninguna — todas las decisiones abiertas del enunciado (formato de color, mecanismo de
autorización, necesidad de invalidar caché) quedan resueltas arriba.
