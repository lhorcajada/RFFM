## Why

Entrega 1g del seguimiento del modelo de juego. La hoja de ruta está en
`docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.

Una observación de modelo de juego dice *qué* subprincipio no se cumple, pero no *por qué*. Al hablar
con una familia ayuda poder concretar: «no hace bien la circulación porque falla la **percepción** y el
**pase**». El modelo de juego ya tiene un vocabulario cerrado de 28 habilidades
(`Habilidad.Vocabulary`), y la columna `Habilidades` de la observación existe desde la 1a.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Al crear una observación de modelo de juego se aceptan `habilidades`: hasta 5, sin repetir y del
    vocabulario cerrado. Las observaciones de actitud no admiten habilidades (`400`).
  - Al editar (`PUT`) también se pueden cambiar las habilidades de una observación de modelo de juego.
    Si se envían en una de actitud, la respuesta es `400`.
  - El DTO devuelve `habilidades`.
  - Sin migración.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - Selector múltiple **«Habilidades (opcional)»**, de 5 como máximo, en cada bloque de subprincipio del
    formulario de sesión, en el formulario «Sin sesión» y al editar una observación de modelo de juego.
  - Las tarjetas muestran las habilidades como chips.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-tracking-habilidades`: habilidades implicadas en las observaciones de modelo de juego.

## Impact

- `Back/ExtractionApi`:
  - `PlayerModelObservation` (`ForGameModel` y `Update`);
  - `CreatePlayerObservation`, `UpdatePlayerObservation` y `GetPlayerObservations` (DTO);
  - `ErrorCodes`.
- `Front/`:
  - `playerTrackingService.ts`;
  - `HabilidadesPicker.tsx` (nuevo);
  - `RatingBlock`, `SessionObservationForm`, `ObservationForm` y `PlayerObservationCard`.
- **Fuera de alcance**: sugerir solo las habilidades del subprincipio (el detalle de sesión no las
  trae); se ofrece el vocabulario completo.
