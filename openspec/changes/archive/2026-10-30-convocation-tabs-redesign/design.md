## Context

`ConvocationTab.tsx` (714 líneas) pinta cada zona con `PlayerCromo` y arrastrar y soltar; `DesconvocatoriasTab.tsx` (442 líneas) pinta una `<table>` con una columna por partido. Ambos se montan desde `ConvocationMatchDetail.tsx` con un `Tabs` de MUI. El diseño aprobado está en `.design/convocatoria/` (móvil 390 px y escritorio), mobile-first, sin tablas.

## Decisions

### D1 — Barra de pestañas
Se mantiene `Tabs`/`Tab` de MUI (roles `tablist`/`tab`, teclado y `variant="scrollable"`), restilizado con una clase de `ConvocationMatchDetail.module.css`: pista redondeada, pestaña activa rellena con el acento, objetivo ≥44px. Orden y etiquetas sin cambios. El contador de «Desconvocatorias» (jugadores con alguna desconvocatoria) y de «Convocatoria» (convocados) es una insignia `aria-hidden` para que el nombre accesible de la pestaña no cambie y los tests/roles existentes sigan valiendo. El cálculo de ambos números se hace en `ConvocationMatchDetail` con los datos que ya carga; el de Desconvocatorias usa `countDeconvokedPlayers` de un nuevo `utils/deconvocationStats.ts` (que también aloja `isCellNotCalled`, antes privado de `DesconvocatoriasTab`), porque los tests de la pantalla mockean ese componente.

### D2 — Fila compacta de jugador
Nuevo `components/ConvocationPlayerRow.tsx` (+ `.module.css`). Props: `displayName`, `photoSrc`, `dorsal`, `position`, `rating`, `injured`, `recovering`, `streakCount`, `readiness`, `fatigue`, `formStatus`, `selected` y un slot `actions`. Muestra foto circular (o avatar por defecto) con dorsal, nombre, posición, valoración media con el color actual (`ratingColor`), racha, `PlayerFormBars` y las etiquetas Lesionado/En recuperación. Reutiliza `PlayerFormBars` y la lógica de color de `PlayerCromo`; no modifica `PlayerCromo` (lo siguen usando plantilla y alineación).

### D3 — Pestaña Convocatoria
`ConvocationTab.tsx` conserva props, zonas, orden, plegado, handlers de arrastre, convocatoria masiva, `onMarkAvailable`, motivo y flujo de propuesta. Cambios:
- Resumen superior: un contador por zona visible (en liga también Lista de espera y Pendientes de respuesta). La valoración media de convocados se queda en la cabecera de la zona Convocados.
- Cada jugador se pinta con `ConvocationPlayerRow`; la envoltura `draggable` se mantiene.
- Acciones táctiles en el slot: en **Convocados**, botón «Desconvocar a {nombre}» → `onDeconvokePlayer(id)`; en **Desconvocados**, botón «Convocar a {nombre}» → `onCallPlayers([id])`. Ambos props son nuevos y opcionales; `ConvocationMatchDetail` los conecta a `convocation.moveToNotCalled` y `convocation.handleCallPlayers`, de modo que no cambia el hook. Si no se pasan, el botón no se muestra.
- Los nombres accesibles existentes se mantienen: «Seleccionar {nombre}», «Seleccionar todos», «Quitar selección», «Convocar seleccionados (n)», «Marcar disponible a {nombre}», selector «Motivo».
- Escritorio: contenedor de zonas con `flex-wrap` y `flex: 1 1 320px` por zona (varias columnas); móvil: una columna.
- **Zonas vacías plegadas (D8)**: una zona sin jugadores deja de ser una columna y pasa a una píldora.

### D4 — Pestaña Desconvocatorias
`DesconvocatoriasTab.tsx` conserva los cálculos (`deconvocatingColumns`, `deconvocatedPlayers`, `playerStats`, `causeCounts`), `handlePrintSummary` y las funciones de color/etiqueta de causa. Cambia solo el marcado: se elimina la `<table>`.
- Cabecera: «N desconvocatorias en M partidos» + «Imprimir resumen».
- Chips por causa (colores actuales) con su contador.
- Una tarjeta por jugador, ordenada por total descendente: nombre, estado (Lesionado/Desconvocado/Convocado en este partido), botón «Desconvocar» o etiqueta «Desconvocado», tres cifras con rótulo completo (Desconvocatorias, Decisión técnica, Jornadas sin técnica) y el historial (D7).
- La leyenda se elimina porque las cifras ya llevan su rótulo.

### D5 — Estilos
CSS Modules co-ubicados; colores desde las variables existentes (`--rffm-card-bg`, `--rffm-card-text`, `--rffm-card-subtext`, `--rffm-primary`, `--rffm-dash-accent`, `--rffm-error`) y los colores de causa ya definidos en `DesconvocatoriasTab`. Se eliminan las reglas que dejen de usarse (`.grid`, `.th`, `.td`, `.dataCell`, `.gridWrapper`, `.legend*`, `.draggableCard` si no se usa, etc.). Sin `style={{}}` nuevos salvo el color dinámico de causa/valoración que ya se aplica así.

### D6 — Tests
Vitest + Testing Library. Nuevos: `ConvocationPlayerRow.test.tsx`, `ConvocationTab.summary.test.tsx`, `ConvocationTab.touchActions.test.tsx`, `DesconvocatoriasTab.cards.test.tsx`. Se adaptan a la fila compacta los tests que miraban la ficha (`ConvocationTab.formStatus/readiness/calledAvg`) sin cambiar lo que verifican (valores de forma, rodaje, media); `DesconvocatoriasTab.sanctionBadge` pasa a buscar la insignia en la fila del partido; nuevos `DesconvocatoriasTab.history.test.tsx` (D7) y `ConvocationTab.emptyZones.test.tsx` (D8); `ConvocationMatchDetail.tabsAndProposal` se mantiene (nombres de pestaña intactos).

### D7 — Historial de desconvocatorias por jugador (escala con las faltas)
Diseño: `.design/desconvocatorias-historial/`. Los chips «J{n} · causa» por partido se sustituyen por un historial de altura acotada, dentro de la tarjeta de D4:
- **Tira de temporada**: una celda por partido de `matchColumns` (`aria-hidden`, con `title` «J{n} · causa»), coloreada con el color de su causa si el jugador fue desconvocado y neutra si no; rótulos «J1» y «J{último}» en los extremos y texto «Temporada · N partidos». Ocupa lo mismo con 3 que con 30 faltas.
- **Causas con conteo**: botones («{causa} {n}», ≥44px) con `aria-pressed`; pulsar uno filtra la lista inferior por esa causa y pulsarlo de nuevo, o «Quitar filtro», la restablece. Con filtro activo se muestra «Mostrando {n} de {total}».
- **Lista**: filas (no chips) «J{n} · fecha — causa», de la más reciente a la más antigua, con la insignia de sanción deportiva (`GavelIcon`, mismo `aria-label` «Desconvocado por sanción deportiva») en las de sanción. Se muestran las 3 últimas y el resto queda tras un botón «Ver las {n} restantes» (`aria-expanded`, «Ver menos» al desplegar) y la lista desplegada tiene `max-height` con scroll interno. Si el jugador (o el filtro) tiene 3 filas o menos no hay desplegable. Con filtro activo se listan todas las coincidentes sin límite de 3 (el contenedor sigue acotado por scroll).
- El estado (filtro por jugador) es local al componente de tarjeta; no hay cambios de datos: se derivan de `matchColumns` + `enrichedGrid` ya calculados. Colores de causa: los ya existentes en `DesconvocatoriasTab`.

### D8 — Zonas vacías plegadas en Convocatoria
`ConvocationTab` ya trata como colapsada una zona sin jugadores (`expanded = ids.length > 0 && !collapsedZones[zone]`), pero la sigue pintando como columna de ancho completo. Cambio:
- Las zonas **sin jugadores** (cualquiera de las visibles) no se pintan como columna: se pintan como píldora (`<button aria-expanded="false">`, ≥44px, chevron, nombre de zona y contador 0, color de la zona) en una fila `flex-wrap` sobre las columnas, con la nota «Las zonas vacías van plegadas…».
- Pulsar la píldora marca la zona como desplegada (estado local `openedEmptyZones`) y pasa a pintarse como columna con su cabecera y su cuerpo vacío (zona de soltar); al soltar un jugador sobre la píldora, la zona se despliega y recibe al jugador. Cuando una zona vuelve a quedar vacía, vuelve a plegarse.
- Las zonas con jugadores se comportan igual que antes (columna, plegables con su cabecera).
- Las zonas Convocados y Desconvocados, cuando están vacías, también se pliegan, salvo que se esté arrastrando un jugador (para que haya dónde soltarlo, la píldora actúa como zona de soltar).
- Sin cambios en los datos ni en el hook.

## Risks / Trade-offs

- La fila compacta muestra menos espacio que `PlayerCromo`: si el diseño pierde algún dato (p. ej. desglose Téc/Tác/Fís/Com), se decide con la persona usuaria antes de implementar; por defecto solo se muestra la media.
- Sin tabla se pierde la comparación visual por columnas entre jugadores; se compensa con la tira de temporada, el historial por jugador y sus cifras.
- Con el historial plegado hay que pulsar para ver todas las faltas; la tira de temporada y los conteos por causa mantienen la visión global sin desplegar.
