## Backend — `GetSportEvents.cs`

`SportEventResponse` gana un campo:

```csharp
public record SportEventResponse()
{
    // ... campos existentes ...
    public bool HasConvokedPlayers { get; set; }
};
```

En el handler, la proyección `.Select(sportEvent => new SportEventResponse { ... })`
añade:

```csharp
HasConvokedPlayers = _db.Convocations.Any(c => c.SportEventId == sportEvent.Id),
```

`Convocation` vive en `Domain/Aggregates/Assistances/Convocation.cs` y se expone como
`AppDbContext.Convocations` (mismo `DbSet` que usa `GetEventConvocations.cs` filtrando
por `SportEventId`). Al ser un `.Any()` correlacionado dentro del `Select` de EF Core, se
traduce a un `EXISTS` SQL por fila — no dispara N+1 de roundtrips (una sola query al
servidor), aceptable para el tamaño de página habitual (`pageSize` por defecto de la
lista de eventos).

No se toca `SportEventsQuery`, rutas ni permisos — mismo endpoint, mismo contrato salvo
el campo nuevo.

## Frontend — `sportEventService.ts`

Añadir a `SportEventResponse`:

```typescript
hasConvokedPlayers?: boolean | null;
```

## Frontend — `EventCard.tsx`

- Nueva variable derivada, junto a `isMatch`:
  ```typescript
  const isTraining = (eventTypeName ?? "").toLowerCase().includes("entrenamiento");
  ```
- Cálculo de la hora de llegada reutilizando el mismo parseo que ya existe en
  `AttendanceEvent.tsx` (`parseDate(event.arrivalDate ?? event.arrival ?? undefined)` +
  `toLocaleTimeString(..., { timeStyle: "short" })`); `arrivalTimeStr` vacío si no hay
  fecha de llegada válida.
- En el body de la tarjeta, solo cuando `isTraining`, debajo del `metaRow` existente:
  - Chip resaltado de hora de llegada (solo si `arrivalTimeStr` no está vacío):
    ```tsx
    <Chip
      label={`Llegada ${arrivalTimeStr}`}
      size="small"
      sx={{
        backgroundColor: "rgba(255,193,7,0.22)",
        color: "#ffd54f",
        fontWeight: 700,
        fontSize: "0.7rem",
        height: 20,
      }}
    />
    ```
  - Chip de estado de convocatoria, siempre presente en tarjetas de Entrenamiento:
    ```tsx
    <Chip
      label={event.hasConvokedPlayers ? "Convocatoria abierta" : "Convocatoria sin iniciar"}
      size="small"
      sx={{
        backgroundColor: event.hasConvokedPlayers ? "rgba(46,125,50,0.35)" : "rgba(120,130,150,0.3)",
        color: event.hasConvokedPlayers ? "#a5d6a7" : "#cfd8dc",
        fontWeight: 700,
        fontSize: "0.68rem",
        height: 20,
      }}
    />
    ```
- Borde de la tarjeta: extender la clase raíz del `div.card` (línea 259) para incluir,
  cuando `isTraining`, `styles.cardConvocationOpen` o `styles.cardConvocationPending`
  según `event.hasConvokedPlayers`, mismo patrón que la clase `cardMatch` ya condicional.

## Frontend — `EventCard.module.css`

Dos nuevas variantes de `box-shadow` de borde, calcadas del patrón de `.cardMatch` /
`.cardMatch:hover` (mismos offsets, distinto color):

```css
/* Entrenamiento con convocatoria abierta — borde verde */
.cardConvocationOpen {
  box-shadow:
    0 0 0 1px rgba(102, 187, 106, 0.55),
    0 0 0 2px rgba(27, 94, 32, 0.28),
    0 6px 24px rgba(0, 0, 0, 0.65),
    0 1px 0 rgba(255, 255, 255, 0.09) inset,
    0 -1px 0 rgba(0, 0, 0, 0.4) inset;
}

/* Entrenamiento con convocatoria sin iniciar — borde neutro/gris */
.cardConvocationPending {
  box-shadow:
    0 0 0 1px rgba(144, 164, 184, 0.4),
    0 0 0 2px rgba(69, 90, 100, 0.22),
    0 6px 24px rgba(0, 0, 0, 0.65),
    0 1px 0 rgba(255, 255, 255, 0.09) inset,
    0 -1px 0 rgba(0, 0, 0, 0.4) inset;
}
```

(Los estados `:hover` reutilizan el `.card:hover` genérico ya existente — no hace falta
duplicarlo por variante, igual que ya ocurre entre `.card` y `.cardMatch`.)

## Frontend — `AttendanceEvent.tsx` (fix de navegación)

El botón "Volver" (línea ~187-194) deja de usar `goToTeamDashboard()` y navega al
listado de eventos preservando el equipo, replicando el patrón ya usado en el botón "Ir
al partido" de la misma barra de acciones (`event.teamId` disponible una vez cargado el
evento):

```tsx
onClick={() => {
  const teamIdParam = encodeURIComponent(String(event?.teamId ?? ""));
  navigate(teamIdParam ? `/coach/attendance?teamId=${teamIdParam}` : "/coach/attendance");
}}
```

Se mantiene `useTeamDashboardBack` importado solo si se sigue usando en otro punto del
archivo; si tras el cambio queda sin uso, se elimina el import (evitar `unused import`).
La rama de "evento no encontrado" (línea ~334, botón "Volver al listado" con
`navigate(-1)`) no se toca — ya cumple el comportamiento pedido.

## Tests

- **Backend** (`RFFM.Api.Tests` o equivalente, patrón `xUnit + Moq` de
  `GetSportEvents`/`GetEventConvocations` si existen tests hermanos): handler de
  `GetSportEvents` devuelve `HasConvokedPlayers = true` cuando existe al menos una
  `Convocation` para el evento, y `false` cuando no existe ninguna.
- **Frontend** (`Vitest + Testing Library`, co-ubicados en
  `pages/attendance/__tests__/`):
  - `EventCard`: tarjeta de Entrenamiento con `arrivalDate` muestra el chip de hora de
    llegada; sin `arrivalDate` no lo muestra.
  - `EventCard`: tarjeta de Entrenamiento con `hasConvokedPlayers: true` muestra
    "Convocatoria abierta" y la clase de borde `cardConvocationOpen`;
    `hasConvokedPlayers: false`/`undefined` muestra "Convocatoria sin iniciar" y
    `cardConvocationPending`.
  - `EventCard`: tarjeta de Partido/Torneo nunca muestra ninguno de los dos chips,
    aunque `hasConvokedPlayers` venga a `true`.
  - `AttendanceEvent`: clic en "Volver" navega a `/coach/attendance?teamId=<id del
    evento>` en vez de al dashboard del equipo.
