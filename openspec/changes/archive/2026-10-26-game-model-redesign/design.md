## Context

`GameModel.tsx` renderiza `GameModelTree` dos veces: en pantalla (colapsable) y en impresión
(`print`). La referencia visual es el diseño `.design/game-model` (Escritorio y Móvil).

## Decisions

- **D1 — Componente nuevo, impresión intacta.** Se crea `GameModelView` para la pantalla y
  `GameModelTree` se queda solo para `print` (y sus tests actuales siguen válidos). Evita regresiones en
  el PDF.
- **D2 — Fases.** Se agrupan los principios por `gameMomentId` (orden numérico) con
  `gameMomentName`; el contador de cada fase es su número de principios. «Balón parado» es una entrada
  extra cuyo contador es el número de `setPieceRules`. La fase activa se guarda en `useState`
  (por defecto, la primera). Si el modelo cambia y la fase activa ya no existe, se usa la primera.
- **D3 — Navegación accesible.** Botones reales con `aria-pressed`, altura ≥ 44 px, `flex-wrap`
  (nunca scroll horizontal). Layout: contenedor `flex-wrap` con nav `flex: 0 0 260px` y contenido
  `flex: 999 1 560px; min-width: 0`, así en móvil la nav se apila encima.
- **D4 — Jerarquía en tarjetas.** Principio (tarjeta + círculo numerado) → Subprincipio (tarjeta
  anidada en rejilla `auto-fit, minmax(260px, 1fr)`) → Zonas (`zonaHeading`) → Sub-subprincipios
  («numero · rol: texto») → habilidades como chips (`referenciaAKey` → «misma que X»). Se reutilizan
  `compareNumero` y `zonaHeading` de `gameModelOrder.ts`.
- **D5 — Notas.** Aviso con borde izquierdo y color por `NotaTipo` (riesgo rojo, objetivo ámbar,
  nota azul, excepción verde), con la etiqueta `NOTA_TIPO_LABELS`.
- **D6 — Pendientes.** Panel bajo la navegación con el número de pendientes y su listado
  (`topic`: `description`, estado pendiente/resuelto). Solo si hay `openIssues`.
- **D7 — Estilos.** CSS Modules co-ubicado; colores del tema Coach ya usados en `GameModelTree.module.css`
  (`#4d9de0`, `#4ec9b0`, `#ff7a1a`, fondo `#07071a`/`#0e0f2b`). Sin `style={{}}` ni `styled()`.
- **D8 — Cabecera.** Se mantiene el nombre del modelo y el selector de temporada de `GameModel.tsx`.

## Risks

- Datos reales con muchas zonas/sub-subprincipios: la tarjeta de subprincipio crece en altura; aceptable.
