## Context

Todo el cambio vive en `Front/src/apps/coach/pages/convocations/` (app Coach, tema oscuro). El
estado del partido está en `hooks/useLiveMatch.ts`; `components/PartidoEnDirectoTab.tsx` lo
pinta con `@dnd-kit`. Los esquemas vienen del backend (`getFormations()`, 18 esquemas, todos de
11) y sus coordenadas están en `types/formation.ts` (`FORMATION_POSITIONS`, por nombre, con
`slotIndex` 0–10 y el portero siempre en `slotIndex: 0`).

El backend lee `cardsJson` contando eventos por `cardType` (`PlayerCardCountService`, único
punto de conteo para estadísticas, historial, Mobile y sanciones) y solo usa el esquema
**inicial** en el informe del partido.

## Decisiones

### 1. La expulsión se deriva de las tarjetas, no se guarda aparte

`utils/expulsions.ts` (funciones puras, testeadas aparte):

```ts
export type CardStatus = "none" | "yellow" | "red" | "doubleYellow";
export function getCardStatus(cards: CardEvent[], teamPlayerId: string): CardStatus;
export function getExpelledIds(cards: CardEvent[]): Set<string>;
```

- `red`: tiene alguna roja propia. `doubleYellow`: dos o más amarillas y ninguna roja.
- La segunda amarilla se guarda como evento `yellow` (sin roja añadida): la cronología del
  partido sigue mostrando las dos amarillas con su minuto, y ni `LiveMatchBackup` ni el payload
  ganan campos.
- La regla oficial se aplica al contar, en `PlayerCardCountService.CountCards`: con dos o más
  amarillas del mismo jugador en un partido, `yellow` devuelve 0 y `red` suma 1. Al estar en el
  único punto de conteo, vale también para los partidos ya guardados y para `HasRedCard`
  (sanción automática por expulsión).

### 2. Esquemas reducidos solo en el front

En `types/formation.ts`:

```ts
export const REDUCED_FORMATIONS: Record<7 | 8 | 9 | 10, Formation[]>; // id "reduced:<nombre>"
// y sus coordenadas se añaden a FORMATION_POSITIONS, con slotIndex 0..N-1 y PT en 0
export function formationsForPlayerCount(count: number, apiFormations: Formation[]): Formation[];
export function defaultReducedFormation(count: number, currentName: string): Formation;
```

| Jugadores | Esquemas (defensas-medios-delanteros) | Por defecto |
|---|---|---|
| 10 | 4-4-1, 4-3-2, 4-2-3, 3-4-2, 3-5-1, 5-3-1 | 4-4-1 |
| 9 | 4-3-1, 4-2-2, 3-4-1, 3-3-2, 5-2-1 | 4-3-1 |
| 8 | 4-2-1, 3-3-1, 3-2-2, 4-3-0 | 4-2-1 |
| 7 | 3-2-1, 2-3-1, 2-2-2, 3-3-0 | 3-2-1 |

`defaultReducedFormation` elige, entre los del nuevo número, el primero con el mismo número de
defensas que el esquema actual; si no hay, el de la columna «Por defecto».

No se añaden a la tabla de esquemas del backend: así no aparecen en la alineación inicial ni en
la simulación, que siempre son de 11. En el historial se guardan como cualquier
`FormationChangeEvent` (`formationId: "reduced:4-4-1"`, `formationName: "4-4-1"`).

### 3. `useLiveMatch`: una sola acción de expulsión

`addCard` pasa a devolver el control a una función interna `expelPlayer(playerId, minute)` cuando
la tarjeta es propia, el partido está en juego y `getCardStatus` pasa a `red`/`doubleYellow`:

1. Calcula los jugadores que quedan en el campo (`slots` sin el expulsado).
2. Si quedarían menos de 7: **no aplica nada** y expone `pendingMinPlayersCard` (la tarjeta en
   espera). `confirmMinPlayersEnd()` registra la tarjeta, expulsa y ejecuta el fin de partido;
   `cancelMinPlayersEnd()` la descarta.
3. Si no: pide el esquema con `defaultReducedFormation`, recoloca y llama a la lógica existente
   de `changeFormation` (reutiliza `applySlotChange`, que ya cierra los minutos del que sale y no
   toca `windows`).

Recolocación (`utils/expulsions.ts`, pura, con el azar inyectable para los tests):

```ts
export function relocateAfterExpulsion(
  slots: Record<number, string | null>, expelledId: string,
  newSlotDefs: FormationSlotDef[], pickIndex?: (n: number) => number,
): Record<number, string | null>;
```

El portero (slot 0) se queda en el 0; si el expulsado era el portero, `pickIndex` elige a uno
de los restantes para el 0. El resto conserva su orden por `slotIndex`.

El hook necesita saber el esquema actual, hoy estado local de `PartidoEnDirectoTab`. Se mueve
al hook como `currentFormation: { id, name } | null` (se inicializa en `initMatch`, lo actualizan
`changeFormation` y la expulsión, y se añade a `LiveMatchBackup`). Con esto se corrige de paso
que al recuperar un partido el campo vuelva al esquema inicial. Backups antiguos sin el campo:
se toma el último `formationChanges` o, si no hay, `startingFormation`.

### 4. Guardado automático

En `confirmAction("endMatch")` y en `confirmMinPlayersEnd()` se llama a
`persistMatchParticipation()` tras fijar el estado final. Como esa función lee refs que se
sincronizan en el render, se dispara desde un `useEffect` sobre una bandera `pendingAutoSave`,
no en el mismo tick. Se eliminan `requestSave`/`confirmSave`/`cancelSave`/`isSaveConfirmOpen` y
su diálogo; se añade `retrySave`. El `Snackbar` de error existente gana un botón «Reintentar».

Como el partido queda siempre guardado al finalizar, la edición manual pasa a ser la única vía
para corregir resultado y duración. Hoy el diálogo guardaba con los valores anteriores a la
edición (y sin duración); ahora entrega el resultado y la duración corregidos a
`handleManualSave`, que los envía en el payload.

### 5. UI

- **`simulation/PlayerCardBadge.tsx`** (+ `.module.css`): pinta `yellow`, `red` o
  `doubleYellow` como rectángulos pequeños en la esquina de la foto. Lo usan
  `SimulationPlayerSlot` y `CompactBenchCard` mediante una prop opcional `cardStatus`, así la
  simulación (que no la pasa) no cambia.
- **Banquillo**: el expulsado se pinta con `CompactBenchCard` no arrastrable también en
  «preparar cambio», y `handleDragEnd` ignora cualquier arrastre de un expulsado.
- **`simulation/LiveMatchEventButtons.tsx`** (+ `.module.css`): apartado bajo el banquillo con
  los cuatro botones en rejilla de 2 columnas (responsive, sin tablas). Abre `GoalEventDialog` y
  `CardEventDialog`, que salen de `LiveMatchScoreboard`; el marcador queda solo con escudos,
  nombres y resultado.
- **`CardEventDialog`**: nueva prop `side: "own" | "rival"` que muestra solo la lista de
  jugadores propios o solo el dorsal rival. En la edición manual sigue sin `side` (ambos).
- **Selector «Esquema»**: `formationsForPlayerCount(11 - expulsados, formations)`, es decir, el
  número de jugadores **permitido**, no el de casillas ocupadas. Si se quita una tarjeta puesta
  por error, el número permitido sube y el selector vuelve a ofrecer los esquemas de ese
  tamaño; al aplicarlo queda una casilla vacía que el entrenador rellena en «preparar cambio».
- **Ventanas**: una ventana confirmada en la que entra alguien y no sale nadie (solo rellena
  casillas vacías) se marca `fillsEmptySlot: true` y no cuenta para el cupo.
- **Confirmación de mínimo de jugadores**: `ConfirmDialog` compartido
  (`shared/components/ui/ConfirmDialog`), título «El equipo se queda con menos de 7 jugadores»,
  acción «Finalizar partido».

Colores de las tarjetas: se reutilizan los que ya usa `CardsTimeline`; no se añaden valores.

## Riesgos

- **Tarjeta registrada por error**: quitarla no devuelve al jugador al campo ni restaura el
  esquema (decisión del usuario); el entrenador elige el esquema y hace el cambio. Los minutos
  entre la expulsión y la vuelta no se le cuentan.
- **Estadísticas históricas**: la regla de la doble amarilla cambia los totales de partidos ya
  guardados en los que un jugador tuviera dos amarillas (pasan a 0 amarillas y 1 roja).
- **Tarjetas en el descanso**: la expulsión se aplica también en `halftime`, con el minuto del
  final de la primera parte.

## Verificación

`dotnet test` en `Back/ExtractionApi`; `npm run test` y `npm run build` en `Front/`. Comprobación manual en tablet: roja a un jugador
de campo, roja al portero, doble amarilla, recarga a mitad de partido y fin por menos de 7.
