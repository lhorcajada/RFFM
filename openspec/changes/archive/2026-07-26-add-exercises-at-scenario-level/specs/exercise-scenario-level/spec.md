# Spec — Exercises at Scenario Level

## ADDED Requirements

### Requirement: Vincular ejercicio directamente al escenario

Un ejercicio (`TaskTrainingBase`) SHALL poder vincularse directamente a un `GameScenario`, como alternativa a vincularse a un subprincipio o a un sub-subprincipio.

#### Scenario: Crear ejercicio a nivel de escenario

- **WHEN** el coach añade un ejercicio desde el detalle de un escenario en `game-model`
- **THEN** el ejercicio se crea con `ScenarioId` informado y `SubPrincipleId`/`SubSubPrincipleId` vacíos

### Requirement: Exclusividad mutua de tres niveles

Un ejercicio SHALL estar vinculado a exactamente uno de: escenario, subprincipio o sub-subprincipio.

#### Scenario: Validación al guardar

- **WHEN** se envía una petición de creación o actualización de ejercicio con dos o más de `ScenarioId`/`SubPrincipleId`/`SubSubPrincipleId` informados, o con ninguno
- **THEN** la API rechaza la petición con un error de validación

### Requirement: Filtrado y listado por escenario

El listado de ejercicios SHALL admitir filtrar por `scenarioId`, y la respuesta de un ejercicio SHALL incluir `scenarioId`/`scenarioName` cuando aplique.

#### Scenario: Filtrar ejercicios de un escenario

- **WHEN** se solicita `GET /api/trainings/exercises?clubId=...&scenarioId=...`
- **THEN** la respuesta solo incluye ejercicios vinculados a ese escenario

### Requirement: Conteo de ejercicios visible en el escenario

La cabecera del detalle de escenario SHALL mostrar el número de ejercicios vinculados directamente a él, igual que ya ocurre a nivel de subprincipio y sub-subprincipio.

#### Scenario: Chip de conteo

- **WHEN** un escenario tiene uno o más ejercicios vinculados directamente
- **THEN** su cabecera muestra un chip "{n} ej."

### Requirement: Reasignación entre niveles

El formulario de creación/edición de ejercicio SHALL permitir elegir a cuál de los niveles disponibles (escenario, subprincipio, sub-subprincipio) se vincula el ejercicio, cuando más de uno esté disponible en el contexto de navegación.

#### Scenario: Reasignar un ejercicio existente

- **WHEN** el coach edita un ejercicio y cambia el selector "Vinculado a" a otro nivel disponible
- **THEN** al guardar, el ejercicio queda vinculado exclusivamente al nuevo nivel elegido
