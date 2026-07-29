# Spec — Exercise Methodology

## ADDED Requirements

### Requirement: Clasificación de ejercicios por metodología

Un ejercicio (`TaskTrainingBase`) SHALL tener asignada una metodología de entrenamiento de valor único: `Analitico`, `Integrado` o `Global`. El campo es obligatorio.

#### Scenario: Crear ejercicio con metodología

- **WHEN** el coach crea un ejercicio y selecciona una metodología
- **THEN** el ejercicio se persiste con esa metodología

#### Scenario: Rechazar metodología inválida o vacía

- **WHEN** se envía una petición de creación o actualización de ejercicio con `Methodology` vacío o con un valor distinto de `Analitico`/`Integrado`/`Global`
- **THEN** la API rechaza la petición con un error de validación

### Requirement: Edición de la metodología

El coach SHALL poder cambiar la metodología de un ejercicio existente desde el formulario de edición.

#### Scenario: Editar metodología

- **WHEN** el coach edita un ejercicio y cambia el selector de metodología a un valor distinto
- **THEN** al guardar, el ejercicio queda con la nueva metodología

### Requirement: Filtrado del listado por metodología

El listado de ejercicios SHALL admitir filtrar por metodología.

#### Scenario: Filtrar ejercicios por metodología

- **WHEN** se solicita `GET /api/trainings/exercises?clubId=...&methodology=Global`
- **THEN** la respuesta solo incluye ejercicios con esa metodología

### Requirement: Visibilidad de la metodología en el listado

La tarjeta de ejercicio (`ExerciseCromo`) del listado SHALL mostrar la metodología del ejercicio.

#### Scenario: Pill de metodología visible

- **WHEN** se renderiza la tarjeta de un ejercicio en el listado
- **THEN** se muestra un elemento visual con la etiqueta de su metodología (Analítico, Integrado o Global)
