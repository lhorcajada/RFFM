## Context

`coach-simulation-bench-tablet-layout` dejó el campo y el banquillo utilizables en móvil
(`<=780px`) apilando campo + banquillo compacto en una columna, pero sin rediseñar la
orientación del campo: `.fieldWrapper` mantiene `aspect-ratio: 105/68` (apaisado) también en
móvil, simplemente más estrecho — lo que apelotona las 11 tarjetas de jugador en un espacio
horizontal insuficiente. Ese change dejó explícitamente el rediseño fino de móvil como
Non-Goal. El usuario ahora pide, textualmente: rotar el campo para aprovechar el alto en vez del
ancho, banquillo sin scroll, cabecera de marcador y escudos más pequeños.

Las coordenadas `x`/`y` de cada slot (`FORMATION_POSITIONS` en `Front/src/apps/coach/types/
formation.ts`) están documentadas como apaisadas (`x`: 0=portero, 100=ataque; `y`: 0=banda
superior, 100=banda inferior) y se comparten con `FootballField.tsx` (Plantilla) y
`FieldWithBench.tsx` (Preparación de temporada). No se pueden recalcular ni bifurcar solo para
`SimulationField` sin duplicar esa tabla en 3 componentes.

## Goals / Non-Goals

**Goals:**
- El campo se muestra rotado 90° en móvil (porterías arriba/abajo) dentro de
  `SimulationField`/`SimulationPlayerSlot`, usado por `SimulacionTab` y `PartidoEnDirectoTab`,
  sin tocar `FootballField.tsx` (Plantilla) ni `FieldWithBench.tsx` (Preparación de temporada) —
  fuera del alcance de este change.
- La rotación es puramente visual (CSS), sin nuevas props ni cambios en `FORMATION_POSITIONS`/
  `FormationSlotDef`. El wrapper del campo gira 90°; cada `SimulationPlayerSlot` se
  contra-rota -90° para que el contenido (foto, dorsal, nombre, badges) se vea en pie.
- El drag & drop (`useDraggable`/`useDroppable` de dnd-kit) sigue funcionando sin cambios de
  lógica: dnd-kit calcula colisiones con `getBoundingClientRect()`, que ya refleja transforms
  CSS compuestos — ver Decisión 2.
- `CompactBenchCard` reduce tamaño en móvil (reutilizando y ajustando las mismas clases de
  `SimulationPlayerSlot.module.css` que ya comparte) para que un banquillo de 5-9 jugadores quepa
  sin scroll interno forzoso.
- `LiveMatchScoreboard` (solo `PartidoEnDirectoTab`) reduce padding, tipografía y tamaño de
  escudo en móvil.
- Tablet (781–1200px) y desktop (>1200px) no cambian — todas las reglas nuevas van dentro de
  `@media (max-width: 780px)`.

**Non-Goals:**
- No se toca `FootballField.tsx` (pestaña Plantilla) ni `FieldWithBench.tsx` (Preparación de
  temporada) — ambos usan las mismas coordenadas pero no fueron mencionados por el usuario y
  tienen sus propios layouts/casos de uso.
- No se cambia el mecanismo `prepareMode`/`movePreparePlayer`/`commitWindow` ni el hook
  `useMatchSimulation`.
- No se añade soporte de rotación dinámica del dispositivo (landscape físico) — la rotación es
  fija por ancho de viewport (`<=780px`), igual que el resto del layout responsive del proyecto.
- No se resuelve con exactitud matemática "sin scroll garantizado al 100%" para bancos
  extremadamente largos (>12 jugadores); se dimensiona para el caso típico (5-9) y se conserva un
  `overflow-y: auto` de seguridad ya existente en `.sidePanel`.

## Decisions

### 1. Rotación del campo: `container-type: size` + unidades `cqw`/`cqh`, no JS ni recalculo de coordenadas

`SimulationField.module.css`, dentro de `@media (max-width: 780px)`:

```css
.fieldWrapper {
  container-type: size;         /* habilita cqw/cqh para el hijo */
  width: min(92vw, 420px);
  max-width: 420px;
  aspect-ratio: 68 / 105;       /* portrait: swapped respecto al 105/68 base */
  margin: 0 auto;
}

.field {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100cqh;                /* = alto de .fieldWrapper */
  height: 100cqw;                /* = ancho de .fieldWrapper */
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center center;
}
```

**Por qué funciona (la geometría, para que quede documentado):** `.fieldWrapper` mide, p. ej.,
200×300px en móvil (portrait, ratio 68/105). `.field` se dimensiona con `width: 100cqh` (= 300px,
el alto del contenedor) y `height: 100cqw` (= 200px, el ancho del contenedor) — es decir, ANTES de
rotar, `.field` tiene exactamente las proporciones apaisadas correctas (300×200 ≈ 105:68) y mide,
en su sistema de coordenadas local, lo mismo que medía en desktop conceptualmente. Los hijos
(`SimulationPlayerSlot`, posicionados con `left: x%; top: y%`) calculan su posición sobre esta
caja local apaisada — exactamente la misma matemática de siempre, sin tocar
`FORMATION_POSITIONS`. Al rotar `.field` 90°, su caja de 300×200 gira y su huella visual pasa a
ser 200×300 — que encaja exactamente en `.fieldWrapper` (200×300). El giro completo (incluidos
todos los hijos posicionados) se pinta como una unidad rígida: la disposición relativa de los
jugadores gira con el campo automáticamente.

**Alternativas descartadas:**
- *Redefinir `FORMATION_POSITIONS` para móvil con `x`/`y` intercambiados*: descartado
  explícitamente por el usuario — duplicaría datos compartidos con Plantilla y Preparación de
  temporada.
- *Medir el contenedor con `ResizeObserver`/JS y fijar `width`/`height` en px*: funciona pero
  añade estado, un efecto y una fuente de bugs (resize, cambios de orientación) para resolver algo
  que `container-type: size` + `cqw`/`cqh` resuelve de forma puramente declarativa. Vite/React 19
  ya asume navegadores con soporte de container queries (Chrome/Edge/Safari/Firefox actuales).
- *`aspect-ratio` + `object-fit`-style en un `<canvas>`/SVG*: reescritura completa del campo,
  fuera de alcance.

### 2. Contra-rotación por tarjeta: por qué no rompe dnd-kit

Cada `SimulationPlayerSlot` (el `.slot` — wrapper `position: absolute; left: x%; top: y%;
transform: translate(-50%, -50%)`) añade, solo en móvil:

```css
@media (max-width: 780px) {
  .slot {
    transform: translate(-50%, -50%) rotate(-90deg);
  }
}
```

La rotación neta de cada `.slot` en pantalla es `90deg (heredada de .field) + (-90deg propia) =
0deg` — el contenido (círculo de foto, dorsal, nombre, minuteTag) se pinta en pie, en la posición
final correcta (ya reubicada por la rotación del padre). dnd-kit (`useDroppable`/`useDraggable`)
resuelve colisiones y posiciones con `Element.getBoundingClientRect()`, que es "transform-aware":
devuelve el rectángulo *visualmente pintado* en pantalla, con todos los transforms de ancestros ya
compuestos. Como la rotación neta de cada slot es 0°, su `getBoundingClientRect()` es un
rectángulo recto (no inclinado) en la posición correcta — dnd-kit no necesita ningún cambio de
configuración. El `DragOverlay` de dnd-kit (`.dragOverlay`) se renderiza en un portal fuera de
`.field`, así que tampoco se ve afectado por la rotación.

El banquillo lateral (`CompactBenchCard`, origen del arrastre) vive fuera de `.field` — no lleva
ninguna rotación.

**Dirección de rotación elegida (90° horario):** con `x=12` (portero) a la izquierda y `x≈80`
(delanteros) a la derecha en el sistema apaisado, un giro de 90° horario coloca la portería propia
arriba y el ataque hacia abajo de la pantalla. Es una elección arbitraria razonable (tablero
"se ataca hacia abajo"); ver Open Questions.

### 3. `CompactBenchCard`/`SimulationPlayerSlot`: tarjetas más pequeñas en móvil, mismas clases

En vez de crear variantes nuevas, se añaden overrides dentro de `@media (max-width: 780px)` en
`SimulationPlayerSlot.module.css` para `.playerCard`, `.dropTarget`, `.playerCardInner` (p. ej.
44px en vez de 52px) y `.slot` (ancho reducido acorde) — esto reduce simultáneamente las tarjetas
de campo (ya rotadas) y las de banquillo compacto (`CompactBenchCard` reutiliza literalmente estas
clases). `CompactBenchCard.module.css` ajusta `.wrapper` (ancho) a juego en el mismo breakpoint.
`.compactBenchItems` (en `SimulacionTab.module.css`) reduce su `gap` en móvil para que quepan más
tarjetas por fila.

### 4. `LiveMatchScoreboard`: reducciones dentro de su propio módulo, sin tocar la estructura

`LiveMatchScoreboard.module.css` añade `@media (max-width: 780px)` reduciendo `.root` (padding),
`.score`/`.scoreSep` (font-size), `.teamName` (font-size, max-width), y `.shield` (width/height) —
sin cambiar el JSX de `LiveMatchScoreboard.tsx` ni el de las dos pestañas.

## Risks / Trade-offs

- **[Riesgo] `container-type: size` en `.fieldWrapper` cambia su modelo de containment** (crea un
  nuevo contexto de contención de tamaño) → Mitigación: solo se activa dentro de la media query
  móvil, donde `.fieldWrapper` ya no participa del layout flexible de `.main` más que como una
  caja de ancho fijo (`width: min(92vw, 420px)`), así que no afecta al resto de `.main`/
  `.rightColumn`.
- **[Riesgo] Soporte de navegador de `cqw`/`cqh`** (container query units) → Aceptado: Baseline
  desde 2023 en Chrome/Edge/Safari/Firefox; el proyecto ya usa Vite 7/React 19 sin soporte de
  navegadores legacy documentado. Si en el futuro aparece un caso real de incompatibilidad, el
  fallback es fijar `.fieldWrapper` a un tamaño en px conocido (perdiendo fluidez con el ancho de
  pantalla real).
- **[Riesgo] jsdom (Vitest) no calcula layout real ni `getBoundingClientRect()` con transforms** →
  los tests de este change no pueden verificar geometría rotada real; verifican en su lugar que
  las clases/reglas CSS relevantes existen en los módulos y que la estructura DOM (jerarquía
  `.fieldWrapper > .field > .slot`, sin props nuevas) se mantiene intacta. La verificación visual
  de la rotación y del drag & drop en móvil es manual (ver tasks.md).
- **[Riesgo] Dirección de rotación (90° vs -90°) es una elección estética sin requisito explícito
  del usuario** → ver Open Questions; cambiarla de dirección es una única línea (`rotate(90deg)` →
  `rotate(-90deg)` en `.field`, y su contraparte en `.slot`).
- **[Riesgo] Tamaño reducido de tarjeta en móvil aplica también a las tarjetas de campo** (no solo
  al banquillo) → Aceptado y deseado: reduce el apelotonamiento que motivó el change.

## Open Questions

- **Dirección de rotación**: se elige portero arriba / ataque abajo (90° horario). Si el usuario
  prefiere lo contrario (portero abajo / ataque arriba, como en muchos videojuegos de gestión),
  es un cambio trivial de signo — se deja para confirmación tras revisar el resultado visual.
- **Tamaño final de tarjeta compacta en móvil** (44px propuesto vs. otro valor): se ajusta en
  implementación probando con un banquillo de 9 jugadores a 375px de ancho (iPhone SE/mini como
  referencia mínima realista); si no cabe sin scroll con 44px, se evalúa bajar a 40px antes de
  aceptar que quede scroll interno como red de seguridad.
