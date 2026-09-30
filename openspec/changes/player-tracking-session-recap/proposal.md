## Why

Entrega 1c del seguimiento del modelo de juego. La hoja de ruta está en
`docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.

Con la 1b, el entrenador elige de memoria un subprincipio y una fecha. En la práctica no recuerda qué
trabajó en cada sesión, así que tiene que ir a mirarlo antes de rellenar, y el registro no se va a
usar. Él piensa por **sesión**: «hoy hemos entrenado esto, ¿cómo ha respondido este jugador?».
Además, si el jugador no fue al entrenamiento, el entrenador debe saberlo antes de valorar, para dejar
el comentario que corresponda.

## What Changes

- **Frontend (Coach, `Front/`)**, en la pestaña «Seguimiento» de la ficha del jugador:
  - Nuevo selector **«Sesión»**: «Sin sesión» o las sesiones del equipo con fecha en los últimos 30
    días, la más reciente primero.
  - Al elegir una sesión, el formulario pasa a ser **«Valorar la sesión»**:
    - **no hay campo de fecha ni buscador de subprincipio**: la fecha es la de la sesión y los
      subprincipios son los de la sesión;
    - **asistencia del jugador** a esa sesión:
      - si no asistió, aviso destacado y **comentario obligatorio** en cada subprincipio que se valore;
      - si llegó tarde, un aviso informativo;
      - si no hay asistencia registrada o la sesión no está vinculada al calendario, se indica;
    - **qué se hizo**: objetivo general y los ejercicios de cada bloque, a la vista para revisarlos;
    - **un bloque por subprincipio** de la sesión (con sus roles y zonas), con los tres botones Lo
      hace / A veces / No lo hace y un comentario opcional;
    - un único «Guardar» crea **una observación por cada subprincipio valorado**; los que no se
      valoran no se guardan.
  - «Sin sesión» mantiene el formulario de la 1b (fecha y subprincipio), para observaciones sueltas.
- Solo web. Reutiliza endpoints que ya existen: sesiones, detalle de sesión, convocatorias del evento
  (asistencia) y alta de observaciones.
- **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-tracking-session-recap`: valorar a un jugador sobre los subprincipios de una sesión reciente,
  viendo su contenido y su asistencia.

## Impact

- `Front/src/apps/coach/pages/player`:
  - hooks nuevos `useRecentSessions`, `useSessionDetail`, `usePlayerSessionAttendance`;
  - componentes nuevos en `components/tracking/`: `SessionObservationForm`, `SessionContent`,
    `AssessmentButtons` (extraído del formulario de la 1b);
  - cambios en `PlayerTrackingPanel`.
- **Fuera de alcance**:
  - guardar el vínculo observación ↔ sesión (1d, necesita backend);
  - valorar a varios jugadores a la vez desde la sesión (entrega posterior).
