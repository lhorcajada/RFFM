## Why

Entrega 1f del seguimiento del modelo de juego. La hoja de ruta está en
`docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.

Muchas de las cosas que el entrenador quiere poder explicar a una familia no son del modelo de juego
sino de **actitud**: «se aburre en las tareas defensivas», «entra con miedo a los duelos», «no tiene
paciencia». Hoy solo se pueden registrar observaciones de un subprincipio. El entrenador ha decidido que
la actitud se valore **en el mismo formulario de sesión**, después del entrenamiento y junto a los
subprincipios.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nuevo tipo de observación **Actitud**, con un catálogo cerrado de 6 rasgos:
    - implicación en tareas defensivas;
    - paciencia con balón;
    - valentía en los duelos;
    - esfuerzo sin balón;
    - escucha y aplicación de consignas;
    - concentración durante la tarea.
  - `POST …/observations` acepta `kind` (`GameModel` por defecto, o `Attitude`) y `attitudeKey`.
  - El DTO devuelve `attitudeKey` y `attitudeLabel`.
  - Editar y borrar funcionan igual para los dos tipos.
  - Sin migración: las columnas `Kind` y `AttitudeKey` existen desde la 1a.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - En el formulario de sesión, debajo de los subprincipios, un bloque **«Actitud»** con los 6 rasgos.
    Cada rasgo tiene los tres botones y un comentario, con las mismas reglas: solo se guarda lo que se
    valora, y si el jugador no asistió el comentario es obligatorio.
  - La actitud se puede valorar aunque la sesión no tenga subprincipios asociados.
  - Las tarjetas de actitud muestran «Actitud» y el rasgo en lugar de Fase · Principio y subprincipio.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-tracking-attitude`: observaciones de actitud por jugador desde la sesión.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/TeamPlayers/` (`ObservationKind`, `AttitudeTraits` nuevo, `PlayerModelObservation`);
  - `Features/Coaches/PlayerTracking/CreatePlayerObservation.cs` y `GetPlayerObservations.cs`.
- `Front/`:
  - `playerTrackingService.ts`;
  - `SessionObservationForm.tsx`;
  - `PlayerObservationCard.tsx`;
  - `PlayerTrackingPanel.tsx` (texto de confirmación de borrado).
- **Fuera de alcance**:
  - actitud en el formulario «Sin sesión»;
  - editar el catálogo de rasgos desde la app.
