# match-played-duration Specification

## Purpose
TBD - created by archiving change match-played-duration. Update Purpose after archive.
## Requirements
### Requirement: Duración del partido guardada y editable desde el directo
El sistema SHALL guardar en cada evento de partido su duración en minutos
(`MatchDurationMinutes`, opcional). `POST /api/events/{eventId}/match-participation` SHALL
aceptarla y guardarla cuando el partido se guarda como finalizado, y
`GET /api/events/{eventId}/match-participation` SHALL devolverla. En el partido en directo, la
duración SHALL rellenarse sola al terminar el partido y SHALL poder editarse en la edición
manual del partido.

#### Scenario: Guardar la duración al finalizar
- **WHEN** se guarda un partido con `MatchPhase` `finished` y `MatchDurationMinutes` 76
- **THEN** el evento queda con `MatchDurationMinutes` 76 y la consulta de participación lo devuelve

#### Scenario: Cliente que no envía la duración
- **WHEN** se guarda un partido finalizado sin `MatchDurationMinutes`
- **THEN** el valor guardado previamente no cambia

#### Scenario: Duración fuera de rango
- **WHEN** se envía `MatchDurationMinutes` menor que 0 o mayor que 200
- **THEN** la respuesta es `400` con `ProblemDetails`

#### Scenario: Autorrelleno con el cronómetro
- **WHEN** el entrenador termina un partido en directo en el minuto 83 del cronómetro
- **THEN** la duración del partido es 83

#### Scenario: Autorrelleno sin cronómetro
- **WHEN** el entrenador termina un partido en directo sin haber usado el cronómetro y los minutos
  por parte son 40
- **THEN** la duración del partido es 80

#### Scenario: Edición manual
- **WHEN** el entrenador abre "Edición manual del partido", cambia la duración a 70 y guarda
- **THEN** el partido se guarda con `MatchDurationMinutes` 70

#### Scenario: Validación en la edición manual
- **WHEN** el entrenador escribe una duración vacía, negativa o mayor que 200
- **THEN** se muestra un error y no se guarda

