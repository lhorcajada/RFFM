## Why

El club tiene dos equipaciones posibles por temporada (`ClubKit`, `KitNumber` 1/2), ya
modeladas en el dominio y sembradas con datos de ejemplo (`ClubKitsSeeder`), y ya expuestas
en lectura vía `GET /api/teams/{teamId}/kits` (`GetTeamKits.cs`). No existe ningún comando
que permita crear o actualizar esos registros: un entrenador no tiene forma de configurar los
colores reales del club. En el frontend, `KitSelector.tsx` ya contempla el caso `kits.length
=== 0` pero no ofrece ninguna vía para rellenarlo. Este cambio cierra ese hueco en el
backend para que el `front-specialist` pueda construir el panel de configuración a
continuación, sobre un contrato ya definido y probado.

## What Changes

- Nuevo comando `SaveClubKits` (vertical slice, `Features/Coaches/Kits/`) que crea o
  actualiza (upsert) **las dos equipaciones a la vez** de un club+temporada, resueltos a
  partir de un `teamId` (mismo patrón de resolución que `GetTeamKits`).
- Input por equipación: `shirtColor`, `shortsColor` y `socksColor` (strings hex `#RRGGBB`,
  paleta cerrada decidida en frontend — el backend solo valida formato, no la paleta).
  **Actualización (2026-09-04):** inicialmente `socksColor` se autocompletaba igual que
  `shortsColor`; el usuario pidió después elegirlo de forma independiente, así que el
  contrato final exige los tres colores explícitos por equipación (ver `design.md` §2).
- Autorización por rol (`Coach`, `ClubMember`, `ClubDirector`, `Administrator`), mismo
  mecanismo que `DeleteSportEvent`/`DeleteLeagueMatchesBefore` (`RequireAuthorization` +
  `AuthorizeAttribute.Roles`).
- Validación FluentValidation del formato de color y de que se envían exactamente 2
  equipaciones (kit 1 y kit 2).
- `GetTeamKits` no está cacheada hoy (no implementa `ICacheRequest`), así que no hace falta
  invalidación de caché — se documenta la comprobación en `design.md` para que quede
  registrado por qué no se añade `IInvalidateCacheRequest`.

**Fuera de alcance**: borrar equipaciones, soportar más de 2 kits por temporada, guardar un
único kit de forma aislada (el contrato siempre espera los dos juntos), cualquier trabajo de
frontend (lo hace `front-specialist` sobre este contrato).

## Capabilities

### New Capabilities
- `club-kit-configuration`: permite crear/actualizar las dos equipaciones (camiseta,
  pantalón; medias derivadas) de un club para una temporada dada.

### Modified Capabilities
(ninguna — `GetTeamKits`/lectura de kits no tenía spec previa de OpenSpec)

## Impact

- Nuevo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Kits/SaveClubKits.cs`
- Modificado: `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/ClubKit.cs`
  (añade método de intención `UpdateColors` para el camino de actualización — sin tocar el
  constructor/factoría existente)
- Nuevo: `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SaveClubKitsHandlerTests.cs`
- Sin cambios de esquema/migración (la entidad, tabla e índice único
  `(ClubId, SeasonId, KitNumber)` ya existen).
- Sin cambios de frontend en el alcance backend inicial — el contrato queda documentado en
  `design.md` para que `front-specialist` construya el panel de configuración sobre él.

**Frontend delivery (2026-09-04 addendum):** `front-specialist` construyó
`Front/src/apps/coach/pages/convocations/components/KitSelector/ClubKitEditor.tsx` (paleta de
colores fija — camiseta, pantalón y medias — para las 2 equipaciones a la vez, crear o editar)
y `Front/src/apps/coach/services/kitService.ts` (`saveClubKits`). La UX final es un popup (MUI
`Dialog`) abierto desde un botón "Configurar equipación"/"Cambiar equipación" en
`ConvocationMatchHeader.tsx` (no un panel inline que empuja el contenido, como se planteó al
principio), con un resumen compacto (icono `Jersey` + "1ª/2ª equipación") visible en la
cabecera una vez hay una equipación seleccionada para el partido. El popup "Ver convocatoria"
(`ConvocationDetailsDialog.tsx`) y el texto de WhatsApp (`convocationSummary.ts`) muestran
ambas equipaciones con sus colores reales y marcan cuál se juega.
