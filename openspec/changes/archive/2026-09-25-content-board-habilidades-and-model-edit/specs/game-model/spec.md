## ADDED Requirements

### Requirement: El editor del modelo vuelve a la pantalla de origen
El editor del Modelo de Juego (`/coach/game-model/create` y `/coach/game-model/edit`) SHALL aceptar
un `returnTo` en el state de navegación. Al guardar correctamente o al cancelar, SHALL navegar a
`returnTo` si existe y, si no, a `/coach/game-model` conservando la query string, como hasta ahora.

#### Scenario: Volver al origen al guardar
- **WHEN** el editor se abrió con `returnTo` "/coach/trainings/content-board?teamId=t1" y el
  entrenador guarda
- **THEN** se navega a "/coach/trainings/content-board?teamId=t1"

#### Scenario: Volver al origen al cancelar
- **WHEN** el editor se abrió con `returnTo` y el entrenador cancela
- **THEN** se navega a `returnTo`

#### Scenario: Sin origen
- **WHEN** el editor se abrió sin `returnTo` y el entrenador guarda
- **THEN** se navega a `/coach/game-model` con la misma query string
