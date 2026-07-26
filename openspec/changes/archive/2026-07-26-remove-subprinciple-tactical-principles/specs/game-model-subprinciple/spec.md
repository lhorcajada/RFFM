# Spec — Game Model Sub-Principle

## REMOVED Requirements

### Requirement: Principios tácticos colectivos a nivel de subprincipio

**Razón**: la relación dejó de aportar valor; se elimina de punta a punta (formulario, vistas de lectura, contrato de API y modelo de datos). El nivel escenario mantiene su propia relación de principios tácticos sin cambios.

**Migración**: los subprincipios que ya tuvieran principios tácticos asignados pierden ese dato al eliminarse la tabla `SubPrincipleTacticalPrinciples` (irrecuperable, aceptado explícitamente por el usuario).

El sistema ya NO permite:
- Asignar principios tácticos colectivos a un subprincipio desde el formulario de edición de `game-model`.
- Ver los principios tácticos de un subprincipio en las vistas de solo lectura (acordeón, vista de impresión del modelo de juego, banner de contexto y HTML de impresión de sesiones creadas desde un subprincipio).
- Recibir o enviar `tacticalPrinciples`/`TacticalPrincipleIds` para un subprincipio a través de la API (`GET /api/game-models`, `POST /api/game-models`, `PUT /api/game-models/{id}`).
