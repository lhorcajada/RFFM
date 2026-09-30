# Seguimiento del modelo de juego por jugador — diseño de referencia

Documento de referencia para el diseño completo. Se implementa en entregas pequeñas, cada una con su
propio cambio OpenSpec, su versión y su commit. Cada entrega refina el detalle que le toca; si una
entrega decide algo distinto, manda la entrega.

## Hoja de ruta

| Fase | Entrega | Alcance | Estado |
|---|---|---|---|
| 1 | **1a** `player-tracking-observations-api` | Entidad completa + migración única. Alta y listado de observaciones de modelo de juego (API) | En curso |
| 1 | 1b | Pestaña «Seguimiento»: formulario (subprincipio, fecha, valoración, comentario) + lista en tarjetas | Pendiente |
| 1 | 1c | Editar y borrar (`PUT`/`DELETE` + `ConfirmDialog`) | Pendiente |
| 1 | 1d | Observaciones de actitud (catálogo cerrado) | Pendiente |
| 1 | 1e | Habilidades implicadas (vocabulario, máx. 5) | Pendiente |
| 1 | 1f | Filtro por periodo (`from`/`to`) | Pendiente |
| 2 | 2a–2e | Selector de sesión → «qué hemos trabajado» → contexto de minutos y asistencia → tendencias → PDF (se dividirá al llegar) | Pendiente |
| 3 | 3a–3b | Focos de mejora (se dividirá al llegar) | Pendiente |

Decisiones del usuario:
- granularidad a nivel de **Subprincipio**;
- visible **solo para el entrenador**;
- **solo web**;
- **independiente** de las valoraciones.

## Context

- **Modelo de juego** (`Domain/Aggregates/GameModels/`): `GameModel` (uno por equipo y temporada) →
  `GamePrinciple` (dentro de una Fase, `GameMoment`) → `Subprincipio` → [`Zona`] → `SubSubPrincipio`
  (`Rol`, `Habilidades` con vocabulario cerrado de 28 valores).
  - `UpdateGameModel` empareja por `Key`, así que los ids de Subprincipio son estables en una edición.
  - Pero un Subprincipio que desaparece del modelo **se borra** (`_db.Subprincipios.RemoveRange`).
- **Sesiones** (`Domain/Aggregates/Training/TrainingSession.cs`):
  - `Targets` → `TrainingSessionSubSubPrincipio`;
  - `Date` es nullable (hay sesiones sin programar);
  - `SportEventId` es opcional y enlaza con la asistencia (`Convocations.AssistanceTypeId`).
  - Un SubSubPrincipio cuelga de un Subprincipio **o** de una Zona (que a su vez cuelga de un
    Subprincipio). El Subprincipio de un target se resuelve así:
    `ssp.SubprincipioId ?? ssp.Zona.SubprincipioId`.
- **Asistencia**: `AssistanceType.Attendance` (1) y `LateArrival` (4) cuentan como asistencia. Es el
  mismo criterio que `GetPlayerConvocationSummary`.
- **Minutos**: `MatchParticipations` con `MatchPhase == "finished"`. Mismo patrón que
  `GetPlayerPhysicalEvolution`.
- **Permisos**:
  - `CoachFeatureRoutes.Squad` lo puede **leer el rol Player**, así que no sirve para «solo entrenador».
  - `CoachFeatureRoutes.GameModel` está en el bloque «Blocked for Player».
  - `IRequireTeamMembership` restringe al equipo.
- **Patrón de handlers en este repo**: `IFeatureModule` + `IQueryApp`/`IRequest` de Mediator + validator
  anidado. Los handlers llaman a `SaveChangesAsync` (`CreateTeamNote`). `NotFoundException` y
  `ConflictException` se convierten en ProblemDetails. Los enums de dominio son `SmartEnum` (`NewsStatus`).

## Goals / Non-Goals

**Goals:**
- Registrar en segundos una observación sobre un jugador ligada a un Subprincipio del modelo o a un
  rasgo de actitud.
- Mantener hasta 3 focos de mejora por jugador.
- Generar un informe por periodo, listo para una conversación con la familia.
- Solo cuerpo técnico, solo web.

**Non-Goals:**
- Mobile y rol Familia.
- Que las observaciones afecten a `TeamPlayerRating`.
- Comparar jugadores.
- Alta masiva desde una sesión.
- Notificaciones.

## Decisions

### D1 · Granularidad: Subprincipio (decisión del usuario)

La observación apunta a un **Subprincipio**, por ejemplo «Ataque organizado · 2.3 Circular para
desordenar». Las sesiones apuntan a SubSubPrincipios, así que el bloque «qué hemos trabajado» los
**agrega hacia arriba** hasta su Subprincipio.

La zona no se modela en la observación: si importa («en zona de creación propia»), se escribe en el
comentario.

### D2 · Las observaciones sobreviven a cambios del modelo de juego

Una observación sirve como registro para una conversación, así que no puede desaparecer si el
entrenador reestructura su modelo.

- `SubprincipioId` es FK nullable con `OnDelete(SetNull)`.
- Al crearla se guarda una **instantánea de etiquetas**: `MomentName`, `PrincipleLabel`
  («2. Ataque posicional») y `SubprincipioLabel` («2.3 Circular para desordenar»).
- El informe y el listado muestran siempre la instantánea.
- `PlayerDevelopmentFocus.SubprincipioId` sigue el mismo patrón.

Se descarta usar `Cascade`, que es lo que hacen `ExerciseModelRelationItem` y `TrainingSessionSubSubPrincipio`:
perder historial del jugador no es aceptable.

### D3 · Dominio

`Domain/Entities/TeamPlayers/PlayerModelObservation.cs`:

```csharp
public class PlayerModelObservation : BaseEntity
{
    public static class Rules { public const int CommentMaxLength = 500; public const int MaxHabilidades = 5; }

    public string TeamPlayerId { get; private set; } = null!;
    public string TeamId { get; private set; } = null!;
    public DateOnly Date { get; private set; }
    public ObservationKind Kind { get; private set; } = null!;              // SmartEnum: GameModel(1), Attitude(2)
    public string? SubprincipioId { get; private set; }                     // Kind == GameModel
    public string? MomentName { get; private set; }                         // instantánea (D2)
    public string? PrincipleLabel { get; private set; }
    public string? SubprincipioLabel { get; private set; }
    public string? AttitudeKey { get; private set; }                        // Kind == Attitude, ∈ AttitudeTraits
    public ObservationAssessment Assessment { get; private set; } = null!;  // SmartEnum: Achieved(1), Partial(2), NotAchieved(3)
    public IReadOnlyList<string> Habilidades { get; private set; } = [];    // ⊂ Habilidad.Vocabulary, jsonb
    public string? Comment { get; private set; }
    public string? TrainingSessionId { get; private set; }                  // FK SetNull
    public string CreatedByUserId { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }

    public static PlayerModelObservation ForGameModel(string teamPlayerId, string teamId, DateOnly date,
        SubprincipioSnapshot subprincipio, ObservationAssessment assessment,
        IEnumerable<string>? habilidades, string? comment, string? trainingSessionId, string createdBy);
    public static PlayerModelObservation ForAttitude(string teamPlayerId, string teamId, DateOnly date,
        string attitudeKey, ObservationAssessment assessment, string? comment, string? trainingSessionId, string createdBy);
    public void Update(DateOnly date, ObservationAssessment assessment, IEnumerable<string>? habilidades, string? comment);
}

public record SubprincipioSnapshot(string Id, string MomentName, string PrincipleLabel, string SubprincipioLabel);
```

Qué valida el dominio (lanza `ArgumentException`, como el resto de `Domain/`):
- Kind/Subprincipio/Actitud coherentes.
- Actitud dentro de `AttitudeTraits`.
- Habilidades dentro de `Habilidad.Vocabulary`, sin duplicados y como mucho 5.
- Comentario de 500 caracteres como máximo.
- Fecha no futura.

`Update` no permite cambiar el tipo ni el Subprincipio: si están mal, se borra la observación y se crea
de nuevo.

`Domain/Entities/TeamPlayers/AttitudeTraits.cs` es un catálogo cerrado (clave → etiqueta en español):

| Key | Etiqueta |
|---|---|
| `defensive-commitment` | Implicación en tareas defensivas |
| `patience` | Paciencia con balón |
| `courage-in-duels` | Valentía en los duelos |
| `off-ball-effort` | Esfuerzo sin balón |
| `listening` | Escucha y aplicación de consignas |
| `focus` | Concentración durante la tarea |

`Domain/Entities/TeamPlayers/PlayerDevelopmentFocus.cs`:
- Campos: `TeamPlayerId`, `TeamId`, `Text` (≤ 200), `SubprincipioId?` + `SubprincipioLabel?` (D2),
  `Status` (SmartEnum `Open`/`Achieved`), `CreatedAt`, `AchievedAt?`.
- Métodos: `Create(...)`, `MarkAchieved(DateTime)`, `Reopen()`, `UpdateText(string)`.
- Regla de negocio: **máximo 3 focos abiertos por jugador**. Depende de otros registros, así que la
  comprueba el handler de alta y el de reapertura y responde `409 Conflict`.

### D4 · Persistencia

- `AppDbContext`: `DbSet<PlayerModelObservation> PlayerModelObservations`,
  `DbSet<PlayerDevelopmentFocus> PlayerDevelopmentFocuses`.
- Configuraciones en `Infrastructure/.../Configurations/`, descubiertas por reflexión:
  - SmartEnums como `int` (mismo converter que `NewsStatus`);
  - `Habilidades` como `jsonb`.
- Índices:
  - `(TeamPlayerId, Date)`;
  - `(TeamId, Date)`;
  - `(TeamPlayerId, Status)` en focos.
- FKs:
  - `TeamPlayer` → Cascade (si se borra el jugador del equipo, se va su seguimiento);
  - `Subprincipio` → SetNull;
  - `TrainingSession` → SetNull.
- Migración: `AddPlayerModelTracking`, en commit separado (`git.md` §4.2).

### D5 · Endpoints

Todas las features están en `Features/Coaches/PlayerTracking/`, un archivo por feature. Todas las
requests implementan `IRequireFeaturePermission` con `FeatureRoute = CoachFeatureRoutes.GameModel`
(`Read` para lecturas y `ReadWrite` para escrituras) e `IRequireTeamMembership`. Si el jugador no
pertenece a `teamId`, la respuesta es `404`.

| Archivo | Ruta |
|---|---|
| `GetPlayerObservations.cs` | `GET /api/teams/{teamId}/players/{teamPlayerId}/observations?from&to` → lista, la más reciente primero |
| `CreatePlayerObservation.cs` | `POST …/observations` → `201` + `Location` |
| `UpdatePlayerObservation.cs` | `PUT …/observations/{observationId}` → `200` |
| `DeletePlayerObservation.cs` | `DELETE …/observations/{observationId}` → `204` |
| `GetPlayerFocuses.cs` | `GET /api/teams/{teamId}/players/{teamPlayerId}/focuses` |
| `CreatePlayerFocus.cs` | `POST …/focuses` → `201`, o `409` si ya hay 3 abiertos |
| `UpdatePlayerFocus.cs` | `PATCH …/focuses/{focusId}` (`text?`, `status?`) → `200`, o `409` al reabrir con 3 abiertos |
| `DeletePlayerFocus.cs` | `DELETE …/focuses/{focusId}` → `204` |
| `GetPlayerTrackingCatalog.cs` | `GET /api/teams/{teamId}/player-tracking/catalog?season` → Subprincipios del modelo agrupados por Fase/Principio, actitudes y habilidades |
| `GetPlayerTrackingSessions.cs` | `GET /api/teams/{teamId}/player-tracking/sessions?from&to` → sesiones con fecha y sus Subprincipios (D1) |
| `GetPlayerTrackingReport.cs` | `GET /api/teams/{teamId}/players/{teamPlayerId}/tracking-report?from&to&season` |

`CreatePlayerObservationCommand`:

```json
{ "date": "2026-10-14", "kind": "GameModel", "subprincipioId": "…", "attitudeKey": null,
  "assessment": "NotAchieved", "habilidades": ["Pase", "Percepción"],
  "comment": "Busca el pase vertical sin que el rival esté descolocado", "trainingSessionId": "…" }
```

Validator (FluentValidation):
- campos obligatorios;
- `kind` y `assessment` parseables por nombre;
- `from ≤ to`;
- rango del informe ≤ 366 días.

En el handler:
- el Subprincipio debe pertenecer a un `GameModel` del equipo;
- la sesión debe ser del equipo;
- si no se cumple, `404`.

El handler construye `SubprincipioSnapshot` con una única consulta (Subprincipio + Principio + Fase).

### D6 · Informe

`GetPlayerTrackingReport` es un DTO calculado al vuelo, sin caché (como `GetPlayerPhysicalEvolution`):

```csharp
public record PlayerTrackingReportDto(
    DateOnly From, DateOnly To,
    ReportContextDto Context,                  // sesiones del periodo, asistidas, minutos jugador, media equipo
    TrainedSubprincipioDto[] Trained,          // Subprincipios trabajados: SessionCount, AttendedCount
    ObservationGroupDto[] GameModel,           // agrupadas por Subprincipio (instantánea)
    ObservationGroupDto[] Attitude,            // agrupadas por AttitudeKey
    FocusDto[] OpenFocuses,
    FocusDto[] AchievedInPeriod);

public record ReportContextDto(int TrainingSessions, int AttendedSessions, int PlayerMinutes, int TeamAverageMinutes, int MatchesPlayed);
public record TrainedSubprincipioDto(string SubprincipioId, string MomentName, string PrincipleLabel, string SubprincipioLabel, int SessionCount, int AttendedCount);
public record ObservationGroupDto(string Key, string MomentName, string Label,
    int Achieved, int Partial, int NotAchieved, string Trend, ObservationDto[] Items);   // Items: más antigua primero
```

- **Trained**:
  - se cuentan las sesiones del equipo con `Date ∈ [from, to]` y `Targets` resueltos a Subprincipio
    (D1), una vez por sesión y Subprincipio;
  - `AttendedCount` son las sesiones con `SportEventId` en las que el jugador tiene `Attendance` o
    `LateArrival`;
  - las sesiones sin `SportEventId` cuentan en `SessionCount` pero no pueden sumar asistencia;
  - la etiqueta sale del modelo **actual**, porque es un dato derivado y no un registro.
- **Context**:
  - `TrainingSessions` / `AttendedSessions` siguen la misma regla sobre sesiones con fecha en el rango;
  - minutos: suma de `MatchParticipations` finished del jugador en el rango;
  - `TeamAverageMinutes`: media entre los jugadores del equipo activos en el rango (`JoinedDate`/`LeftDate`).
    Es un agregado anónimo: **nunca se exponen datos de otros jugadores** (requisito de privacidad del
    informe).
- **Trend** de un grupo, sobre la valoración ordinal (Achieved = 2, Partial = 1, NotAchieved = 0):
  - `improving` si la media de la segunda mitad cronológica supera a la de la primera en ≥ 0,5;
  - `worsening` si queda ≥ 0,5 por debajo;
  - `stable` en otro caso;
  - `single` si el grupo tiene una sola observación.
  - Es una función pura en `Features/Coaches/PlayerTracking/Services/ObservationTrendCalculator.cs`,
    con tests unitarios.

### D7 · Frontend (Coach, web)

- `apps/coach/services/playerTrackingService.ts`: tipos `type` y funciones sobre el cliente Axios único.
- Hooks en `pages/player/hooks/`: `usePlayerObservations`, `usePlayerFocuses`, `usePlayerTrackingReport`,
  `usePlayerTrackingCatalog`.
- Nueva pestaña **«Seguimiento»** en `PlayerDetail.tsx`, añadida **al final** para no cambiar los
  índices de las pestañas existentes. Solo es visible si el usuario tiene `GameModel` `Read`, con el
  mismo hook de permisos que el resto de la ficha. Contiene `PlayerTrackingPanel.tsx`, con tres
  secciones:
  1. **Registrar**:
     - `ObservationForm.tsx`, con selector opcional «Sesión» (últimos 30 días, vía
       `GetPlayerTrackingSessions`). Al elegir sesión se fija la fecha y se ponen primero los
       Subprincipios de esa sesión.
     - Tipo Modelo/Actitud y selector de Subprincipio agrupado por Fase › Principio.
     - Tres botones grandes ✅ Lo hace / 🟡 A veces / ❌ No lo hace, habilidades como chips y comentario.
     - Un solo «Guardar» que mantiene sesión y fecha para encadenar observaciones.
  2. **Focos de mejora**: tarjetas, un máximo de 3 abiertos, y acciones «Conseguido», «Reabrir» y
     «Eliminar» (con `ConfirmDialog`).
  3. **Informe**:
     - `PlayerTrackingReport.tsx`, con periodo «Último mes» (por defecto), «Últimos 3 meses» o un rango
       personalizado;
     - bloques Contexto → Qué hemos trabajado → Modelo de juego → Actitud → Focos, en tarjetas y sin
       tablas (`react.md` §4);
     - «Exportar PDF» con `html2canvas` + `jspdf`, como `shared/services/pdfService`;
     - lista de observaciones con editar y eliminar (`ConfirmDialog`).
- Estilos con CSS Modules co-ubicados y tema Coach. Resultados con `rffm.show_snackbar`. Mobile-first
  a 360 px.
- **Etiquetas en español** para tipo, valoración y actitudes (memoria `feedback_ui_locale_and_mobile`):
  Lo hace / A veces / No lo hace; Mejorando / Empeorando / Estable.

## Risks / Trade-offs

- **Esfuerzo de registro**: si registrar lleva más de 2 minutos, el entrenador deja de hacerlo.
  Mitigación:
  - el formulario mantiene sesión y fecha entre altas;
  - solo son obligatorios Subprincipio o Actitud y la valoración.
  
  El alta masiva desde la sesión queda como posible fase 2.
- **Modelo de juego de otra temporada**: el catálogo usa el `GameModel` del equipo para `season`. Las
  observaciones antiguas siguen legibles gracias a la instantánea (D2).
- **Lenguaje con familias**: el informe muestra solo al jugador. `TeamAverageMinutes` es el único dato
  de equipo, y es un agregado.

## Migration Plan

Migración aditiva: dos tablas nuevas, sin tocar datos existentes. Rollback: revertir la migración.
