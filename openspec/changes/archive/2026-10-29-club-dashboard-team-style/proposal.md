## Why

El panel del club (`/coach/clubs/dashboard/:id`) es una página de cuatro tarjetas grandes que no se parece al resto de la zona Coach y obliga a pasar por varias pantallas para las tareas habituales de un responsable de club. El dashboard de equipo (`team-dashboard`) ya resolvió este problema con una cabecera compacta, acciones rápidas y widgets; el panel del club debe seguir el mismo patrón y ofrecer atajos propios de la gestión de un club.

## What Changes

- **Frontend (Coach, `Front/`)**: el panel del club adopta la estructura del dashboard de equipo.
  - Cabecera: escudo y nombre del club (`ClubHeader`), temporada y botón «Volver» (icono) en la barra de acciones.
  - Columna principal: widget «Equipos del club» (filas con nombre, categoría y enlace al dashboard del equipo; enlace «Ver todos»).
  - Columna lateral:
    - «Acciones rápidas» (rejilla de 3 columnas): Equipos, Jugadores, Personal, Inscripciones, Solicitudes de acceso y Nuevo equipo.
    - «Pendiente de revisar»: solicitudes de acceso pendientes del club, con contador.
  - En móvil las columnas se apilan.
  - Se conservan los destinos actuales y el `seasonId` de la URL en los enlaces que lo admiten.
  - Se sustituye el rediseño previo (estilo «home») del panel del club; `DashboardHeader` deja de necesitar las props `eyebrow`/`title` añadidas para ese intento.
- **Sin cambios de backend**: solo se consumen endpoints existentes (`GET /api/clubs/{id}/join-requests/count`, listado de equipos del club).
- **Versión**: web minor.

### Non-goals

Resumen con contadores, próximo evento del club, noticias del club, «Alta de jugador», «Invitar entrenador» y «Datos del club»: requieren endpoints o pantallas que hoy no existen; quedan para un change posterior.

## Capabilities

### New Capabilities
- `club-dashboard-team-style`: panel del club con acciones rápidas, equipos y pendientes, con el estilo del dashboard de equipo.

## Impact

- `Front/src/apps/coach/pages/clubs/dashboard/Dashboard.tsx` (+ `Dashboard.module.css`) y componentes nuevos bajo `pages/clubs/dashboard/components/`.
- Servicios existentes reutilizados: `teamService.getTeams`, `clubJoinRequestsApi.getPendingCount`.
- Tests nuevos co-ubicados en `__tests__/`.
- Versión web: `Front/package.json`.
