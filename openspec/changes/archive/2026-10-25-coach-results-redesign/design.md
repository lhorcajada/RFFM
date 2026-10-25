## Context

`Results.tsx` usa `useCalendar` (compartido con otras páginas): pide `GET /calendar/matchday` para la
jornada 1 (que trae la lista de jornadas), autoselecciona la jornada de la semana actual y carga cada
jornada al seleccionarla. Pinta las jornadas como `Tabs` de MUI y los partidos con `RoundPanel`
(agrupados en sábado/domingo/aplazados/descansa). El equipo propio se identifica en otras páginas
(`Classification.tsx`) con `team.rffmTeamCode` frente a `localTeamCode`/`visitorTeamCode`.

`GET /calendar?competitionId&groupId&season` ya existe y devuelve `matchDays[]` con
`matchDayNumber`, `date` y `matches[]` de toda la temporada, leído de la BD de resultados
(`RffmResultsSyncService.GetCalendarAsync`). Pasa por el `CachingBehavior` (hasta 1 h), así que puede
ir algo por detrás de `/calendar/matchday`, que no se cachea.

El scroll de la página ocurre en el contenedor de contenido de `BaseLayout` (`overflow-y: auto`, bajo
la cabecera), así que un `position: sticky; top: 0` dentro de la página queda pegado bajo la cabecera.

## Goals / Non-Goals

**Goals:** jornadas siempre accesibles al hacer scroll; partido propio siempre primero; vista de la
temporada del equipo; sin peticiones por jornada para la barra ni el panel; responsive sin tablas.

**Non-Goals:** cambiar `useCalendar`, `RoundPanel` o `MatchDay` (los usan Federación y otras páginas);
cambios de backend; clasificación o directo en esta página.

## Decisions

### D1 · Lógica pura en `utils/ownMatch.ts`
- `isOwnMatch(match, teamCode)`: `localTeamCode` o `visitorTeamCode` igual a `teamCode` (comparando
  como string recortado). Sin `teamCode` → nunca.
- `isPlayed(match)`: `localGoals` y `visitorGoals` son números enteros (tras recortar).
- `isBye(match)`: algún nombre de equipo es «Descansa» (sin distinguir mayúsculas), como
  `groupMatchesByWeekend`.
- `ownOutcome(match, teamCode)`: `"V" | "E" | "D" | null` (null si no es propio o no se ha jugado).
- `splitRound(matches, teamCode)`: `{ own: CalendarMatch | null, ownBye: boolean, rest: CalendarMatch[] }`.
  `own` es el partido propio que no es descanso; `ownBye` cuando el equipo aparece en un «Descansa»;
  `rest` excluye el propio y los descansos ajenos se mantienen al final.
- `seasonSummary(ownByRound)`: `{ wins, draws, losses, goalsFor, goalsAgainst }` sobre las jornadas
  jugadas.
- Alternativa descartada: reutilizar `groupMatchesByWeekend` — agrupa por día, no separa el propio.

### D2 · `hooks/useOwnTeamSeason.ts`
- Entrada `{ season, competition, group, teamCode }`; con `competition`, `group` y `teamCode` llama
  una vez a `getCalendar` (`apps/federation/services/api`) y devuelve
  `{ ownByRound: Record<number, CalendarMatch | "bye">, loading, error }`.
- Sin alguno de los tres parámetros devuelve `ownByRound` vacío y no llama a la API.
- Un error no rompe la página: el panel muestra su estado de error y la barra se queda sin letras.

### D3 · Prioridad de datos
`Results.tsx` combina: para la jornada seleccionada, si `useCalendar` ya tiene sus partidos, el partido
propio sale de ahí (`splitRound`) y sustituye a `ownByRound[n]`; el resto de jornadas usa
`ownByRound`. Así la tarjeta, la ficha de la barra y la fila del panel de la jornada seleccionada
coinciden siempre con los datos al día.

### D4 · `components/RoundRail`
- Props: `rounds` (`{ number, label, sub, outcome, isCurrent }[]`), `selectedIndex`,
  `currentIndex`, `onSelect(index)`.
- `<nav aria-label="Jornadas">` con `position: sticky; top: 0; z-index` (CSS Module).
- Botones «Jornada anterior»/«Jornada siguiente» (deshabilitados en los extremos), fichas como
  `<button aria-pressed>` con `aria-label` «Jornada N, victoria|empate|derrota|por jugar|jornada
  actual», y botón «Jornada actual» (deshabilitado si ya está seleccionada).
- Centra la ficha seleccionada con `scrollIntoView({ inline: "center", block: "nearest" })` al
  cambiar la selección (protegido si `scrollIntoView` no existe, p. ej. jsdom).
- La «jornada actual» es la que `useCalendar` autoselecciona (`selectedTab` inicial): se guarda en un
  `useRef` la primera vez que llegan las jornadas.

### D5 · `components/OwnMatchCard`
- Etiqueta «Tu partido» + estado («Finalizado», «Próximo» si es la jornada actual sin jugar,
  «Programado» en otro caso).
- Local y visitante con escudo (`localTeamImageUrl`/`visitorTeamImageUrl`, o iniciales si no hay),
  nombre (el propio resaltado), marcador si se ha jugado u hora y «vs» si no.
- Fecha · hora y campo (`field`); resultado («Victoria 2–1», «Empate 1–1», «Derrota 0–2») y enlace
  «Ver acta» con `resolveActaLink` (misma lógica que hoy).
- Variante «Descansa» cuando `ownBye`; sin `teamCode` o sin partido propio no se pinta.

### D6 · `components/RoundMatchList`
- Lista `<ul>` de tarjetas: local · marcador u hora · visitante, fecha y «Ver acta» cuando
  `resolveActaLink` devuelve enlace. Grid `auto-fill, minmax(280px, 1fr)` en escritorio, una columna en
  móvil. Sin tablas.

### D7 · `components/SeasonPanel`
- Solo en `md` y superior (`useMediaQuery(theme.breakpoints.up("md"))`), a la derecha (flex-wrap:
  baja debajo si no cabe).
- Cabecera «Tu temporada» con V/E/D y «GF · GC» (`seasonSummary`), y una fila `<button aria-pressed>`
  por jornada: «J n», rival, «Casa»/«Fuera» · fecha, marcador y letra; las no jugadas, la hora.
  Al pulsar selecciona la jornada. Sin scroll propio: la lista crece y se usa el scroll de la página.
  Cada fila lleva `aria-label` explícito («Jornada N, rival, casa|fuera, marcador, resultado»).
- Estados: cargando (spinner), error («No se ha podido cargar la temporada del equipo.») y sin
  `teamCode` (no se pinta).

### D9 · Nombres y escudos (`components/TeamCrest`)
- `TeamCrest({ name, imageUrl, size, own })`: `<img alt="Escudo de {name}">` con
  `resolveShield` (`shared/utils/match`, rutas relativas → `https://www.rffm.es`); sin URL, las
  iniciales. Se usa en «Tu partido», «Resto de la jornada» y el rival de «Tu temporada».
- Los nombres nunca se recortan (`overflow-wrap: anywhere`, sin `nowrap`/`ellipsis`): parten línea.

### D10 · Partidos suspendidos
- `isSuspended(match)`: `status === "3"` (mismo criterio que `MatchCard`). `isPlayed` devuelve
  `false` para un suspendido, así que no tiene letra, resultado ni cuenta en el balance.
- «Tu partido» muestra el estado «Suspendido»; «Resto de la jornada» una etiqueta «Suspendido»;
  la ficha de la barra «Susp.» (`RailRound.suspended`) y la fila del panel «Suspendido».

### D11 · Avisos de resultados en una campana
- `MatchResultNotificationsToggle` se convierte en `IconButton` (44 px) con `aria-label` «Avisos de
  resultados: activados|desactivados|sin equipo» e icono según el estado, colocado en el
  `actionBar` junto a «Volver». Al pulsarlo abre un `Popover` con el mismo contenido de antes
  (interruptor, ayuda de activación push o enlace a Ajustes). Misma lógica de guardado y reversión.

### D8 · Estilo
CSS Modules co-ubicados; colores de las CSS custom properties de `:root` del tema que se aplica de
verdad (`muiGameTheme.ts`): se añaden `--rffm-result-win`, `--rffm-result-draw`,
`--rffm-result-loss` y `--rffm-own-accent` si no existen. Resultado distinguible por letra y forma
(V relleno, E gris relleno, D contorno), no solo por color. Objetivos táctiles ≥ 44 px.

## Risks / Trade-offs

- `/calendar` cacheado hasta 1 h → la barra y el panel pueden ir algo por detrás en jornadas no
  seleccionadas. Mitigado por D3.
- Equipos sin `rffmTeamCode` → sin «Tu partido» ni panel: la página sigue mostrando la jornada
  completa en «Resto de la jornada» (que entonces se titula «Partidos de la jornada»).
- 30 fichas en la barra → scroll horizontal; mitigado con flechas, centrado automático y «Jornada
  actual».
