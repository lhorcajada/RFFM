# club-kit-configuration Specification

## Purpose
TBD - created by archiving change add-club-kit-configuration. Update Purpose after archive.
## Requirements
### Requirement: Guardar las dos equipaciones de un club/temporada
El sistema SHALL permitir crear o actualizar (upsert), en una sola operación, las dos
equipaciones (kit 1 y kit 2) de un club para la temporada activa de un equipo dado, vía
`PUT /api/teams/{teamId}/kits`. El request SHALL contener exactamente dos entradas
(`kitNumber` 1 y 2, sin duplicados), cada una con `shirtColor`, `shortsColor` y `socksColor`.
El sistema SHALL rechazar un request con un número de equipaciones distinto de 2, o con
`kitNumber` repetido o fuera de `{1, 2}`, con `400 Bad Request`.

#### Scenario: Primera configuración de equipaciones (no existían registros)
- **WHEN** un usuario autorizado envía `PUT /api/teams/{teamId}/kits` con dos equipaciones
  válidas para un club+temporada que no tiene `ClubKit` previos
- **THEN** el sistema crea dos registros `ClubKit` (uno por `kitNumber`) y responde
  `200 OK` con las dos equipaciones creadas

#### Scenario: Actualización de equipaciones existentes
- **WHEN** un usuario autorizado envía `PUT /api/teams/{teamId}/kits` con dos equipaciones
  válidas para un club+temporada que ya tiene `ClubKit` para kit 1 y kit 2
- **THEN** el sistema actualiza los colores de los dos registros `ClubKit` existentes (sin
  crear registros nuevos) y responde `200 OK` con los valores actualizados

#### Scenario: Cantidad de equipaciones incorrecta
- **WHEN** un usuario autorizado envía `PUT /api/teams/{teamId}/kits` con una sola
  equipación, o con dos equipaciones que comparten el mismo `kitNumber`
- **THEN** el sistema responde `400 Bad Request` sin crear ni modificar ningún `ClubKit`

#### Scenario: Equipo inexistente
- **WHEN** se envía `PUT /api/teams/{teamId}/kits` con un `teamId` que no existe
- **THEN** el sistema responde `404 Not Found`

### Requirement: Color de medias explícito
El sistema SHALL exigir un `socksColor` explícito por cada equipación en el request — no lo
deriva ni lo autocompleta a partir de `shortsColor`.

#### Scenario: Medias con color propio distinto del pantalón
- **WHEN** un usuario guarda una equipación con `shortsColor: "#FFFFFF"` y
  `socksColor: "#111111"`
- **THEN** el `ClubKit` resultante tiene `socksColor` igual a `"#111111"` (no hereda el color
  del pantalón)

### Requirement: Formato de color
El sistema SHALL validar que `shirtColor`, `shortsColor` y `socksColor` sean strings
hexadecimales de 6 dígitos con prefijo `#` (patrón `^#[0-9A-Fa-f]{6}$`). El sistema SHALL NOT
validar el color contra una paleta predefinida — esa restricción es responsabilidad exclusiva
del frontend.

#### Scenario: Color con formato inválido
- **WHEN** un usuario envía `shirtColor: "azul"` (no hexadecimal), `shirtColor: "#12"`
  (longitud incorrecta), o `socksColor` ausente/vacío
- **THEN** el sistema responde `400 Bad Request` y no persiste ningún cambio

### Requirement: Autorización por rol
El sistema SHALL permitir ejecutar `PUT /api/teams/{teamId}/kits` únicamente a usuarios con
alguno de los roles `Administrator`, `Coach`, `ClubDirector` o `ClubMember`.

#### Scenario: Rol no autorizado
- **WHEN** un usuario autenticado sin ninguno de los roles permitidos invoca
  `PUT /api/teams/{teamId}/kits`
- **THEN** el sistema responde `403 Forbidden` y no persiste ningún cambio

