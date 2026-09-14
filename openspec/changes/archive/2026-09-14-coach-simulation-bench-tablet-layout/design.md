## Context

Iteración 1 de este change recortó la tarjeta de campo y añadió, solo en el rango de tablet
(781–1200px), un layout apilado con dos listados ricos ("Banquillo" arrastrable y "En el campo"
de solo lectura) debajo del campo, sustituyendo el panel lateral únicamente en ese rango. Una
regresión de esa iteración (`.benchListsRow` sin `flex-grow`, colapsando `.sidePanel` a ~0px en
escritorio) ya fue diagnosticada y corregida por separado.

Tras probar el resultado, el usuario pidió una solución más simple y homogénea: en vez de tener
un layout distinto por rango de anchura, el banquillo interactivo pasa a usar tarjetas
**compactas** (mismo lenguaje visual que las del campo) en todos los tamaños — lo que
prácticamente elimina el problema de espacio que motivó el change — y la información rica se
convierte en un bloque puramente informativo, siempre visible, fuera de la zona de arrastre.

## Goals / Non-Goals

**Goals:**
- Banquillo lateral (`.sidePanel`) con tarjetas compactas (foto/iniciales, dorsal, nombre,
  minutos si aplica) — mismo lenguaje visual que `SimulationPlayerSlot`, sin crear una tercera
  variante de tarjeta. Sigue siendo la zona de arrastre (`prepareMode`), en todos los tamaños.
- Bloque informativo, siempre visible (todos los tamaños), a todo lo ancho, debajo de
  campo+banquillo compacto: "En el campo" y "Banquillo", ambos con la tarjeta rica actual
  (`BenchPlayerCard`), de solo lectura, sin `useDraggable`/`DroppableBench`.
- Layout responsive por flexbox (wrap), sin depender de una media query de rango específico ni
  de un `max-height` calculado a mano — el banquillo compacto ya no necesita ese cálculo porque
  ocupa mucho menos espacio, y el bloque informativo permite scroll de página.
- No romper el mecanismo dnd-kit existente (`sim-player-{id}`, `sim-slot-{index}`, `sim-bench`,
  `prepareMode`/`movePreparePlayer`/`movePreparePlayerToBench`) ni el reposicionamiento libre.
- Mismo comportamiento en `SimulacionTab.tsx` y `PartidoEnDirectoTab.tsx`.

**Non-Goals:**
- No se rediseña específicamente para móvil más allá de no romperlo — el rediseño móvil completo
  queda para más adelante, según indica el usuario.
- No se toca backend, servicios de API, ni el motor de ventanas de sustitución.
- No se unifica `useMatchSimulation`/hook de Partido en Directo.

## Decisions

### 1. Nuevo componente `CompactBenchCard` — reutiliza estilos de `SimulationPlayerSlot`, no los duplica
Se crea `Front/src/apps/coach/pages/convocations/components/simulation/CompactBenchCard.tsx`
(+ `.module.css` mínimo, solo para el contenedor de lista — no para el círculo de foto/dorsal,
que se importa directamente desde `SimulationPlayerSlot.module.css`):

```ts
export function CompactBenchCard(props: {
  player: SquadPlayer;
  minutesPlayed?: number;
  isLeaving?: boolean;
  isDragActive?: boolean;
}): JSX.Element;
// Reutiliza las clases .playerCard/.playerCardInner/.playerPhoto/.playerInitials/
// .dorsalBadge/.playerName/.minuteTag/.leavingBadge de SimulationPlayerSlot.module.css.
// minuteTag solo se muestra si minutesPlayed > 0 ("minutos si aplica"); leavingBadge
// ("SALE") solo si isLeaving.

export function DraggableCompactBenchCard(props: {
  player: SquadPlayer;
  minutesPlayed?: number;
  isLeaving?: boolean;
}): JSX.Element;
// Envuelve CompactBenchCard en useDraggable({ id: `sim-player-${player.id}` }), igual
// patrón que DraggableBenchCard/DraggableStaticCard existentes.
```

`DroppableBench` (ya existente en `BenchPlayerCard.tsx`) se reutiliza tal cual para la zona
`sim-bench` — es agnóstica al contenido, no a una tarjeta concreta.

El banquillo lateral (`.sidePanel`) ya no agrupa por posición (`groupBenchPlayers`) — con
tarjetas tan pequeñas, una lista plana con `flex-wrap` es más adecuada que separadores de grupo
pensados para las tarjetas anchas. `groupBenchPlayers`/`BENCH_POSITION_GROUPS` se conservan para
los dos listados informativos, que sí mantienen la agrupación ya implementada.

**Alternativa descartada**: reutilizar directamente `DraggableStaticCard`/`StaticCard` de
`SimulationPlayerSlot.tsx`. Se descarta porque esos componentes están acoplados al wrapper
`.slot` (posicionamiento absoluto en `x`/`y` sobre el campo) — extraerlos exigiría separar antes
esa lógica de posicionamiento, lo cual es un cambio mayor no pedido. Reutilizar sus *estilos*
(no los componentes) logra el mismo lenguaje visual con mucho menos riesgo.

### 2. El panel lateral pierde su `max-height`/scroll acotado por media query
Ya no hace falta el cálculo de `max-height: min(42vh, 420px)` ni la media query
`781px–1200px` dedicada: con tarjetas compactas, el banquillo lateral cabe cómodamente en el
espacio que ya le da `.rightColumn` (igual que el campo) en prácticamente cualquier tamaño. Se
mantiene como red de seguridad un `max-height` + `overflow-y: auto` modesto y constante (sin
media query) por si un equipo tiene un banquillo inusualmente largo — no crítico como antes,
pero barato de conservar.

### 3. Nueva sección informativa siempre visible, fuera de `.main`
El bloque de los dos listados ricos ("En el campo", "Banquillo") deja de vivir dentro de
`.rightColumn`/`.main` (que ahora vuelve a ser solo campo + banquillo compacto + historial, como
antes de la iteración de tablet) y pasa a ser un **hermano** de `.main`, a todo lo ancho, con
`display: flex; flex-wrap: wrap;` — cada panel con `flex: 1 1 320px` para que se coloquen en fila
cuando el ancho lo permite y se apilen automáticamente por debajo de cierto ancho, sin necesidad
de una media query explícita. No llevan `max-height` propio: se permite que crezcan y que la
página haga scroll, tal como pide el usuario.

La leyenda (`PlayerFormLegend` + leyenda de "Jornadas sin decisión técnica", antes solo visible
en el panel lateral fuera de `prepareMode`) se muestra una única vez junto a esta nueva sección
informativa — sigue siendo relevante ahí porque es donde ahora viven los badges que explica
(competitividad, minutos, racha, barras de forma), y se muestra siempre (la sección informativa
ya no depende de `prepareMode`). Esto mantiene el invariante ya cubierto por
`SimulacionTab.legend.test.tsx`/`PartidoEnDirectoTab.legend.test.tsx`: exactamente una leyenda
en toda la página.

### 4. Qué helpers se eliminan del bloque `.benchListsRow`/tablet de la iteración anterior
Se elimina `.benchListsRow` (y su regla asociada en la media query 781–1200px, y el fix de
`flex-grow` aplicado para la regresión) porque la estructura que envolvía deja de existir: el
panel lateral y los dos listados informativos ya no comparten contenedor. Se elimina también el
`display: none` por defecto de `.onFieldPanel` — pasa a estar siempre visible.

## Risks / Trade-offs

- **[Riesgo] El banquillo lateral compacto pierde agrupación por posición** (antes ordenaba
  Porteros/Defensas/Centrocampistas/Delanteros con separadores). → Aceptado: con tarjetas de
  ~52px, los separadores de grupo ocupan proporcionalmente más espacio que el contenido; el
  usuario no pidió conservarlos ahí, y siguen presentes en los listados informativos ricos donde
  hay espacio para ellos.
- **[Riesgo] Sin `max-height` calculado por media query, un banquillo muy largo en pantallas muy
  bajas (ej. laptop en ventana pequeña) podría necesitar el `max-height` de seguridad genérico
  antes de lo esperado.** → Mitigación: se mantiene un `max-height` conservador constante (no
  ligado a un rango de viewport) como red de seguridad, con `overflow-y: auto`.
- **[Riesgo] Tests existentes que asumían la estructura de la iteración anterior** (`.sidePanel`
  con `BenchPlayerCard` rico y arrastrable, `.benchListsRow`, `.onFieldPanel` oculto por
  defecto) quedan obsoletos y deben actualizarse o eliminarse como parte de esta iteración —
  cubierto en tasks.md.
- **[Riesgo] Móvil**: al no rediseñarse explícitamente, el bloque informativo (ahora siempre
  visible, antes oculto en móvil) añade contenido nuevo a la pantalla móvil — se acepta como
  válido para esta iteración (el usuario pidió que aparezca "en TODOS los tamaños de pantalla,
  móvil incluido"), pero el rediseño fino de móvil queda pendiente para un change posterior.
