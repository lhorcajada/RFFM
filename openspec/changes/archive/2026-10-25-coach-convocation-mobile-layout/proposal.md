## Why

La pestaña «Convocatoria» del detalle de evento (`/coach/attendance/:id`) no se puede usar en móvil:
cada jugador es una tarjeta «cromo» con una foto de 260 px de alto, así que en pantalla caben uno o
dos jugadores. Además, cuando entra un jugador o un familiar, su propio jugador queda dentro del grupo
de su estado (y de la subcabecera de su posición), mezclado con el resto: tiene que buscarlo para
responder a la convocatoria.

Diseño de referencia: https://claude.ai/artifact/BHPx16LpTyb149pncyy9gE

## What Changes

- **Frontend (Coach, `Front/`)** — solo la pestaña «Convocatoria»:
  - **«Tu jugador»** (Player/FamilyMember): el jugador asociado sale en una tarjeta propia, encima de
    todo y fuera de los grupos, con su estado y las acciones que ya tiene hoy (aceptar/rechazar la
    convocatoria, responder a la disponibilidad, editar el motivo, reactivar en entrenamientos).
  - **Resumen**: cuatro cifras (Convocados, Van, Pendientes, Bajas) encima de los grupos.
  - **Fila compacta** en lugar de la tarjeta cromo en todas las listas (lista de espera, disponibilidad,
    pendientes, aceptados, desconvocados y lesionados): avatar de 36 px con dorsal, nombre, posición o
    motivo, chip de estado y acciones de 44 px. Las acciones secundarias del entrenador sobre un
    aceptado (Desconvocar, Lista de espera) van en un menú «⋮».
  - **Posición**: se quitan las subcabeceras por posición; cada fila lleva una etiqueta (POR, DEF, MED,
    EXT, DEL) y la lista se ordena por grupo de posición.
  - **Grupos por defecto** para Player/FamilyMember: abierto «Aceptados», el resto cerrado.
  - **Información del evento** compacta: tarjeta de 3–4 líneas (tipo + nombre, fecha · horario y
    llegada, lugar con enlace al mapa, rival) con la descripción recortada a dos líneas y «Ver más»,
    en lugar de la rejilla con etiquetas.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `coach-convocation-mobile-layout`: tarjeta «Tu jugador», resumen y fila compacta de la convocatoria.

### Modified Capabilities
- `league-match-availability`: las listas se ordenan por posición con etiqueta en vez de agruparse
  bajo cabeceras; el jugador responde a la disponibilidad desde «Tu jugador».

## Impact

- `Front/src/apps/coach/pages/attendance/`: `AttendanceTabs.tsx`, `components/ConvocationCard.tsx`,
  `AvailabilityList.tsx`, `NotConvokedList.tsx`, `PositionGroupedList.tsx`,
  `utils/positionGroups.ts`, `AttendanceEvent.tsx`; nuevos `PlayerRow`, `OwnPlayerCard`,
  `ConvocationSummary`, `EventInfoCard`, `utils/ownPlayerEntry.ts` y `utils/playerDisplay.ts`; tests
  afectados en `__tests__/`.
- Sin cambios de backend ni de API.
- **Fuera de alcance**: la pestaña «Asistencia», los filtros por estado en forma de pastillas y la
  barra de selección masiva del diseño (se mantienen las acciones actuales en la cabecera del grupo).
