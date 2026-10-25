## Context

- `AttendanceTabs.tsx` (pestaña 0, «Convocatoria») pinta, a la izquierda, «Lista de espera» y, en
  partidos de liga, «Pendientes de respuesta» y «Disponibles»; a la derecha, «Convocados» con
  «Pendientes de aceptar», «Aceptados» y «Desconvocados» (en liga, pendientes y aceptados juntos y sin
  grupo plegable).
- Todas las listas pintan una tarjeta «cromo» (`.cromoCard`, foto `.cromoPhotoArea` de 260 px) desde
  `ConvocationCard`, `AvailabilityList`, `NotConvokedList` y `renderInjuredCard` (inline en
  `AttendanceTabs`). `PositionGroupedList` las agrupa con una cabecera por posición
  (`groupByPosition`).
- Player/FamilyMember: `isPlayerOrFamily` y `associatedPlayerId` ya existen; `matchesAssociatedPlayer`
  localiza al jugador propio; `defaultExpandedGroup` abre el grupo donde está. `sortedPending` lo
  pone primero dentro de pendientes y `highlighted` lo resalta.
- Diseño: https://claude.ai/artifact/BHPx16LpTyb149pncyy9gE (pantallas «Jugador / Familia»,
  «Entrenador» y «Fila compacta — estados»).

## Goals / Non-Goals

- **Goals**: el jugador propio arriba y fuera de los grupos; filas compactas legibles a 360 px; mismas
  acciones y permisos que hoy.
- **Non-Goals**: pestaña «Asistencia», filtros por estado, barra de selección masiva, cambios de
  backend.

## Decisions

### D1 · `PlayerRow` (componente de presentación)

`components/PlayerRow.tsx` + `PlayerRow.module.css`:
```ts
type PlayerRowTone = "accepted" | "pending" | "declined" | "waiting" | "available";
type Props = {
  name: string;
  photoSrc?: string | null;        // null → avatar por defecto
  dorsal?: number | null;
  positionTag?: string | null;     // "POR" | "DEF" | "MED" | "EXT" | "DEL"
  secondary?: string | null;       // posición completa o motivo («Lesionado», «Decisión técnica»…)
  status?: { label: string; tone: PlayerRowTone } | null;
  detailHref?: string | null;      // enlace a /coach/player/:id en avatar y nombre
  dimmed?: boolean;                // desconvocados / lesionados
  selectable?: boolean; selected?: boolean; onToggleSelect?: () => void; selectLabel?: string;
  actions?: React.ReactNode;       // botones a la derecha
};
```
- Fila `display:flex`, `min-height: 52px`, avatar circular de 36 px (`object-fit: cover`) con el dorsal
  en un círculo de 18 px; nombre con `text-overflow: ellipsis`. Renderiza un `<li>`; las listas son
  `<ul>`.
- Colores con las CSS custom properties de `:root` ya existentes y tokens nuevos de estado
  (`--rffm-status-accepted` #4fd6a0, `-pending` #f5c451, `-declined` #f69a9a, `-waiting` #7fb2f5) en
  `muiGameTheme.ts` (donde viven las vars de Coach, ver memoria «coach-theme-not-applied»).
- Sin emojis: lesionado se indica con `secondary="Lesionado"` y el tono `declined`.

### D2 · Acciones dentro de la fila

- Se **mantienen los nombres accesibles** actuales para no cambiar la semántica (y los tests que la
  usan): «Aceptar», «Rechazar», «Desconvocar», «Convocar», «Rechazado», «Disponible»,
  «Sí, disponible», «No disponible», «Editar motivo», «Pendiente de aceptar».
- Pendiente (entrenador): dos `IconButton` de 44 px (check / close de `@mui/icons-material`) con
  `aria-label="Aceptar"` / `"Rechazar"`.
- Aceptado (entrenador): `IconButton` «⋮» (`aria-label="Acciones de {nombre}"`) que abre un `Menu` de
  MUI con «Desconvocar» y, si aplica, «Lista de espera».
- Resto (lista de espera, disponibilidad, desconvocados): botones de texto pequeños
  (`Button size="small"`, `min-height: 44px`) con el texto actual.
- El chip de estado sustituye a la franja de color y a las `tagBadge` actuales («Pendiente de
  aceptar», «En espera», «Sin responder», «Disponible», motivo).

### D3 · `ConvocationCard`, `AvailabilityList`, `NotConvokedList`, lesionados

- Conservan su API de props y su lógica de permisos; solo cambian el marcado a `PlayerRow`.
- `renderInjuredCard` de `AttendanceTabs` pasa a `PlayerRow` (sin acciones).
- Se eliminan del CSS Module las clases `cromo*` que dejan de usarse en la pestaña 0; las que usa la
  pestaña «Asistencia» se quedan.

### D4 · Posición: orden + etiqueta

`utils/positionGroups.ts` añade:
```ts
export const POSITION_TAGS: Record<PositionGroupKey, string | null> =
  { goalkeepers: "POR", defenders: "DEF", midfielders: "MED", wingers: "EXT", forwards: "DEL", unknown: null };
export function positionTagOf(position?: string | null): string | null;
export function sortByPosition<T>(items: T[], getPosition: (i: T) => string | null | undefined): T[]; // estable
```
`PositionGroupedList` deja de pintar cabeceras: renderiza un `<ul>` con `sortByPosition(items)`.
`groupByPosition` se mantiene (lo usan otros consumidores).

### D5 · Jugador propio

`utils/ownPlayerEntry.ts` (lógica pura):
```ts
type OwnPlayerEntry =
  | { kind: "waiting" | "availabilityPending" | "available"; player: PlayerSimple }
  | { kind: "pending" | "accepted" | "declined" | "injuredWithConv"; conv: ConvocationItem }
  | { kind: "injured"; player: PlayerSimple };
export function findOwnPlayerEntry(lists, associatedPlayerId): OwnPlayerEntry | null;
```
Mismo orden de búsqueda que `defaultExpandedGroup` hoy. En `AttendanceTabs`, si
`isPlayerOrFamily && entry`, la entrada se **excluye** de su lista (y del contador de su grupo) y se
pinta `OwnPlayerCard` arriba de la pestaña, a todo el ancho, antes de las dos columnas.

`components/OwnPlayerCard.tsx` + `.module.css`: título «Tu jugador», avatar de 56 px con dorsal,
nombre, posición, chip de estado y zona de acciones según `kind`:

| kind | Chip | Acciones (mismas reglas que hoy) |
|---|---|---|
| pending | Pendiente (en liga con `closedConvocation`: Convocado) | «Aceptar» / «Rechazar» como botones de texto grandes (el texto visible es el nombre accesible) |
| accepted | Va | «Desconvocar» si `canEdit` |
| declined / injuredWithConv | No va / Lesionado + motivo | «Editar motivo», reactivar (solo entrenamientos) |
| availabilityPending | Sin responder | «Sí, disponible» / «No disponible» |
| available | Disponible | — |
| waiting | En espera | — |
| injured | Lesionado | — |

Para no duplicar la lógica de permisos, `ConvocationCard` acepta `variant="own"`: calcula estado,
motivo y acciones igual que en la fila y los pinta en `OwnPlayerCard` (en un aceptado, «Desconvocar»
va como botón directo en vez de en el menú «⋮»). Para las entradas sin convocatoria (espera,
disponibilidad, lesionado) `AttendanceTabs` pinta `OwnPlayerCard` con los handlers existentes
(`handleRespondAvailability`, `setUnavailableTarget`). Se eliminan `sortedPending` y `highlighted`.
El borde y el dorsal de «Tu jugador» usan `--rffm-primary` (el acento real de la app, cian), no el
naranja del mockup.

### D9 · Información del evento

`components/EventInfoCard.tsx` + `.module.css` sustituye en `AttendanceEvent.tsx` el bloque
«Información del evento» (rejilla de etiquetas):
- Línea 1: chip de tipo (`getChipClass`) + nombre (`<h2>`).
- Línea 2: icono calendario + «sáb, 1 nov · 10:30–12:00» (o «Por confirmar») + «Llegada 10:00».
- Línea 3: icono lugar + enlace al mapa si hay `locationMapUrl`.
- Línea 4 (partidos/amistosos): «vs {rival}».
- Descripción: recortada a 2 líneas (`-webkit-line-clamp`) con «Ver más» / «Ver menos» si supera
  140 caracteres.
Se eliminan del CSS Module las clases `info*`, `label`, `value`, `valueLink`, `fullWidth` y
`description`.

### D6 · Resumen

`components/ConvocationSummary.tsx`: `grid` de 4 columnas con Convocados (todas las convocatorias con
jugador + lesionados sin convocatoria), Van (aceptados; en liga, pendientes + aceptados), Pendientes
(pendientes de aceptar; en liga, pendientes de respuesta) y Bajas (desconvocados + lesionados). Cuenta
también al jugador propio. Se pinta bajo `OwnPlayerCard` (o al principio, para el entrenador).

### D7 · Grupos por defecto

`defaultExpandedGroup` para Player/FamilyMember pasa a ser `"accepted"` (en liga no aplica: la lista
de convocados no es plegable). Entrenador: sin cambios (todo cerrado).

### D8 · Layout

`.page` mantiene las dos columnas en escritorio y apila a una en móvil. Las listas son una columna de
filas a todo el ancho de su columna; sin tablas ni anchos fijos.

## Risks / Trade-offs

- Unos 40 tests de `__tests__` buscan textos/roles de las tarjetas. Al mantener los nombres accesibles
  (D2) la mayoría siguen valiendo; los que dependen de las cabeceras de posición, del grupo abierto por
  defecto o de `highlighted` se actualizan.
- El menú «⋮» añade un toque para desconvocar a un aceptado: aceptable, es una acción poco
  frecuente y destructiva.
