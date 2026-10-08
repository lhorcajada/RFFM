## Context

- El «Partido en directo» (`Front/src/apps/coach/pages/convocations/LiveMatchPage.tsx`, hook
  `useLiveMatch.ts`) se guarda con `POST /api/events/{eventId}/match-participation`
  (`SaveMatchParticipation.cs`): una fila `MatchParticipation` por jugador que participó, y en cada
  fila se repiten `ScoreLocal/Visitor`, `MatchPhase`, `GoalsJson`, `CardsJson`,
  `SubstitutionWindowsJson`, `FormationChangesJson`, `RatingSnapshotsJson`. `SportEvent.MatchDurationMinutes`
  guarda la duración real.
- **No se guarda la alineación inicial**: el directo la toma de `TeamIdealLineup` con
  `SeasonId == eventId` (`GET /api/catalog/team/{teamId}/ideal-lineup?seasonId={eventId}`), que el
  entrenador puede seguir editando después. Los jugadores convocados que no jugaron **no** tienen fila
  `MatchParticipation` (solo titulares y los que entraron).
- El acta RFFM se obtiene con `IActaService.GetMatchFromActaAsync(codActa, temporada, competicion, grupo)`
  (`FederationGetActa`, `GET /acta/{codActa}`), que necesita competición y grupo que el front de
  Federación toma de los ajustes del usuario. `SportEvent.CodActa` existe para partidos sincronizados.
- Permisos: `CoachFeatureRoutes.Convocations` tiene `Read` para `Player` y `FamilyMember` (seed en
  `WebApplicationExtensions.cs`); `IRequireTeamMembership` limita Player/FamilyMember a su equipo.
- Front «Calendario» = `pages/convocations/Convocations.tsx` (`MatchCard` escritorio + `AgendaList`
  móvil, ambos con `NormalizedMatch` que trae `eventId`, `codacta`, `isFinished`, `matchCategory`).
  «Resultados» = `pages/results/Results.tsx` con `RoundPanel` (calendario RFFM, `hideActaButton`).
- Mobile: `CalendarScreen`, `FriendliesScreen`, `TournamentsScreen` usan `EventCard` (`SportEvent`
  con `id`); `LeagueScreen` usa `GET /api/mobile/teams/{teamId}/calendar` (sin `codActa`).

## Goals / Non-Goals

**Goals**: regla de disponibilidad única en backend; pantalla de acta en Front y Mobile para todos los
roles del equipo; datos del directo ya resueltos (nombres/posiciones) para no duplicar parseo de JSON
en dos clientes; alineación inicial fiable.

**Non-Goals**: editar el acta; mostrar valoraciones; dibujar cambios de esquema a mitad de partido;
cambiar la pantalla de Federación más allá de mover sus componentes de acta.

## Decisions

### D1 · Disponibilidad en un índice por equipo (`GetTeamMatchReports`)

`Features/Coaches/MatchReports/GetTeamMatchReports.cs` — `GET /api/teams/{teamId}/match-reports`.

```csharp
public record TeamMatchReportsQuery : IQueryApp<MatchReportAvailability[]>, IRequireFeaturePermission, IRequireTeamMembership
{
    public string TeamId { get; set; } = null!;
    public string FeatureRoute => CoachFeatureRoutes.Convocations;
    public string RequiredPermission => "Read";
}
public record MatchReportAvailability(string EventId, string? CodActa, bool HasLiveReport, bool HasFederationReport);
```

- `hasLiveReport`: existe `MatchParticipation` del evento con `MatchPhase == "finished"`.
- `hasFederationReport`: `MatchCategory == "League"` (misma derivación de `EventTypeId` que usa
  `GetSportEvents`, extraída a un helper estático `MatchReportRules` en la carpeta de la feature para
  no duplicarla entre los tres endpoints), `CodActa` no vacío y `LocalGoals`/`VisitorGoals` no vacíos.
- Se devuelven solo eventos con algún flag. Una sola consulta (`SportEvents` del equipo con
  subconsulta `Any` sobre `MatchParticipations`), `AsNoTracking`.

**Por qué un índice y no flags en cada listado**: los cuatro listados (calendario web, resultados web
desde RFFM, eventos móvil, liga móvil desde RFFM) tienen DTOs distintos y dos de ellos no son eventos
propios sino el calendario RFFM. El índice se cruza por `eventId` (calendarios) o por `codActa`
(resultados/liga), con una sola implementación de la regla. Coste: una petición extra por pantalla,
cacheable. Sin caché de servidor (debe reflejar el guardado del directo al momento).

### D2 · Informe del directo resuelto en backend (`GetMatchReport`)

`Features/Coaches/MatchReports/GetMatchReport.cs` — `GET /api/events/{eventId}/match-report`.
Patrón del endpoint igual que `GetMatchParticipation` (carga el evento para obtener `TeamId`; 404 con
`DomainException("Evento", …, "EventNotFound")` si no existe).

```csharp
public record MatchReportResponse(
    string EventId, string TeamName, string? TeamPhotoUrl, string? RivalName, string? RivalPhotoUrl,
    bool IsHomeMatch, DateTime? Date, string? LocalGoals, string? VisitorGoals, string? MatchCategory,
    bool HasLiveReport, bool HasFederationReport, LiveMatchReport? Live);

public record LiveMatchReport(
    string? FormationName, int? MatchDurationMinutes,
    List<ReportPlayer> Starters, List<ReportPlayer> Bench,
    List<ReportGoal> Goals, List<ReportCard> Cards, List<ReportSubstitutionWindow> SubstitutionWindows);

public record ReportPlayer(string TeamPlayerId, string Name, int? Dorsal, string? PhotoUrl, int? SlotIndex, int MinutesPlayed);
public record ReportGoal(int Minute, string? ScorerName, int? ScorerDorsal, bool IsOwnTeam, int ScoreLocal, int ScoreVisitor);
public record ReportCard(int Minute, int Half, string CardType, string? PlayerName, int? RivalDorsal, bool IsRivalPlayer);
public record ReportSubstitutionWindow(int WindowIndex, bool IsHalftime, int Minute, int Half, List<ReportSwap> Swaps);
public record ReportSwap(string InPlayerName, string? OutPlayerName);
```

- Parseo de `GoalsJson`/`CardsJson`/`SubstitutionWindowsJson` con `System.Text.Json`
  (`JsonSerializerOptions.Web`), tolerante a JSON nulo/corrupto (lista vacía), en una clase interna
  `LiveMatchReportBuilder` (pura, testeable sin BD) dentro de la carpeta de la feature.
- Orden: goles y tarjetas por minuto (estable); ventanas por minuto con la de descanso
  (`isHalftime`) en su sitio cronológico; nombre del jugador = alias del `Player` (mismo dato que
  `GetEventConvocations`), dorsal del `TeamPlayer`.
- **Banquillo** = convocados del evento (`Convocations` con estado convocado, mismo filtro que la
  ficha del partido) − titulares, con minutos de su `MatchParticipation` o 0. Se añaden también
  jugadores con participación no titular que no estén en convocatoria (defensivo).
- **Titulares y posiciones**: de `StartingLineupJson` (D4) si existe; si no, de `TeamIdealLineup`
  con `SeasonId == eventId` cruzado con `IsStarter`; titular sin hueco → `SlotIndex = null`.
  `FormationName` desde el JSON o `TeamIdealLineup.Formation.Name`.

### D3 · Acta de federación por evento (`GetEventFederationActa`)

`Features/Coaches/MatchReports/GetEventFederationActa.cs` — `GET /api/events/{eventId}/federation-acta`.
Resuelve `CodActa` del evento y `Team.RffmCompetitionId/RffmGroupId`, temporada
`RffmOptions.CurrentSeasonId`, y llama a `IActaService.GetMatchFromActaAsync` (con su caché propia).
404 (`ProblemDetails`) si `hasFederationReport` es false o el servicio devuelve null. Devuelve
`MatchRffm` (el mismo contrato que `/acta/{codActa}`), así el front reutiliza el tipo `Acta`.

### D4 · Guardar la alineación inicial

- `MatchParticipation.StartingLineupJson` (`string?`, `text`), incluido en `Create` y `Update`; en
  `Update` solo se sobrescribe si llega no nulo. Migración `AddStartingLineupToMatchParticipation`
  (commit separado).
- `SaveMatchParticipationRequest.StartingLineupJson` opcional.
- Front: `useLiveMatch` ya guarda `initialSlotsRef`; `PartidoEnDirectoTab` conoce `formationId` y
  `formations`. Se añade `startingLineupJson: JSON.stringify({ formationId, formationName, slots })`
  al payload: `useLiveMatch` recibe en `options` un `getStartingFormation(): {id,name} | null` para
  no acoplar el hook a la lista de esquemas. `LiveMatchParticipationPayload.startingLineupJson?`.

### D5 · Front: componentes de acta a `shared/`

Los componentes de `apps/federation/components/acta/*` (`Lineup`, `Goals`, `GoalCard`,
`Substitutions`, `Amonestaciones`, `TechnicalStaff`, `Referees`, `FieldInfo`, `ActaHeaderDate`) y el
tipo `apps/federation/types/acta.ts` pasan a ser usados por ambas apps → se mueven a
`src/shared/components/acta/` y `src/shared/types/acta.ts` (con sus `.module.css` y tests), y se
actualizan los imports de `federation/pages/Acta/Acta.tsx`. `onPlayerClick` ya es opcional en coach
(sin popup de jugador federado). Se revisa visualmente en ambos temas (rule react.md §5); colores
hardcodeados que choquen con el tema oscuro se pasan a `theme.palette` / variables de `:root`.

Se extrae `ActaContent` (`shared/components/acta/ActaContent/ActaContent.tsx`) con el bloque de
secciones que hoy está inline en `Acta.tsx`; la página de Federación y la pestaña de coach lo usan.

### D6 · Front: página `MatchReport`

- Ruta `coach/match-report?eventId=&teamId=` (lazy) con `RequireFeaturePermission`
  `Convocations` (sin `allowPlayerAccess={false}` → jugadores y familia entran).
- `apps/coach/services/matchReportService.ts`: `getTeamMatchReports(teamId)`,
  `getMatchReport(eventId)`, `getEventFederationActa(eventId)` (tipos `type` exportados).
- `apps/coach/hooks/useTeamMatchReports.ts`: carga el índice y expone
  `byEventId: Record<string, MatchReportAvailability>` y `byCodActa`.
- `pages/matchReport/MatchReport.tsx` (cabecera con marcador + `Tabs` MUI solo si hay 2 pestañas).
  - `components/FederationActaTab.tsx` → carga perezosa al mostrarse, `ActaContent`.
  - `components/LiveReportTab.tsx` → secciones en tarjetas: `LiveReportPitch` (campo con
    `FORMATION_POSITIONS[formationName]` y fichas con nombre/dorsal/minutos, mismo estilo de campo que
    la alineación), `LiveReportBench`, `LiveReportGoals`, `LiveReportCards`,
    `LiveReportSubstitutions` (descanso + «Ventana 1…4»). Sin tablas.
- Botón «Ver acta»: prop opcional `onViewReport?: (match) => void` en `MatchCard` y `AgendaList`
  (con `stopPropagation`); `Convocations` lo pasa cuando `byEventId[match.eventId]` existe.
  `RoundPanel` recibe `renderMatchAction?: (match) => ReactNode` y `Results` pinta el botón para el
  partido cuyo `codacta` está en `byCodActa` (el `RoundPanel` de Federación no cambia).

### D7 · Mobile

- `src/api/matchReports.ts` (funciones tipadas, mismo contrato).
- `screens/MatchReportScreen.tsx` registrado como `MatchReport` en `CalendarStack` y
  `CompetitionStack` (params `eventId`, `teamId`). Pestañas con dos botones segmentados propios
  (sin nueva dependencia). Patrón loading/error/data de `react-native.md` §2.
- `screens/components/matchReport/`: `LiveReportPitch` (posiciones duplicadas conscientemente en
  `src/utils/formationPositions.ts` a partir de `Front/src/apps/coach/types/formation.ts`),
  `LiveReportSections` (banquillo, goles, tarjetas, ventanas como listas verticales),
  `FederationActaView` (alineaciones, goles, cambios y tarjetas del acta RFFM en tarjetas; sin
  árbitros/cuerpo técnico — se puede ampliar).
- `EventCard`: prop opcional `onViewReport?: (eventId) => void`; `Calendar/Friendlies/Tournaments`
  la pasan si el evento está en el índice. `LeagueScreen`: el `MobileMatchDto` gana `CodActa`
  (backend, `GetTeamCalendar`) para cruzar con el índice y pintar el botón en el partido propio.

## Risks / Trade-offs

- **Acta RFFM lenta o caída** → la pestaña Federación carga aparte y muestra error sin romper la
  pestaña de directo.
- **Partidos guardados antes del cambio** → fallback a `TeamIdealLineup` del evento; si el entrenador
  la cambió después, las posiciones pueden no coincidir (aceptado; sin backfill).
- **Mover componentes de acta** puede romper estilos en Federación → tests existentes + revisión
  visual en ambos temas.
- **Duplicar `FORMATION_POSITIONS` en Mobile** → divergencia si se añaden esquemas; se documenta en
  el archivo de Mobile.

## Migration Plan

1. Migración `AddStartingLineupToMatchParticipation` (columna nullable, sin backfill).
2. Desplegar API antes que Web/Mobile (los clientes nuevos dependen de los endpoints nuevos; el
   campo extra del guardado es opcional, compatible con clientes antiguos).
