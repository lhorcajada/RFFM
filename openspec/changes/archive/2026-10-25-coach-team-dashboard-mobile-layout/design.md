## Context

- `TeamDashboard.tsx` pinta `PushActivationBanner` y una rejilla con `UpcomingEventsWidget` y
  `NewsWidget` (apilados en móvil, dos columnas desde 769 px). La barra de acciones del entrenador
  tiene «Ir al club» y «Volver».
- `UpcomingEventsWidget` carga los 3 próximos eventos (`getSportEvents(teamId, 1, 3, today)`), los
  resúmenes con `useEventAttendanceSummaries`, y pinta cada evento como `EventCard compact` dentro de
  un `Carousel`. Debajo de cada tarjeta, el jugador tiene «Voy» / «No voy» (convocatoria pendiente)
  o «Sí» / «No» (disponibilidad pedida), con estado optimista, `DeconvokeDialog` para el motivo y
  snackbar si falla.
- `NewsWidget` carga 3 noticias publicadas y las pinta como `NewsListCard compact` en un `Carousel`
  con avance automático.
- `useClassification({ season, competition, group })` devuelve la tabla (`position`, `points`) y los
  partidos por equipo (`teamMatches`, con `result` G/E/P y goles `null` si no se ha jugado).
  `Classification.tsx` ya resuelve el equipo propio con `team.rffmTeamCode` y la temporada con
  `useRffmSeason()`.
- `buildTeamSections` es la fuente única de las secciones del equipo y sus permisos.
- Diseño: https://claude.ai/artifact/HZmUGEtauFc35ef4MkzK6z («Jugador / familia — móvil» y
  «Entrenador — móvil»).

## Goals / Non-Goals

- **Goals**: el próximo evento y la respuesta del jugador visibles sin deslizar; todo legible a
  360 px; mismas acciones, peticiones y permisos que hoy.
- **Non-Goals**: cambios de backend, nuevos endpoints, panel general, navegación del equipo.

## Decisions

### D1 · El widget de eventos se parte en tarjeta destacada + filas

`UpcomingEventsWidget` conserva la carga, los resúmenes, el estado optimista, los diálogos y los
manejadores tal cual. Solo cambia el render:
- `events[0]` → `NextEventCard`; `events.slice(1)` → `<ul>` de `UpcomingEventRow` bajo el título
  «Después» con el enlace «Ver calendario» (`/coach/attendance?teamId=`).
- Ya no usa `Carousel` ni `EventCard`.
- Las acciones del jugador se pasan como props (`onAccept`, `onDecline`, `onAvailable`,
  `onUnavailable`, `busy`) calculadas con las mismas condiciones `canConfirm` / `canAnswerAvailability`
  que hoy. En la tarjeta son botones de texto de 48 px; en la fila, `IconButton` de 44 px con
  `aria-label` «Voy» / «No voy» y «Sí» / «No», para que los nombres accesibles no cambien.
- Toda la tarjeta y la fila enlazan al detalle (`/coach/attendance/{id}?teamId=`) salvo los botones
  (el enlace es el nombre del evento, no un `<Link>` que envuelve botones).

### D2 · Presentación del evento en `utils/eventDisplay.ts`

Funciones puras, sin React:
- `eventStart(event)`: primera fecha válida de `startTime ?? eveDateTime ?? start`.
- `dateBadge(date)`: `{ weekday: "SÁB", day: "31", month: "OCT" }` (`date-fns`, locale `es`).
- `relativeDayLabel(date, today)`: «Hoy», «Mañana» o el día de la semana («sábado») si es en los
  próximos 6 días; si no, «31 oct».
- `timeLine(event)`: «10:30 · Llegada 09:45», «10:30» o «Hora por confirmar».
- `myStatusLabel(summary)`: `{ text, tone }` para el jugador:
  `Pending` → «Estás convocado · sin responder» (pending); `Accepted` → «Vas» (accepted);
  `Deconvoke`/`Justified` → «No vas» (declined); lesionado → «Lesionado» (declined);
  disponibilidad `Requested` → «¿Estás disponible?» (waiting); `Available` → «Disponible»
  (available); `Unavailable` → «No disponible» (declined); sin nada → `null`.
- `eventTitle(event)`: `title`, si no `name` (el API de eventos del equipo no trae `title`), si no
  «vs {rival}», si no «Evento».
- `eventKindLabel(event, typeName)`: «Partido de liga» / «Amistoso» / «Torneo» por `matchCategory`;
  si no, el nombre del tipo de evento.
- `matchSideLabel(event)`: «Local» / «Visitante» en partidos con rival.

La fila pinta «tipo · Local/Visitante · hora»; el entrenador ve a la derecha el % de asistencia o
el chip «Sin convocar».

Los tonos reutilizan los tokens `--rffm-status-*` ya definidos en `muiGameTheme.ts` y se pintan con
`StatusChip`; el lugar, con `EventLocation` (enlace al mapa o texto).

### D3 · `NextEventCard`

`<section aria-label="Próximo evento">` con: etiqueta «Próximo · {relativeDayLabel}», chip del tipo
de evento, bloque de fecha (`dateBadge`), `<h2>` con el título del evento enlazado al detalle,
`timeLine`, lugar (enlace al mapa si `locationMapUrl`).
- `variant="player"`: banda con `myStatusLabel` y las acciones de D1; «Ver convocatoria · N
  convocados».
- `variant="coach"`: barra segmentada (`role="img"`, `aria-label="N convocados: X van, Y pendientes,
  Z no van"`), lista de 4 cifras (Convocados, Van, Pendientes, No van) y el enlace-botón «Gestionar
  convocatoria». Si `convocados === 0`, sin barra y con el texto «Aún no hay convocados».

### D4 · `LeagueSnapshot` y `utils/leagueSnapshot.ts`

Fuentes, las mismas que las páginas existentes:
- posición y puntos: `useClassification` (como `Classification.tsx`).
- partidos propios: `useOwnTeamSeason` y `ownScore` / `ownOutcome` de `pages/results` (como
  `Results.tsx`). No se usa `teamMatches` de `useClassification`: trata los goles vacíos `""` como 0
  y las fechas `dd-mm-yyyy` no se ordenan como texto, lo que daba 0–0 falsos y un último partido
  equivocado.

`buildLeagueSnapshot(teams, ownByRound, ownTeamCode)` → `{ position, points, lastMatch, form } |
null`: equipo propio por `teamId === ownTeamCode` (sin él → `null`); jornadas ordenadas por número,
sin descansos ni partidos sin jugar; `lastMatch` = `{ round, opponent, mine, theirs, outcome }` de la
última; `form` = los `outcome` (V/E/D) de las cinco últimas.

`LeagueSnapshot` (solo Player/FamilyMember y con `hasFeatureAccess(Convocations)`): no se pinta
mientras carga cualquiera de las dos fuentes, sin competición o si `buildLeagueSnapshot` da `null`.
Dos enlaces-tarjeta: «Último resultado» (→ `/coach/results`, «J3 · vs rival») y «Posición»
(→ `/coach/classification`), con `teamId`; los resultados usan `OutcomeBadge` de Resultados. La
racha es una lista con `aria-label="Últimos 3: E V V"`. Sin partido jugado, solo la posición.

### D5 · `QuickActions` (Coach/Administrator)

Toma de `buildTeamSections` los ítems visibles con clave `squad`, `injured` y `attendance-summary`
(mismas rutas y permisos que el Menú) y los pinta como una rejilla de tres enlaces con icono. Sin
ítems visibles, no se pinta. Mientras `usePermissions` carga, tampoco.

### D6 · Noticias en filas

`NewsWidget` mantiene la carga y los estados vacío/cargando. Cada noticia es `NewsRow`: enlace a
`/coach/news/{id}` con miniatura de 64 px (`coverImageUrl`, `alt=""`; sin imagen, un icono), título a
dos líneas y antigüedad («Hace 2 días», `formatDistanceToNowStrict` con locale `es`, de `publishedAt
?? newsDate`). Encabezado con «Ver todas» → `/coach/news`. Sin `Carousel` ni avance automático.

### D7 · Página y cabecera

`TeamDashboard.tsx`: `PushActivationBanner` arriba; después una columna principal (próximo evento,
«Después», Liga) y una secundaria (acciones rápidas, noticias). Una columna en móvil y dos desde
769 px (mismo corte que hoy). «Ir al club» y «Volver» pasan a `IconButton` con `aria-label` y
`Tooltip`, para que los tests que los buscan por nombre sigan valiendo. Cada bloque sigue dentro de
su `ErrorBoundary`.

## Risks / Trade-offs

- `LeagueSnapshot` añade dos peticiones RFFM al inicio del jugador (tabla + calendario). Se acepta:
  son las mismas que hace Clasificación y el backend las cachea; si fallan, el bloque no se pinta.
- Pasar de tarjeta a fila quita el cuerpo de la noticia del inicio; se lee en el detalle.
- Otra sesión tiene sin commitear cambios en `Front/package.json` (rediseño de Resultados); la
  subida de versión debe hacerse sobre la versión que haya en `main` al commitear.
