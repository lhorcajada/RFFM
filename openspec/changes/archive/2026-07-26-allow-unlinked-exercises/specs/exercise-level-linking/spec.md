# Spec — Exercise Level Linking

## MODIFIED Requirements

### Requirement: Exclusividad mutua de niveles del ejercicio

Un ejercicio SHALL estar vinculado a **como máximo uno** de: escenario, subprincipio o sub-subprincipio. A diferencia del comportamiento anterior, ya NO es obligatorio vincularlo a ninguno — un ejercicio puede quedar sin vincular a ningún nivel del modelo de juego.

#### Scenario: Crear ejercicio sin ningún nivel

- **WHEN** se envía una petición de creación de ejercicio sin `ScenarioId`, `SubPrincipleId` ni `SubSubPrincipleId`
- **THEN** la API acepta la petición y el ejercicio se crea sin vínculo a ningún nivel

#### Scenario: Validación al guardar con más de un nivel

- **WHEN** se envía una petición de creación o actualización con dos o más de `ScenarioId`/`SubPrincipleId`/`SubSubPrincipleId` informados
- **THEN** la API rechaza la petición con un error de validación

#### Scenario: Desvincular un ejercicio existente

- **WHEN** se actualiza un ejercicio ya vinculado a un nivel, enviando los tres ids vacíos
- **THEN** el ejercicio queda sin vínculo a ningún nivel
