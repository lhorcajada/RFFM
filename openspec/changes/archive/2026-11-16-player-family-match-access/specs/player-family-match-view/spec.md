## Purpose
Define la vista restringida y de solo lectura de la pantalla de partido para jugadores y familiares, de modo que consulten convocatoria y desconvocatorias sin gestionar el partido.

## ADDED Requirements

### Requirement: Players and family can open the match screen
Los usuarios con rol Player, FamilyPlayer o FamilyMember (sin rol Coach ni Administrator) SHALL poder abrir `/coach/convocations/match` y `/coach/convocations/live` siempre que tengan acceso a la funcionalidad Convocations.

#### Scenario: Player opens the match screen
- **WHEN** un jugador navega a la pantalla de partido de su equipo
- **THEN** la pantalla se muestra y no se le redirige al dashboard

#### Scenario: Coach keeps full access
- **WHEN** un usuario con rol Coach abre la pantalla de partido
- **THEN** ve todas las pestañas y acciones actuales

### Requirement: Only Convocatoria and Desconvocatorias tabs
Para jugadores y familiares, la pantalla de partido SHALL mostrar únicamente las pestañas Desconvocatorias y Convocatoria, y NO SHALL mostrar Alineación ni Simular Partido.

#### Scenario: Restricted tabs
- **WHEN** un jugador abre la pantalla de partido
- **THEN** solo ve las pestañas Desconvocatorias y Convocatoria

### Requirement: Action bar limited to Volver
Para jugadores y familiares, la barra de acciones SHALL mostrar solo "Volver", sin "Ir al evento", "Guardar", "PDF" ni "Ver convocatoria".

#### Scenario: Only Volver
- **WHEN** un jugador abre la pantalla de partido antes de que empiece el partido
- **THEN** la barra de acciones solo contiene "Volver"

### Requirement: Live match button only after kickoff
Para jugadores y familiares, el botón "Partido en directo" SHALL mostrarse solo cuando la fecha y hora actuales sean iguales o posteriores al inicio del evento.

#### Scenario: Before kickoff
- **WHEN** un jugador abre la pantalla antes de la hora de inicio
- **THEN** no ve "Partido en directo"

#### Scenario: After kickoff
- **WHEN** un jugador abre la pantalla en o después de la hora de inicio
- **THEN** ve "Partido en directo" junto a "Volver"

### Requirement: Read-only Convocatoria tab
Para jugadores y familiares, la pestaña Convocatoria SHALL ser de solo lectura: sin "Proponer desconvocados", sin arrastrar jugadores entre zonas y sin acciones de convocar o desconvocar.

#### Scenario: No proposal button
- **WHEN** un jugador abre la pestaña Convocatoria
- **THEN** no ve "Proponer desconvocados"

#### Scenario: No management actions
- **WHEN** un jugador ve las tarjetas de la pestaña Convocatoria
- **THEN** no puede arrastrarlas ni moverlas a Convocados o Desconvocados

### Requirement: Read-only live match for players
Para jugadores y familiares, la pantalla de partido en directo SHALL mostrar el estado del partido sin controles que registren acciones.

#### Scenario: No live controls
- **WHEN** un jugador abre el partido en directo
- **THEN** ve el marcador y los eventos y no dispone de controles para registrar acciones

### Requirement: League match event page redirects to the match screen
Para jugadores y familiares, la página del evento de un partido de liga SHALL redirigir a la pantalla de partido, igual que para el coach, sin mostrar el formulario de asistencia.

#### Scenario: Player opens a league match event
- **WHEN** un jugador o familiar abre la página del evento de un partido de liga
- **THEN** se le lleva directamente a `/coach/convocations/match` con el equipo y el evento

#### Scenario: Friendly keeps the attendance page
- **WHEN** un jugador abre la página del evento de un amistoso
- **THEN** ve la página de asistencia sin redirección
