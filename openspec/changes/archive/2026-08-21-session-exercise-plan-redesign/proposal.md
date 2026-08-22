# Propuesta: Rediseño de Ejercicios, Sesiones y Plan de Temporada

## Contexto

`docs/game-model/` define una nueva estructura documental para el modelo de juego:
`Plantilla-Ejercicio.md` (versión reducida) describe el formato de un ejercicio, y
`Plantilla-Sesion.md` describe una sesión como una secuencia de **bloques**, cada uno con
uno o varios ejercicios en paralelo. `Ejemplo-Sesion.md` (basado en `Sesion-1.pdf`) es el
contenido real de referencia para el seed.

El modelo actual (`seasonPlanService.ts`, `seasonPrepSessionService.ts`, features de
backend asociadas) asocia **ejercicios** directamente al plan de temporada y usa un
formulario de ejercicio demasiado estrecho para los campos nuevos (niveles con palancas
variables, relación con el modelo de juego repetible, objetivo por rol, etc.).

## Qué cambia (in scope)

- **Backend**: nuevo modelo de datos para Ejercicio (con niveles/palancas dinámicos,
  relación con modelo de juego repetible, logística en texto libre, opcional) y Sesión
  (ubicación en el plan opcional, bloques con ejercicios asociados en paralelo). El plan de
  temporada pasa a asociar **sesiones**, no ejercicios. Eliminación de ejercicios existentes
  en BD de desarrollo + migración de esquema + seed nuevo basado en `Ejemplo-Sesion.md`.
- **Frontend (Coach)**: formulario ancho de ejercicio con los campos nuevos; formulario de
  sesión (bloques + ejercicios asociados, con opción de asociar o no a un plan/microciclo);
  pestaña "Plan de temporada" pasa a ser la primera y asocia sesiones; listados de
  Ejercicios y de Sesiones que distinguen visualmente los asociados al plan/modelo de los
  independientes.

## Qué NO cambia (out of scope)

- `Mobile/` no se toca en este cambio (consumo de sesiones/ejercicios desde Coach app solo,
  vía Front SPA).
- No se migran datos existentes de ejercicios — se eliminan en desarrollo y se regeneran
  con seed nuevo.
- No se aborda edición visual del "Dibujo"/mapa de campo (se mantiene como referencia de
  texto/imagen adjunta, no un editor gráfico).

## Motivación

El formulario actual no soporta los campos que exige la documentación real de
planificación (niveles con palancas configurables, relación repetible con el modelo de
juego, bloques de sesión con ejercicios en paralelo). Sin este rediseño, el entrenador no
puede registrar sesiones reales como `Sesion-1.pdf` en la aplicación.
