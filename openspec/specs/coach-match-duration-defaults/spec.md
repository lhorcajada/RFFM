# coach-match-duration-defaults Specification

## Purpose
TBD - created by archiving change live-match-default-duration-by-category. Update Purpose after archive.
## Requirements
### Requirement: Duración de partido por defecto según categoría del equipo
Las pestañas "Simular Partido" y "Partido en Directo" SHALL inicializar la duración de cada parte
(`halfDuration`) con la duración estándar F11 de la categoría del equipo (Alevín 30, Infantil 35,
Cadete 40, Juvenil 45 minutos) cuando el backend la resuelva para ese equipo, en vez de un valor
fijo hardcodeado. El entrenador SHALL poder seguir editando ese valor libremente en cualquier
momento antes de iniciar el partido, y una edición manual SHALL NOT ser sobrescrita por la
resolución posterior del valor de categoría. Para categorías sin duración estándar registrada
(no F11), SHALL mantenerse el valor por defecto actual del formulario, sin cambios.

#### Scenario: Equipo Alevín abre Partido en Directo
- **GIVEN** un equipo de categoría Alevín (duración estándar 30 minutos)
- **WHEN** el entrenador abre la pestaña "Partido en Directo" antes de iniciar el partido
- **THEN** el campo de duración de parte muestra 30 minutos por defecto

#### Scenario: Equipo Juvenil abre Simular Partido
- **GIVEN** un equipo de categoría Juvenil (duración estándar 45 minutos)
- **WHEN** el entrenador abre la pestaña "Simular Partido" antes de iniciar la simulación
- **THEN** el campo de duración de parte muestra 45 minutos por defecto

#### Scenario: Categoría sin duración estándar registrada
- **GIVEN** un equipo de una categoría distinta de Alevín/Infantil/Cadete/Juvenil (p. ej.
  Benjamín)
- **WHEN** el entrenador abre "Simular Partido" o "Partido en Directo"
- **THEN** el campo de duración de parte mantiene el valor por defecto actual del formulario, sin
  aplicar ningún valor de categoría

#### Scenario: Edición manual no se sobrescribe al resolver la categoría
- **GIVEN** el entrenador cambia manualmente la duración de parte a un valor distinto del estándar
  de la categoría de su equipo
- **WHEN** la respuesta con la duración estándar de la categoría llega después de esa edición
- **THEN** el campo de duración de parte conserva el valor introducido manualmente por el
  entrenador

