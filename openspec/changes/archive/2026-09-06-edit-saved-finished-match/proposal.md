# Proposal: Permitir editar un partido ya guardado (no solo en la misma sesión)

## Ownership
Frontend (`Front/src/apps/coach/`). Sin cambios de backend.

## Rationale
El cambio anterior (`edit-finished-match-goals-cards`, archivado) añadió edición de
goles/tarjetas/minutos al diálogo "Edición manual del partido", pero solo funciona **dentro de
la misma sesión** en la que se disputó/simuló el partido: el botón de edición y sus datos
dependen de `live.matchPhase === "finished"` y de `live.goals`/`live.cards`/minutos en memoria.

Al recargar la página o volver más tarde a un partido ya guardado (`getMatchParticipation`
devuelve `matchPhase: "finished"`), el hook `useLiveMatch` marca `hasSavedData = true` y expone
`savedParticipationData`, pero **nunca hidrata** `matchPhase`, `goals`, `cards`, `scoreLocal`/
`scoreVisitor` en el estado en memoria — y además `initMatch()` (invocado siempre al cargar la
alineación) resetea incondicionalmente esos mismos campos a sus valores de partido no
empezado. Resultado: al volver a un partido guardado solo se ve el resumen de solo lectura y el
botón "Eliminar datos del partido"; no hay forma de reabrir la edición.

## Scope
- Al detectar un partido ya guardado (`matchPhase === "finished"` en la respuesta de
  `getMatchParticipation`), hidratar el estado en memoria del hook (`matchPhase`, `scoreLocal`,
  `scoreVisitor`, `goals`, `cards`, `windows`, `formationChanges`, `ratingSnapshots`) a partir de
  esos datos persistidos, de forma robusta frente al orden de resolución entre el fetch de la
  alineación (que dispara `initMatch`) y el fetch de la participación guardada.
- Sembrar los minutos manuales del diálogo de edición a partir de `savedParticipationData.players`
  cuando no haya overrides ya introducidos en la sesión.
- Al re-guardar tras reabrir, preservar el `isStarter` persistido en vez de recalcularlo desde
  una alineación inicial que no existe tras recargar.
- Reutilizar íntegramente la UI ya existente del cambio anterior (mismo diálogo, mismos
  callbacks) — no se crean componentes nuevos.

## Non-goals
- No se restauran `slots`/`playerStates` de la simulación en vivo (nunca se persisten en
  backend) — la vista tras reabrir es de edición post-partido, no de simulación en vivo.
- Sin cambios de API/backend.
