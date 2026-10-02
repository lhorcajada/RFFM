## Why

Entrega R2 del rediseño «seguimiento por sesión». La R1 ya creó el modelo y la API de un seguimiento
por jugador y sesión. Esta entrega cambia lo que ve el entrenador: la pestaña «Seguimiento» deja de ser
una lista de observaciones sueltas y pasa a ser la **lista de sesiones de la temporada**, con la
asistencia del jugador y el estado de cada una. Desde cada sesión se **crea, edita o elimina** el
seguimiento en un diálogo.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - `GET /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations` devuelve las sesiones del
    equipo con fecha, de la más reciente a la más antigua. De cada sesión incluye:
    - si ya se ha celebrado;
    - la asistencia del jugador (tipo de asistencia de su convocatoria al evento vinculado, o sin
      evento);
    - si hay seguimiento, su resumen (cuántos Lo hace / A veces / No lo hace y la fecha de la última
      modificación).
  - Solo el rol Coach, con el permiso `GameModel` (lectura) y pertenencia al equipo.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - La pestaña «Seguimiento» muestra la **lista de sesiones** en tarjetas: fecha, nombre, asistencia,
    estado y acciones **Crear**, **Editar** y **Eliminar**. Las sesiones futuras aparecen con «Aún no
    se ha celebrado» y no se pueden valorar.
  - Arriba, el botón **«Nuevo seguimiento»** abre el diálogo con un selector de sesión: las celebradas
    sin seguimiento.
  - **Diálogo** de crear y editar (pantalla completa en móvil):
    - fecha, nombre y aviso de asistencia (si no asistió, el comentario es obligatorio);
    - «Qué se hizo», con el objetivo y los ejercicios (se corrige el bug de las viñetas vacías);
    - un bloque por subprincipio de la sesión con Lo hace / A veces / No lo hace y un comentario. Al
      editar viene precargado.
    
    Guarda con un único `PUT`.
  - Eliminar pide confirmación (`ConfirmDialog`).
  - Ya no se muestran la lista de observaciones ni los formularios de la fase 1 (actitud, habilidades,
    formulario suelto). Su código se borra en la R5.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-session-evaluation-list`: lista de sesiones de la temporada con asistencia y estado del
  seguimiento, y su creación, edición y borrado desde un diálogo.

## Impact

- `Back/ExtractionApi`: `Features/Coaches/PlayerTracking/GetPlayerSessionEvaluations.cs` (nuevo).
- `Front/src/apps/coach`:
  - `services/playerTrackingService.ts` (funciones del seguimiento por sesión);
  - `pages/player/hooks/useSessionEvaluations.ts` (nuevo);
  - `pages/player/components/tracking/`: `SessionEvaluationList`, `SessionEvaluationDialog` y
    `SessionEvaluationForm` (nuevos); `SessionContent` (bug de campos); `PlayerTrackingPanel`.
- **Fuera de alcance**:
  - contenido completo de la sesión (sub-subprincipios, habilidades, dibujos) y modo «Ver» (R3);
  - comentarios evaluables (R4);
  - borrar el código y la tabla de la fase 1 (R5);
  - filtro por periodo de la lista.
