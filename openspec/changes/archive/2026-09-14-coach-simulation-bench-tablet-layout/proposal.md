## Why

El panel lateral del banquillo en las pestañas "Simulación" y "Partido en Directo" usaba una
tarjeta rica y ancha (foto, nombre, dorsal, competitividad, racha, minutos, barras de forma) sin
una altura acotada fiable, lo que en pantallas más pequeñas (tablet, y potencialmente también en
laptops de poca altura) rompía el flujo de arrastrar (drag & drop) un jugador del banquillo al
campo para completar una sustitución: no se veían todos los jugadores, o verlos exigía sacar el
campo de la vista. Dos iteraciones de este change ya redujeron el problema para tablet; tras
probarlas, el usuario ha pedido una solución más simple y uniforme: la zona de banquillo
interactiva pasa a usar tarjetas compactas (igual que las del campo) en **todos** los tamaños de
pantalla, y la información rica se traslada a un bloque puramente informativo, de solo lectura,
siempre visible debajo.

## What Changes

**Aplica a todos los tamaños de pantalla (móvil, tablet, escritorio) — no hay ya un rango
"solo tablet":**

- Las tarjetas de jugador **dibujadas sobre el propio campo** (`SimulationPlayerSlot.tsx`) siguen
  recortadas (sin competitividad ni barras de forma) — sin cambios respecto a la iteración
  anterior de este change.
- El **panel lateral junto al campo** (`.sidePanel`) deja de usar la tarjeta rica
  (`BenchPlayerCard`) y pasa a usar una **tarjeta compacta** con el mismo lenguaje visual que las
  tarjetas de campo (foto/iniciales, dorsal, nombre, minutos si aplica) — reutilizando estilos de
  `SimulationPlayerSlot.module.css` en vez de inventar una tercera variante de tarjeta. Sigue
  siendo la **zona interactiva**: desde aquí se arrastran jugadores al campo con el mismo
  mecanismo dnd-kit (`sim-player-{id}` / `sim-slot-{index}` / `sim-bench`) y el mismo flujo
  `prepareMode`/`startPrepare`/`movePreparePlayer`/`movePreparePlayerToBench`/`commitWindow`.
- **Debajo del bloque campo + banquillo compacto, a todo lo ancho**, aparece una sección **siempre
  visible** (no restringida a ningún rango de anchura) con dos listados de solo lectura, usando
  la tarjeta rica actual (`BenchPlayerCard`: foto, dorsal, nombre, competitividad, racha, minutos/
  SALE, barras de forma):
  - **"En el campo"**: jugadores actualmente en el campo (o en la vista previa, durante una
    sustitución).
  - **"Banquillo"**: los mismos jugadores que muestra el banquillo compacto interactivo, pero con
    toda la información — sin ser arrastrable.
  - Se colocan uno junto a otro cuando el ancho lo permite, o apilados en anchos estrechos, con
    scroll de página si hace falta — ya no dependen de un `max-height`/scroll interno acotado por
    media query, porque al no ser la zona de arrastre ya no necesitan encajar sin scroll.
- Al ya no depender un `max-height` calculado específicamente para el rango 781–1200px, se
  retira esa media query dedicada; el layout se resuelve con flexbox responsive (envolviendo
  filas) en todos los anchos.
- Se mantiene el componente/módulo compartido bajo `components/simulation/` para la tarjeta rica
  (`BenchPlayerCard`, `DroppableBench`, `BENCH_POSITION_GROUPS`, `groupBenchPlayers`) usado por
  los dos listados informativos, y se añade un nuevo componente compacto reutilizado por el
  banquillo interactivo de ambas pestañas.

## Capabilities

### New Capabilities
- `coach-simulation-bench-layout`: layout del banquillo y del campo en las pestañas de
  simulación de partido (Simulación y Partido en Directo) del área Coach — banquillo lateral
  compacto e interactivo en todos los tamaños de pantalla, más un bloque informativo de solo
  lectura (campo + banquillo con información completa) siempre visible debajo, y recorte de
  badges en la tarjeta de campo.

### Modified Capabilities
(ninguna — no cambia el comportamiento funcional de sustituciones, formaciones ni ventanas de
cambio, solo su presentación)

## Impact

- Frontend only, bajo `Front/src/apps/coach/pages/convocations/components/`:
  `simulation/SimulationPlayerSlot.tsx` (sin cambios adicionales en esta iteración),
  `SimulacionTab.tsx`, `PartidoEnDirectoTab.tsx`, `SimulacionTab.module.css`.
- Nuevo componente compartido de tarjeta compacta de banquillo bajo `components/simulation/`
  (nombre exacto y API en design.md), reutilizando estilos de `SimulationPlayerSlot.module.css`.
- Se conserva `BenchPlayerCard.tsx` (tarjeta rica + agrupación) para los dos listados
  informativos.
- No afecta al backend, a `services/`, ni a contratos de API.

## Nota sobre el nombre del change

Este change se llama `coach-simulation-bench-tablet-layout` por su alcance original (solo
tablet). El alcance final ya cubre todos los tamaños de pantalla; se mantiene el nombre del
directorio para no perder el historial de artefactos ya generados — el capability
`coach-simulation-bench-layout` (sin "tablet" en el nombre) siempre reflejó el ámbito correcto.
