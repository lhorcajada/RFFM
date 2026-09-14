## Why

En móvil, el campo de las pestañas "Simulación" y "Partido en Directo" (Coach) mantiene la
orientación apaisada (105:68, porterías izquierda/derecha) simplemente estirada en un contenedor
estrecho y alto, lo que apelotona las tarjetas de jugador y dificulta ver huecos y arrastrar
sustituciones. El marcador (`LiveMatchScoreboard`) y sus escudos ocupan además espacio vertical
desproporcionado en una pantalla pequeña. El rediseño móvil ya se había identificado como tarea
aparte (ver `coach-simulation-bench-tablet-layout`, Non-Goals) y el usuario lo pide ahora
explícitamente.

## What Changes

- En móvil (`<=780px`, breakpoint ya existente en `SimulacionTab.module.css`), el campo se rota
  visualmente 90° (porterías arriba/abajo) para aprovechar el espacio vertical disponible, sin
  recalcular ni duplicar las coordenadas `x`/`y` de `FormationSlotDef` (compartidas con el resto
  de la app) — la rotación es una transformación CSS del wrapper, con contra-rotación de cada
  tarjeta de jugador para que fotos/nombres se vean en pie.
- El banquillo lateral compacto (`CompactBenchCard`, ya implementado) reduce tamaño de tarjeta en
  móvil para minimizar/evitar el scroll interno con un banquillo típico (5-9 jugadores).
- `LiveMatchScoreboard` (solo `PartidoEnDirectoTab`) se hace más compacto en móvil: menos
  padding, fuentes menores, escudos (`localTeamShield`/`visitorTeamShield`) más pequeños.
- El drag & drop de sustituciones (banquillo compacto → campo) sigue funcionando de forma
  intuitiva tras la rotación: las zonas de drop (`useDroppable`) permanecen alineadas
  visualmente con lo que el usuario ve.
- No se toca el layout de tablet (781-1200px) ni desktop (>1200px), ya finalizados en el change
  anterior.

## Capabilities

### New Capabilities
(ninguna nueva; se amplía la capability existente)

### Modified Capabilities
- `coach-simulation-bench-layout`: añade el comportamiento específico de móvil (rotación del
  campo, banquillo compacto sin scroll forzoso, marcador reducido) que la iteración anterior
  dejó explícitamente como no-goal.

## Impact

- Frontend only, bajo `Front/src/apps/coach/pages/convocations/components/`:
  `simulation/SimulationField.tsx` + `.module.css`, `simulation/SimulationPlayerSlot.tsx` +
  `.module.css`, `simulation/CompactBenchCard.module.css`, `simulation/LiveMatchScoreboard.tsx`
  + `.module.css`, `SimulacionTab.module.css`, `PartidoEnDirectoTab.module.css`.
- No afecta a backend, a `services/`, a contratos de API, ni a las coordenadas de formación
  compartidas (`FormationSlotDef`).
