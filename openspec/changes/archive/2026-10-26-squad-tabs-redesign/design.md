## Context

`Squad.tsx` pinta `Tabs` de MUI con `variant="scrollable"` y, en la pestaña Plantilla, paneles por posición
con `PlayerCromo` (cromo de ancho fijo con valoraciones Téc/Tác/Fís/Com, barras Ef/R/C, acciones y, desde
`squad-league-stats`, el bloque «Solo liga»). Valoraciones, Estadísticas, Ranking e Ideal tienen cada una
su CSS Module con colores propios. `IdealLineup` lo usa además la pestaña de convocatoria
(`panelTitle`, `extraPanel`).

## Goals / Non-Goals

**Goals:** aspecto común, móvil primero, sin scroll horizontal, sin tablas, sin perder funcionalidad.

**Non-Goals:** backend, lógica de negocio, PDFs, diálogos de edición, `Mobile/`, `rating-sheet`.

## Decisions

### D1 · Etapas independientes
Cinco etapas (shell+Plantilla, Valoraciones, Estadísticas, Ranking, Ideal). Cada una deja la web en verde
(tests + build) y se puede commitear sola con su subida minor de versión.

### D2 · Pestañas sin scroll horizontal
`Tabs` estándar (no `scrollable`) con el contenedor flex en `flex-wrap: wrap` y el indicador propio de MUI
sustituido por un borde inferior en la pestaña seleccionada (el indicador no funciona con varias líneas).
Los chips de ordenación/filtro y las barras de herramientas usan `flex-wrap`, nunca `overflow-x`.

### D3 · Tarjeta nueva solo para Plantilla (`SquadPlayerCard`)
`PlayerCromo` lo usan más pantallas (convocatoria, valoraciones, ranking): no se toca su aspecto. La
pestaña Plantilla usa una tarjeta nueva con: avatar + dorsal, nombre (alias si existe), posición, chip
«Lesionado» (con la acción de quitar lesión que ya existe), barras Ef/R/C (`PlayerFormBars` compacto) y el
bloque «Solo liga». **Desviación respecto del diseño:** el diseño no mostraba las barras Ef/R/C ni la acción
de quitar lesión; se conservan porque son funcionalidad existente con tests. **Se pierde de esta tarjeta**
la fila de valoraciones Téc/Tác/Fís/Com (siguen en Valoraciones y Ranking).
El bloque «Solo liga» pasa de `PlayerCromo` a `LeagueStatsBlock` (componente compartido), con las mismas
etiquetas y reglas.

### D4 · Resumen y filtros en la pestaña Plantilla
`SquadSummary` (solo total y lesionados, en una línea compacta; los totales por posición van en los chips para no repetirlos ni ocupar pantalla en móvil) se calcula en el cliente a partir de la lista cargada.
`SquadFilters`: chips «Todos» + posiciones presentes con su recuento (filtro) y buscador por nombre/alias; solo filtran
en el cliente. Sin resultados → `EmptyState` con «Quitar filtros». Se elimina el aviso de datos de liga que añadió `squad-league-stats`: la etiqueta «Solo liga» de cada tarjeta basta.

### D5 · Valoraciones
Cada jugador es una tarjeta con la media y cuatro barras; «Ver subvaloraciones» despliega `SubRatingsPanel`
dentro de la tarjeta (acordeón, una abierta a la vez) en lugar del panel lateral deslizante. Se mantienen
«Valorar plantilla», PDFs, editar e historial. La ordenación pasa de `ToggleButtonGroup` a chips que
envuelven.

### D6 · Estadísticas
Se conserva la lógica (orden, dirección, filtro de posición, PDF, diálogos de métricas, «Ver evolución»).
Cambia la maquetación: barra de herramientas que se apila en móvil, leyenda en una línea envolvente y
tarjetas con barras y una rejilla de cifras de 4 columnas.

### D7 · Ranking
Podio con las tres primeras posiciones como tarjetas (número de puesto, no emoji), resto en filas
`#n`, empates con etiqueta «N empatados» y sección «Sin valorar» con «Valorar». Se mantienen los diálogos
de edición y la ordenación.

### D8 · Alineación ideal
Solo CSS y marcado de cabecera: selector de sistema en chips que envuelven, campo y lista a una columna
en móvil. Lógica de arrastre, guardado y API de `IdealLineup` intactas. Se verifica la pestaña de
convocatoria.

### D9 · Estilos
CSS Modules; colores desde `muiGameTheme` / variables de `:root`. Las que falten se añaden en `:root`
de `muiGameTheme` (el tema del entrenador no se monta), previa aprobación. Sin `styled()` ni `style={{}}`
salvo el color de acento por posición que ya existe como valor dinámico.

## Risks / Trade-offs

- Cinco etapas alargan la entrega, pero reducen el riesgo y permiten revisar pestaña a pestaña.
- Quitar valoraciones de la tarjeta de Plantilla cambia lo que se ve de un vistazo (D3): confirmar.
- `IdealLineup` compartido: cualquier cambio de marcado debe comprobarse también en convocatoria.
