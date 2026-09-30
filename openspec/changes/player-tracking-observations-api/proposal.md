## Why

Primera entrega (1a) del seguimiento del modelo de juego por jugador. La hoja de ruta y el diseño
completo están en `docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.

El entrenador necesita registrar, por jugador, cómo responde a lo que se entrena del modelo de juego:
«este mes hemos trabajado el subprincipio 2.3 y no lo hace». Así tiene argumentos concretos cuando una
familia pregunta por los minutos de su hijo. Esta entrega crea la base de datos y la API; la pestaña
web llega en 1b.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Entidad `PlayerModelObservation` (`Domain/Entities/TeamPlayers/`) de tipo **modelo de juego**:
    jugador, equipo, fecha, **Subprincipio** con una instantánea de sus etiquetas (Fase, Principio,
    Subprincipio), valoración de 3 niveles (`Achieved` / `Partial` / `NotAchieved`), comentario
    opcional y autor.
  - **Migración única** `AddPlayerModelObservations`. Crea también las columnas que usarán 1d, 1e y
    Fase 2 (actitud, habilidades, sesión), nullable o vacías, sin exponerlas en la API. Así las
    siguientes entregas no tocan la BD.
  - Si se borra el Subprincipio del modelo de juego, la observación se conserva (`SetNull` + etiquetas
    guardadas).
  - `POST /api/teams/{teamId}/players/{teamPlayerId}/observations` y `GET` (listado, la más reciente
    primero).
  - Solo cuerpo técnico: permiso de feature `GameModel`, que el rol Player no tiene, más pertenencia al
    equipo.
- **Versión**: API minor.

## Capabilities

### New Capabilities
- `player-tracking-observations`: registro y consulta de observaciones del modelo de juego por jugador.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/TeamPlayers/PlayerModelObservation.cs`, `ObservationKind.cs`,
    `ObservationAssessment.cs`;
  - `Infrastructure/Persistence/Configuration/Entities/PlayerModelObservationEntityConfiguration.cs`;
  - `AppDbContext`;
  - migración;
  - `Features/Coaches/PlayerTracking/CreatePlayerObservation.cs` y `GetPlayerObservations.cs`;
  - `Directory.Build.props`.
- **Fuera de alcance**:
  - UI (1b);
  - editar y borrar (1c);
  - actitud (1d);
  - habilidades (1e);
  - filtro por periodo (1f);
  - sesión, informe y focos (Fases 2-3).
