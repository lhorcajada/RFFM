## Why

En la pantalla de partido (`/coach/convocations/match?teamId=…&eventId=…`) las pestañas «Convocatoria» y «Desconvocatorias» están pensadas solo para escritorio:

- «Convocatoria» es un tablero de zonas con arrastrar y soltar y fichas grandes (`PlayerCromo`); en móvil no hay forma táctil de mover un jugador entre zonas.
- «Desconvocatorias» es una **tabla** (jugadores × partidos) que incumple la regla de no usar tablas y no cabe en móvil.
- La barra de pestañas es la estándar de MUI, sin contadores.

Se aprueba un diseño nuevo (artboards móvil y escritorio, `.design/convocatoria/`). Una vez implementado, se detecta que (a) con muchas faltas por jugador los chips por partido se multiplican y la tarjeta crece sin control, y (b) en escritorio las zonas vacías ocupan una columna entera; se aprueba un segundo diseño (`.design/desconvocatorias-historial/`) que se integra en este mismo cambio.

## What Changes

- **Frontend (Coach, `Front/`)**
  - **Barra de pestañas** de `ConvocationMatchDetail`: selector de pastillas desplazable, mismo orden y etiquetas (Desconvocatorias, Convocatoria, Alineación, Simular Partido), con contador en Desconvocatorias y Convocatoria.
  - **Pestaña Convocatoria** (`ConvocationTab`): resumen con un contador por zona y acciones «Proponer desconvocados» + leyenda; cada jugador pasa de ficha grande a **fila compacta** (`ConvocationPlayerRow`) con foto/dorsal, nombre, posición, valoración, racha, barras de forma y etiquetas Lesionado/En recuperación; botones táctiles «Desconvocar» (en Convocados) y «Convocar» (en Desconvocados) además del arrastre; en escritorio las zonas se reparten en columnas. Las zonas sin jugadores (Lista de espera, Pendientes de respuesta, Disponibles…) se pliegan en una fila de píldoras con su contador 0, para que Convocados y Desconvocados aprovechen el ancho; se despliegan al pulsarlas o al soltar un jugador encima.
  - **Pestaña Desconvocatorias** (`DesconvocatoriasTab`): la tabla se sustituye por **una tarjeta por jugador** con tres cifras con nombre completo (desconvocatorias, decisión técnica, jornadas sin técnica) y un historial que escala con el número de faltas: tira de temporada (una celda por partido coloreada por causa), botones por causa con su contador que filtran la lista, las 3 últimas desconvocatorias en filas y el resto plegado tras «Ver las N restantes» (lista con scroll interno); contadores por causa globales como chips; se mantienen «Imprimir resumen» y «Desconvocar».
- Se conserva todo el comportamiento actual: orden y plegado de zonas, arrastrar y soltar, convocatoria masiva, «Disponible» en pendientes de respuesta, motivo del desconvocado, propuesta automática de desconvocatoria, insignia de sanción deportiva, estados cargando/vacío.
- **Sin cambios de backend ni del hook** `useConvocationManagement` (se reutilizan `moveToNotCalled` y `handleCallPlayers`).
- **Versión**: web minor.

### Non-goals

Pestañas «Alineación» y «Simular Partido»; cambios en la lógica de la propuesta de desconvocatoria; nuevos datos de backend; cambiar el orden de las pestañas.

## Capabilities

### New Capabilities
- `convocation-tabs-redesign`: barra de pestañas, pestaña Convocatoria y pestaña Desconvocatorias del partido, responsive y sin tablas.

## Impact

- `Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx` (+ `.module.css`).
- `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx`, `DesconvocatoriasTab.tsx` y sus CSS Modules; nuevo `ConvocationPlayerRow.tsx` (+ CSS Module).
- Tests co-ubicados en `__tests__/`: se adaptan los existentes `ConvocationTab.*`, `DesconvocatoriasTab.sanctionBadge` y `ConvocationMatchDetail.tabsAndProposal`; se añaden los nuevos.
- Versión web: `Front/package.json`.
