## Why

El entrenador quiere estudiar a los rivales de su liga: quién juega, cuánto, quién marca y quién
ve tarjetas, esta temporada y la pasada. Hoy esa información solo se obtiene abriendo la ficha
RFFM de cada jugador, una a una, y cada consulta golpea la web de la federación (que además
responde de forma intermitente con fichas vacías). Una liga son ~16 equipos × ~20 jugadores × 2
temporadas: no puede hacerse en una petición HTTP ni repetirse en cada visita.

## What Changes

- **Estadísticas persistidas** en el esquema `federation`: una fila por jugador y temporada
  (`RffmPlayerSeasonStats`, compartida entre ligas) y un informe por liga
  (`LeagueSquadStatsReport`: temporada + competición + grupo) con sus equipos y plantillas.
- **Proceso en segundo plano** (cola + `BackgroundService`, un informe a la vez, con el cliente
  RFFM con reintentos y throttling que ya existe) que recorre equipos del grupo → plantilla →
  ficha de cada jugador.
- **Ahorro de llamadas**: la temporada pasada se descarga **una sola vez** por jugador; las
  actualizaciones solo vuelven a pedir la temporada actual (y las plantillas, para detectar altas).
- **Actualización semanal**: cada lunes a las 00:01 (hora de Madrid) se actualizan las ligas de
  todos los equipos de la app Coach con competición RFFM configurada (creando el informe si
  todavía no existe). Si el servidor estaba parado a esa hora, se recupera al arrancar.
- **Notificación al terminar**: quien pidió generar o actualizar recibe un aviso in-app y web
  push con enlace a la página. La actualización semanal automática no notifica.
- **Código RFFM del equipo**: el equipo del entrenador guarda qué equipo de la liga es
  (`Team.RffmTeamCode`), elegido junto a la competición y el grupo, para distinguir siempre el
  equipo propio de los rivales.
- **Página Coach «Estadísticas de rivales»** (`/coach/rival-stats?teamId=`): si no hay datos, botón «Generar
  estadísticas»; si los hay, fecha de última actualización, botón «Actualizar» y los equipos de
  la liga con sus jugadores en tarjetas (temporada actual y pasada). Progreso visible mientras
  se genera.
- Acceso desde el panel del equipo (nueva tarjeta «Estadísticas de rivales», distinta del catálogo «Rivales» ya existente).

## Non-goals

- Explotación de los datos (rankings, comparativas, filtros avanzados): se diseñará después
  sobre estas tablas, que ya guardan los valores en columnas numéricas consultables.
- Estadísticas por partido o desglosadas por equipo dentro de la temporada (solo los totales de
  la ficha RFFM).
- Mobile y Federación no cambian. Más de dos temporadas, tampoco.

## Capabilities

### New Capabilities
- `coach-rival-squad-stats`: estadísticas de las plantillas de la liga del equipo del
  entrenador, generadas en segundo plano, persistidas, actualizadas cada lunes y a demanda.

## Impact

- Backend (`back-specialist`): `Team.RffmTeamCode` + migración (`AppDbContext`),
  `UpdateTeamCompetition`/`GetTeam`, `IWebPushNotificationDispatcher`,
  `Features/Coaches/RivalStats/` (endpoints),
  `Features/Federation/LeagueSquadStats/Services/` (generador, cola, worker, planificador),
  entidades en `Domain/Entities/Federation/LeagueSquadStats/`, `FederationDbContext` + migración,
  `RffmOptions` (intervalo mínimo entre actualizaciones). Sin paquetes nuevos.
- Frontend (`front-specialist`): `apps/coach/pages/rivalStats/`, `rivalStatsService.ts`,
  `routes.tsx`, `TeamDashboardCards.tsx`, `RffmCompetitionSelect` (tercer selector «Equipo») y
  `EditTeam.tsx`; componente presentacional de estadísticas por
  temporada extraído a `shared/` para reutilizarlo con la plantilla de Federación.
- Carga sobre la RFFM: primera generación ≈ 650 peticiones por liga (10–15 min con el throttling
  actual); cada actualización ≈ 340 (5–8 min).
