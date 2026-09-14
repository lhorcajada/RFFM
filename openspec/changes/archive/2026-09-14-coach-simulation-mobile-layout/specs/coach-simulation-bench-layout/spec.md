## MODIFIED Requirements

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

## ADDED Requirements

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
