# Propuesta: Subprincipios objetivo por semana + sesión placeholder de ABP los jueves

## Contexto

El cambio anterior (`session-exercise-plan-redesign`, ya implementado y desplegado) simplificó
`Microciclo` eliminando por completo los enlaces a Subprincipio/SubSubPrincipio que antes vivían
en las "Sesión A/B" del plan. Como efecto colateral, la app ya no muestra qué Subprincipios se
quieren trabajar en una semana concreta hasta que el entrenador ha creado sesiones/ejercicios
reales con sus propios `ModelRelations` — la intención de la semana (lo que el plan de
temporada original, `Plan-de-Temporada.docx`, sí especifica) se perdió como dato de primera
clase.

Además, el equipo trabaja Acciones a Balón Parado (ABP) siempre en la sesión de los jueves —
actualmente no hay ningún mecanismo que refleje esa cadencia fija en el plan.

## Qué cambia (in scope)

- **Backend**: `Microciclo` recupera un campo ligero de referencia — lista de `Subprincipio`s
  objetivo de esa semana (solo intención, sin FOCO/INTEGRADO, sin Habilidades — eso sigue
  viviendo en los `ExerciseModelRelation` de los ejercicios reales). `SeasonPlanImporter` se
  actualiza para extraer esos Subprincipios objetivo desde `Plan-de-Temporada.docx` semana a
  semana, y para crear, por cada `Microciclo`, dos `TrainingSession` placeholder ya vinculadas
  (`MicrocicloId` set): una sesión principal sin día fijo, y una sesión fija de los **jueves**
  etiquetada como ABP — ambas vacías de bloques, listas para que el entrenador las rellene.
  Idempotencia: relanzar el importador no duplica ni los Subprincipios objetivo ni las sesiones
  placeholder ya creadas.
- **Frontend (Coach)**: la pestaña Planificación muestra, por Microciclo, la lista de
  Subprincipios objetivo (chips), junto a las sesiones ya vinculadas que ya se muestran desde el
  cambio anterior.

## Qué NO cambia (out of scope)

- No se reintroduce Habilidades ni FOCO/INTEGRADO a nivel de Microciclo — eso permanece
  exclusivamente en `ExerciseModelRelation` (a nivel de ejercicio), tal como quedó en el cambio
  anterior.
- No se automatiza el contenido de las sesiones placeholder (bloques/ejercicios) — el importador
  solo crea el "hueco" (sesión vacía vinculada a su Microciclo y, en el caso de la de jueves, con
  nombre/objetivo indicando ABP); el entrenador rellena el contenido real a mano.
- `Mobile/` no se toca.

## Motivación

El entrenador necesita ver de un vistazo, por semana del plan, qué Subprincipios se pretenden
trabajar — antes de que existan sesiones/ejercicios concretos — y necesita que la sesión de ABP
de los jueves ya exista como hueco reservado en el calendario del plan, sin tener que crearla
desde cero cada semana.
