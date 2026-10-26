## Context

- `InjuredPlayersList.tsx` carga jugadores y lesiones (`getPlayersByTeam` + `getTeamInjuries`), construye
  `rows: { player, injury }[]` ordenadas por inicio descendente y pinta una rejilla de tarjetas con
  botones de icono (Editar / Dar de alta).
- Diseño aprobado: `.design/injured/project/Main.dc.html` (390 px) y `Desktop.dc.html` (1280 px, 3
  columnas). El diseño usa un navy (`#1c1c30` tarjeta, `#07071a` fondo, acentos `#4ec9b0` / `#ff9b85`).
- Variables existentes en `:root` (`muiGameTheme.ts`): `--rffm-card-bg`, `--rffm-primary`,
  `--rffm-status-accepted` (verde), `--rffm-status-declined` (rojo), `--rffm-status-pending` (ámbar).
  `--rffm-text` / `--rffm-muted` no están definidas: la tarjeta actual usa solo el fallback
  (`#f0f0f0`, `#a59f9f`).

## Decisions

### D1 · Colores: sin valores nuevos
- Tarjeta: `var(--rffm-card-bg, #1c1c30)` (mismo valor que el diseño) y borde `rgba(255,255,255,0.08)`
  como la tarjeta actual. Círculo de dorsal: `rgba(255,255,255,0.08)`.
- Estado «Activa»: `var(--rffm-status-declined)`; «Alta»: `var(--rffm-status-accepted)`. Barra de
  recuperación: `--rffm-status-pending` sobre pista `rgba(255,255,255,0.08)`. Chip seleccionado:
  `--rffm-primary`. No se copian los hex del diseño que no tienen variable.

### D2 · Resumen y filtros (estado local)
- `activeCount = rows.filter(!endDate).length`.
- `dischargedThisMonth = rows.filter(endDate en el mismo año y mes que hoy).length`.
- `filter: "active" | "history"`, por defecto `"active"`.
  - «Activas» = lesiones sin `endDate`; «Historial» = lesiones con `endDate` (las altas). Así los
    filtros son una partición y el historial no repite lo que ya está en «Activas».
- Chips de MUI `Chip` clicables con `aria-pressed`; altura mínima 44 px vía CSS Module.
- Estado vacío: si no hay ninguna lesión se mantiene «Sin lesiones registradas»; si solo falta en el
  filtro: «Sin lesiones activas» / «Sin historial de lesiones».

### D3 · Parser de recuperación: SÍ, mínimo y puro
`estimatedRecovery` es texto libre; la barra solo se muestra si se interpreta sin ambigüedad.
`pages/injured/injuryRecovery.ts`:
```ts
export function parseRecoveryDays(text?: string | null): number | null;
export function recoveryProgress(startDate: string, estimatedRecovery: string | null | undefined, now: Date): number | null;
```
- Formato aceptado (regex anclada, insensible a mayúsculas): número o rango `N-M` / `N–M` / `N a M`
  seguido de unidad `día(s)`, `dia(s)`, `semana(s)`, `mes(es)`. Unidades: día=1, semana=7, mes=30.
  Para rangos se usa el **extremo superior** (estimación conservadora: no se sobrestima la
  recuperación). Cualquier otro texto («unas semanas», «hasta nueva revisión», «3 semanas aprox.»)
  → `null`.
- `recoveryProgress` = `round(díasTranscurridos / díasTotales * 100)` acotado a `[0, 99]` (nunca 100 %
  mientras la lesión siga activa); `null` si no hay parser, si el total es 0 o la fecha de inicio es
  inválida. Recibe `now` para ser determinista en tests.
- Solo se calcula para lesiones activas; las altas no muestran barra.

### D4 · Tarjeta
- Cabecera: círculo con dorsal (`—` si no hay), nombre (`name lastName` o alias), subtítulo
  `position · alias` (alias solo si hay nombre), chip de estado.
- Cuerpo: tipo de lesión; «Rec.: …» si existe; barra (`role="progressbar"`, texto «Recuperación N %»)
  si D3 devuelve valor; fechas «Inicio: …» y, solo con alta, «Alta: …».
- Acciones (solo `isCoach`): «Actualizar» (abre `InjuryDialog`, en cualquier lesión) y «Dar de alta»
  (solo activas, abre el `ConfirmDialog` existente). Botones de texto con `min-height: 44px`.
- Se conservan `id="injury-<id>"` y la clase `highlighted`.

### D5 · Layout
- `cardsGrid`: 1 columna en móvil; `@media (min-width: 900px)` → 3 columnas. Resumen: 2 contadores en
  rejilla de 2 columnas. Sin `<table>`.

## Tests (TDD)
- `injuryRecovery.test.ts`: formatos válidos, rangos, unidades, texto no interpretable, clamp 0–99,
  fecha inválida.
- `InjuredPlayersList.test.tsx` (actualizado): «Actualizar» sustituye a «Editar»; contadores; filtro
  por defecto «Activas»; «Historial» muestra las altas; estados vacíos por filtro; barra solo con
  estimación interpretable; permisos; confirmación de alta; resaltado. Fecha fijada con
  `vi.useFakeTimers({ toFake: ["Date"] })`.
