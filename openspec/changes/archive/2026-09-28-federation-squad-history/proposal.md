## Why

En Federación → Plantilla, el usuario quiere saber de dónde viene cada jugador: en qué equipos
jugó la temporada anterior y en cuáles juega en la activa, con su rendimiento en cada uno. Hoy
esa información solo se ve abriendo la ficha RFFM de cada jugador, una a una. Obtenerla para toda
la plantilla exige muchas peticiones a la RFFM (fichas + calendarios + actas), así que no puede
hacerse de forma síncrona en una petición HTTP.

## What Changes

- Botón **"Historial"** en la barra de acciones de Plantilla. Si ya hay datos persistidos para
  ese equipo y temporada, abre directamente la página de historial; si no, lanza un proceso en
  segundo plano y muestra "Te avisaremos con una notificación cuando esté listo".
- Proceso en segundo plano (cola + `BackgroundService`, un informe a la vez) que, para cada
  jugador de la plantilla y para la temporada seleccionada y la anterior, obtiene: temporada,
  competición, grupo, equipo, club, puntos y posición del equipo, goles, amarillas, rojas,
  titularidades y convocatorias **por equipo**.
- Estrategia híbrida: ficha RFFM del jugador (1 petición por temporada). Si jugó en un único
  equipo se usan los totales de la ficha; si jugó en varios, se calculan desde las actas de los
  partidos de cada equipo (calendario del grupo → actas), cacheadas y compartidas entre jugadores.
- Cliente HTTP RFFM para el proceso con **reintentos con backoff + jitter**, respeto de
  `Retry-After`, timeout por intento, circuit breaker y **throttling** (una petición cada vez con
  pausa mínima entre peticiones).
- Persistencia del informe en el esquema `federation` y botón **"Actualizar"** en la página.
- **Plantilla todavía vacía → posibles jugadores**: si el equipo seleccionado no tiene jugadores,
  el proceso busca en la temporada anterior los equipos del club de la misma categoría y de la
  categoría inferior (Cadete→Infantil, Infantil→Alevín, Juvenil→Cadete, Senior→Juvenil; Alevín
  sin inferior), separando fútbol femenino, y propone los jugadores cuyo año de nacimiento
  corresponde a la categoría del equipo en la temporada seleccionada. Los equipos del club salen
  de la ficha del club y, si no responde, de competiciones → grupos → jornada 1.
- **Año de nacimiento** de cada jugador en el historial (y equipo de procedencia si es candidato).
- **Campana de notificaciones en Federación** (reutiliza la entidad `Notification` y
  `/api/notifications`); la notificación enlaza a la página de historial.

## Non-goals

- No se añade web push en Federación.
- No se cambian los clientes HTTP de las consultas interactivas existentes (calendario, actas,
  jugador); solo se extraen sus parsers para reutilizarlos.
- No se cubren más de dos temporadas ni temporadas configurables.
- No se añade a Coach ni a Mobile.

## Capabilities

### New Capabilities
- `federation-squad-history`: historial por equipo de los jugadores de una plantilla
  (temporada seleccionada + anterior), generado en segundo plano, persistido y notificado.

## Impact

- Backend (`back-specialist`): `Features/Federation/SquadHistory/`, entidades en
  `Domain/Entities/Federation/`, `FederationDbContext` + migración, parsers extraídos de
  `PlayerService`/`ActaService`, nuevo cliente HTTP resiliente, paquete
  `Microsoft.Extensions.Http.Resilience`.
- Frontend (`front-specialist`): `GetPlayers.tsx`, nueva página `pages/SquadHistory/`,
  `routes.tsx`, campana en `AppHeader.tsx`, `notificationService.ts` movido a `shared/services/`.
