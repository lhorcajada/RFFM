## Why

Cada vez que alguien abre Resultados (Coach), Calendario o Jornada (Federación), el backend consulta
a la RFFM en directo: la jornada, las jornadas del grupo y la clasificación. Son tres peticiones por
pantalla y por usuario, aunque los datos sean públicos e iguales para todos y la mayoría no hayan
cambiado. Queremos guardarlos en la base de datos, compartidos entre usuarios, y consultar a la RFFM
solo cuando falten datos.

## What Changes

- Se persisten en el esquema `federation`, por grupo, los datos disponibles: grupo (competición,
  duración del partido y número de partes), jornadas (número, nombre y fecha), partidos (todos los
  campos de `api/results`), la clasificación (posiciones) y el **acta completa** de cada partido
  cerrado (alineaciones, goles, tarjetas, cambios, técnicos y árbitros).
- `GET /calendar/matchday` sirve los datos desde la BD. El primer usuario que abre una jornada que
  no está en BD provoca su descarga. Después, la jornada **solo se vuelve a pedir a la RFFM** si
  alguno de sus partidos:
  - no tiene horario (como mucho, una vez cada 6 h);
  - ha podido terminar según `inicio + minutos_juego + 10 min por descanso` y aún no tiene el acta
    cerrada (como mucho, una vez cada 10 min);
  - se juega en los próximos 7 días (como mucho, una vez al día, para detectar cambios de horario).
- La duración sale de `minutos_juego` y `numero_partes` de la competición en la RFFM, no de la
  categoría: División de Honor Cadete dura 90' y Superliga Cadete, 80'.
- La RFFM no tiene una API JSON por partido: el acta es una página de ~270 KB, frente a los ~10 KB
  de la jornada entera. Por eso el refresco se hace **por jornada** y las actas se descargan
  **en segundo plano, una sola vez**, cuando el acta se cierra.
- `GET /acta/{codActa}` devuelve el acta guardada si existe.
- El contrato HTTP no cambia; el frontend no se toca.

## Non-goals

- `GET /calendar` (el calendario completo) y el calendario de Mobile siguen como están.
- No hay marcador en directo: no se refresca durante el partido.
- No hay UI nueva para mostrar el acta.

## Capabilities

### New Capabilities
- `rffm-results-persistence`: persistencia compartida de jornadas, partidos, clasificación y actas
  de la RFFM, con refresco bajo demanda.

## Impact

- Backend (`back-specialist`): entidades en `Domain/Entities/Federation/Results/`,
  `FederationDbContext` y la migración `AddRffmResults`, `Features/Federation/MatchResults/`, y cambios
  en `GetCalendarMatchDay.cs`, `GetActa.cs` e `IRffmBackgroundClient`.
- Frontend: sin cambios.
