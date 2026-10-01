## Why

Entrega 1h, la última de la fase 1 del seguimiento del modelo de juego. El estado del trabajo está en la
planificación local; el diseño inicial, en `docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.

La conversación con una familia suele ser sobre un periodo («este mes»). Con el tiempo la lista de
observaciones de un jugador crece y hay que poder centrarse en lo reciente, en lugar de recorrer toda la
temporada.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - `GET …/observations` acepta `from` y `to` (fechas `yyyy-MM-dd`, opcionales e inclusivas), que se
    aplican sobre la fecha de la observación. Si `from` es posterior a `to`, responde `400`.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - Encima de la lista, un selector de periodo: **«Último mes»** (por defecto), «Últimos 3 meses» y
    «Todo».
  - El título indica cuántas hay: «Observaciones (N)».
  - Si una observación nueva queda fuera del periodo elegido, no se añade a la lista y se avisa.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-tracking-period-filter`: ver las observaciones de un jugador por periodo.

## Impact

- `Back/ExtractionApi`: `Features/Coaches/PlayerTracking/GetPlayerObservations.cs`.
- `Front/`:
  - `playerTrackingService.ts`;
  - `usePlayerObservations.ts`;
  - `PlayerTrackingPanel.tsx`.
- **Fuera de alcance**: rango de fechas personalizado (llegará con el informe de la fase 2).
