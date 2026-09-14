# coach-simulation-bench-layout Specification

## Purpose
TBD - created by archiving change coach-simulation-bench-tablet-layout. Update Purpose after archive.
## Requirements
### Requirement: Tarjetas de campo sin competitividad ni barras de forma, en todos los tamaños
Las tarjetas de jugador dibujadas sobre el campo (`SimulationPlayerSlot`, en cualquiera de sus modos: preparación de cambio, reposicionamiento libre, o estática) en las pestañas "Simulación" y "Partido en Directo" SHALL mostrar únicamente foto o iniciales, dorsal, nombre debajo de la tarjeta, y los badges funcionales existentes (ENTRA, SALE, ⚽ de gol, "Equipo N" cuando el jugador está usado en otra pestaña), y SHALL NOT mostrar el badge de competitividad ni las barras de forma (rodaje/cansancio) sobre la tarjeta de campo. Este recorte SHALL aplicarse en cualquier ancho de viewport (móvil, tablet y escritorio).

#### Scenario: Tarjeta de campo en modo preparación de cambio
- **WHEN** un jugador está colocado en un slot del campo durante `prepareMode`
- **THEN** su tarjeta muestra foto/iniciales, dorsal y nombre, y no muestra ningún badge de
  competitividad ni barras de forma

#### Scenario: Tarjeta de campo en modo estático
- **WHEN** un jugador está colocado en un slot del campo fuera de `prepareMode` y sin
  reposicionamiento libre activo
- **THEN** su tarjeta muestra foto/iniciales, dorsal y nombre, y no muestra ningún badge de
  competitividad ni barras de forma

### Requirement: Banquillo lateral compacto e interactivo, en todos los tamaños
El panel lateral de banquillo (`.sidePanel`), junto al campo, SHALL mostrar cada jugador con una tarjeta compacta con el mismo lenguaje visual que las tarjetas de campo (foto o iniciales, dorsal, nombre, minutos jugados cuando sean mayores que cero), SHALL NOT mostrar competitividad, racha ni barras de forma en esa tarjeta compacta, y este formato SHALL aplicarse en cualquier ancho de viewport (móvil, tablet, escritorio) — no solo en un rango de tablet.

#### Scenario: Tarjeta compacta de banquillo con minutos jugados
- **GIVEN** un jugador en el banquillo ha acumulado minutos jugados en el partido
- **WHEN** se muestra en el panel lateral de banquillo
- **THEN** su tarjeta compacta incluye una etiqueta con los minutos, sin mostrar competitividad,
  racha ni barras de forma

#### Scenario: Tarjeta compacta de banquillo sin minutos jugados
- **GIVEN** un jugador en el banquillo no ha jugado minutos todavía
- **WHEN** se muestra en el panel lateral de banquillo
- **THEN** su tarjeta compacta no incluye una etiqueta de minutos

### Requirement: El banquillo lateral compacto sigue siendo la zona de arrastre para sustituciones
Las tarjetas del panel lateral de banquillo SHALL seguir siendo arrastrables mediante el mismo mecanismo de drag-and-drop existente (`sim-player-{teamPlayerId}` como origen, `sim-slot-{index}` o `sim-bench` como destino) durante una ventana de sustitución en preparación, y un jugador arrastrado desde el banquillo hasta un slot del campo SHALL completar la ventana de sustitución igual que antes de este cambio.

#### Scenario: Arrastrar un jugador del banquillo compacto a un slot vacío del campo en modo preparación
- **GIVEN** el entrenador ha iniciado una ventana de sustitución (`prepareMode`)
- **WHEN** arrastra una tarjeta compacta del panel lateral de banquillo hasta un slot vacío de la
  vista previa del campo
- **THEN** el jugador aparece en ese slot en la vista previa y deja de listarse en el banquillo

#### Scenario: Devolver un jugador al banquillo compacto durante la preparación
- **GIVEN** el entrenador ha iniciado una ventana de sustitución (`prepareMode`) y un jugador
  está en la vista previa del campo
- **WHEN** arrastra su tarjeta de vuelta a la zona del banquillo (`sim-bench`)
- **THEN** el jugador vuelve a listarse en el banquillo lateral compacto

### Requirement: Bloque informativo "En el campo" y "Banquillo", siempre visible en todos los tamaños
Debajo del bloque campo + banquillo compacto, a todo lo ancho, SHALL existir una sección siempre visible (en cualquier ancho de viewport, sin restringirse a un rango de tablet) con dos listados de solo lectura que usan la tarjeta rica (`BenchPlayerCard`: foto, dorsal, nombre, competitividad, racha, minutos jugados o SALE, barras de forma): "En el campo" (jugadores actualmente en el campo o en la vista previa) y "Banquillo" (los mismos jugadores que el banquillo lateral compacto, con información completa). Ninguna de las tarjetas de estos dos listados SHALL ser arrastrable ni aceptar jugadores soltados sobre ellas.

#### Scenario: El bloque informativo se muestra en escritorio, tablet y móvil
- **WHEN** la pestaña de simulación se visualiza en un viewport de escritorio, de tablet o de
  móvil
- **THEN** los listados "En el campo" y "Banquillo" con tarjetas ricas están presentes en la
  página en los tres casos

#### Scenario: El listado informativo "Banquillo" no es arrastrable
- **WHEN** el entrenador intenta arrastrar una tarjeta del listado informativo "Banquillo"
- **THEN** la tarjeta no se mueve y no se dispara ningún evento de dnd-kit

#### Scenario: El listado informativo "En el campo" no es arrastrable
- **WHEN** el entrenador intenta arrastrar una tarjeta del listado informativo "En el campo"
- **THEN** la tarjeta no se mueve y no se dispara ningún evento de dnd-kit

#### Scenario: El listado informativo "Banquillo" refleja la vista previa durante una sustitución
- **GIVEN** el entrenador está en `prepareMode` con una vista previa que difiere del campo real
- **WHEN** se muestra el listado informativo "Banquillo"
- **THEN** contiene exactamente los mismos jugadores que el banquillo lateral compacto en ese
  momento (los de la vista previa, no los del campo real)

### Requirement: Comportamiento idéntico en Simulación y Partido en Directo
El banquillo lateral compacto y arrastrable, y el bloque informativo con "En el campo" y "Banquillo" SHALL comportarse de forma idéntica en la pestaña "Simulación" (`SimulacionTab`) y en la pestaña "Partido en Directo" (`PartidoEnDirectoTab`).

#### Scenario: Mismo comportamiento en ambas pestañas
- **WHEN** se abre la pestaña "Simulación" y, por separado, la pestaña "Partido en Directo" para
  el mismo partido, en el mismo viewport
- **THEN** ambas renderizan el banquillo lateral compacto y el bloque informativo con el mismo
  marcado y comportamiento de arrastre

### Requirement: Reposicionamiento libre sin ventana de sustitución no cambia
El reposicionamiento de un jugador ya en el campo, fuera de `prepareMode` y con `freeRepositionEnabled` activo (Partido en Directo), SHALL seguir realizándose arrastrando directamente sobre las tarjetas del propio campo, sin pasar por el banquillo lateral ni por el bloque informativo, en cualquier tamaño de viewport.

#### Scenario: Reposicionar un jugador en el campo sin sustitución
- **GIVEN** `freeRepositionEnabled` es `true` y no hay ninguna ventana de sustitución en curso
- **WHEN** el entrenador arrastra la tarjeta de un jugador del campo hasta otro slot ocupado del
  campo
- **THEN** ambos jugadores intercambian de slot, igual que antes de este cambio

### Requirement: Breakpoint móvil existente no se rompe
En viewports por debajo de 780px de ancho, el layout de la pestaña de simulación SHALL seguir siendo utilizable: el campo y el panel de banquillo compacto SHALL apilarse en una sola columna, el bloque informativo debajo SHALL seguir siendo accesible mediante scroll de página, el campo SHALL mostrarse rotado 90° (porterías arriba/abajo, en vez de izquierda/derecha) para aprovechar el espacio vertical disponible, y el marcador (`LiveMatchScoreboard`, en "Partido en Directo") SHALL mostrarse en una versión compacta (menor padding, tipografía y escudos reducidos).

#### Scenario: Layout apilado por debajo de 780px
- **WHEN** el viewport tiene un ancho menor a 780px
- **THEN** el campo y el panel de banquillo compacto se muestran en una sola columna, y el
  bloque informativo con "En el campo"/"Banquillo" permanece accesible debajo mediante scroll de
  página

#### Scenario: El campo se muestra rotado en móvil
- **WHEN** el viewport tiene un ancho menor o igual a 780px
- **THEN** el campo se renderiza con orientación portrait (porterías arriba/abajo) en vez de la
  orientación apaisada usada en tablet y escritorio, sin alterar los datos de posición
  (`FORMATION_POSITIONS`/`FormationSlotDef`) compartidos con el resto de la aplicación

#### Scenario: El campo no se rota en tablet ni escritorio
- **WHEN** el viewport tiene un ancho mayor a 780px
- **THEN** el campo conserva la orientación apaisada existente (porterías izquierda/derecha), sin
  ningún cambio respecto al comportamiento anterior a este change

### Requirement: Contenido de cada tarjeta de campo se muestra en pie tras la rotación móvil
El contenido de cada `SimulationPlayerSlot` (foto/iniciales, dorsal, nombre, minuteTag, badges ENTRA/SALE/⚽/"Equipo N") SHALL mostrarse en la misma orientación en pie (no girado) que en tablet y escritorio cuando el campo se muestra rotado en móvil, únicamente reposicionado según la rotación del campo.

#### Scenario: Tarjeta legible tras la rotación
- **GIVEN** el campo se muestra rotado en un viewport móvil
- **WHEN** un slot tiene un jugador asignado
- **THEN** su foto, dorsal y nombre se leen en la misma orientación vertical que en escritorio,
  sin aparecer girados 90°

### Requirement: El arrastre de sustituciones sigue funcionando con el campo rotado en móvil
El mecanismo de arrastrar y soltar existente (`sim-player-{teamPlayerId}` como origen desde el banquillo compacto, `sim-slot-{index}` o `sim-bench` como destino) SHALL seguir funcionando sin cambios de comportamiento cuando el campo está rotado en móvil, y el destino de un arrastre SHALL corresponder al slot que el usuario ve visualmente bajo el puntero/dedo, no a una posición lógica no rotada.

#### Scenario: Arrastrar un jugador del banquillo a un slot vacío con el campo rotado
- **GIVEN** el entrenador ha iniciado una ventana de sustitución (`prepareMode`) en un viewport
  móvil, con el campo mostrado rotado
- **WHEN** arrastra una tarjeta compacta del banquillo hasta el slot vacío que ve visualmente en
  el campo rotado
- **THEN** el jugador aparece en ese mismo slot visual en la vista previa, igual que en tablet o
  escritorio

### Requirement: Banquillo lateral compacto sin scroll forzoso en móvil para bancos típicos
En viewports móviles, el panel lateral de banquillo compacto (`.sidePanel`) SHALL mostrar un
banquillo de tamaño típico de fútbol base (hasta 9 jugadores) sin requerir scroll interno,
mediante un tamaño de tarjeta reducido respecto a tablet/escritorio; el `overflow-y: auto` de
seguridad existente SHALL conservarse para bancos inusualmente largos.

#### Scenario: Banquillo típico visible sin scroll en móvil
- **GIVEN** un banquillo de 9 jugadores en un viewport móvil de referencia (≥375px de ancho)
- **WHEN** se muestra el panel lateral de banquillo compacto
- **THEN** todas las tarjetas son visibles sin necesidad de hacer scroll dentro del panel

### Requirement: Marcador compacto en móvil (Partido en Directo)
En viewports móviles, `LiveMatchScoreboard` SHALL mostrarse con menor padding, tipografía de
marcador y nombres de equipo reducida, y escudos (`localTeamShield`/`visitorTeamShield`) de menor
tamaño que en tablet/escritorio, conservando toda su funcionalidad (registro de goles y
tarjetas).

#### Scenario: Marcador reducido en móvil
- **WHEN** `PartidoEnDirectoTab` se visualiza en un viewport móvil
- **THEN** el marcador ocupa menos espacio vertical que en escritorio, y los escudos de equipo se
  muestran a menor tamaño, sin perder ninguno de los botones de registro de eventos

