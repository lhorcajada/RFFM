## Context

- `GetPlayerObservations.Query` hoy solo recibe `TeamId` y `TeamPlayerId`, y devuelve todas las
  observaciones de la más reciente a la más antigua, con un *left join* a la sesión.
- En el front, `usePlayerObservations(teamId, teamPlayerId)` carga la lista. `create` inserta lo creado y
  reordena; `update` y `remove` sustituyen o quitan.
- La fecha de una observación nunca es futura (validators de creación).

## Decisions

### D1 · API

- `Query.From` y `Query.To`, de tipo `DateOnly?`. Se enlazan desde la query string en el endpoint
  (`DateOnly? from, DateOnly? to`).
- Validator: si vienen los dos, `From <= To`.
- El filtro es inclusivo: `(!From.HasValue || o.Date >= From) && (!To.HasValue || o.Date <= To)`.

### D2 · Front

- `getPlayerObservations(teamId, teamPlayerId, from?)` añade `params: { from }` solo si viene informado.
  El front no envía `to`: no hay observaciones futuras.
- `type ObservationPeriod = "month" | "quarter" | "all"`, en `playerTrackingService.ts`, con:
  - `PERIOD_LABELS`: «Último mes», «Últimos 3 meses» y «Todo»;
  - `periodStart(period, today)` → `yyyy-MM-dd` de hoy − 30 días (`month`), hoy − 90 días (`quarter`)
    o `undefined` (`all`). Es una función pura, testeada con fecha fija.
- `usePlayerObservations(teamId, teamPlayerId, from?)`:
  - recarga cuando cambia `from`;
  - `create` devuelve `true` si la observación entra en el periodo (y la inserta) y `false` si no (no
    la inserta).
- `PlayerTrackingPanel`:
  - estado `period` (por defecto `month`) y `ToggleButtonGroup` pequeño junto al título
    («Observaciones (N)»);
  - si `create` devuelve `false`, avisa con
    «Observación guardada. No se muestra porque es anterior al periodo elegido.».

## Tests

- Handler (Postgres): `from` y `to` filtran de forma inclusiva; sin parámetros, devuelve todas.
- Validator: `from > to` es inválido.
- Front:
  - `periodStart`;
  - el servicio envía `from`;
  - el hook recarga al cambiar `from` y `create` respeta el periodo;
  - el panel: periodo por defecto «Último mes», cambiar a «Todo» pide sin `from`, título con el número
    de observaciones y aviso cuando lo creado queda fuera del periodo.
