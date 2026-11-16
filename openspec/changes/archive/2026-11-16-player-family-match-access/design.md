## Context

- `routes.tsx` protege `convocations/match` y `convocations/live` con `RequireFeaturePermission allowPlayerAccess={false}` (verificado).
- `ConvocationMatchDetail` ya recibe todo el estado; la barra de acciones y las pestañas se renderizan sin distinguir rol (verificado).
- `GetLiveMatch` exige `Coach,Administrator` y el chequeo de equipo del hub solo admite coaches asignados (verificado en el spec; el código del chequeo compartido no se ha leído aún).
- Asunción a verificar: los endpoints de convocatoria y del grid de desconvocatorias responden a un jugador.

## Goals / Non-Goals

Goals:
- Vista restringida de solo lectura para Player, FamilyPlayer y FamilyMember.
- Directo visible en solo lectura tras la hora de inicio.

Non-goals:
- Cambiar la vista de coaches.
- Permitir a jugadores cualquier acción de escritura.
- Notificaciones o cambios en `AttendanceEvent`.

## Decisions

### D1. Rol con `useIsPlayerRole`
Un único booleano `isPlayer` se calcula en `ConvocationMatchDetail` y `LiveMatchPage` con el hook existente. Alternativa descartada: nuevo contexto de permisos, por exceso de alcance.

### D2. Props de restricción en lugar de ramas dispersas
`ConvocationMatchActionBar` recibe `readOnly` y `showLiveMatch`; `ConvocationTab` recibe `readOnly` que oculta la barra de propuesta y desactiva arrastre y botones de mover. Las pestañas se filtran en `ConvocationMatchDetail`.

### D3. Inicio del partido
`showLiveMatch` para jugador = `Date.now() >= inicio del evento`, calculado desde `match.date` y `match.time`. Para coach no cambia.

### D4. Directo en solo lectura
Para jugadores, `LiveMatchPage` renderiza un visor propio `LiveMatchViewer` (marcador, fase, reloj, goles y tarjetas desde el estado del servidor) en lugar de `PartidoEnDirectoTab`, de 972 líneas y con muchas rutas de escritura; así no se retoca el flujo del coach. Backend: `GetLiveMatch` y el join del hub aceptan a jugadores/familiares asociados al equipo; las acciones siguen en coach.

### D5. Guard de ruta
Se elimina `allowPlayerAccess={false}` en `match` y `live`; `lineup` y `simulation` lo conservan.

## Target State

Jugador: ve Desconvocatorias y Convocatoria, botón Volver y, tras el inicio, Partido en directo con vista de solo lectura. Coach/Administrador: sin cambios.

## Risks / Trade-offs

- Endpoints de convocatoria/grid pueden devolver 403 a jugadores: se verifica primero y, si es así, se abre su lectura.
- La seguridad no puede depender solo del front: el backend mantiene acciones solo para coaches.
- Ocultar botones no impide llamar a la API: las escrituras de convocatoria ya están protegidas en backend (verificar).

## Migration Plan

Not applicable: sin cambios de esquema ni datos.

## Validation Strategy

- Vitest: `ConvocationMatchDetail` como jugador (pestañas, barra, sin propuesta), `ConvocationMatchActionBar` antes y después del inicio, `ConvocationTab` readOnly, `LiveMatchViewer` y `LiveMatchPage` como jugador.
- xUnit/funcional: lectura del directo por jugador del equipo (200), de otro equipo (403), acción por jugador (403), join del hub.

## ADR / DDR Evaluation

Neither: es un ajuste de autorización dentro de patrones existentes.

## Open Questions

None
