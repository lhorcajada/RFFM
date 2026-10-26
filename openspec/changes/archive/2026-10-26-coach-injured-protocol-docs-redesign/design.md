## Context

- `Injured.tsx` usa MUI `Tabs` scrollable con estado `activeTab` (0/1/2); `?highlight=` solo se
  pasa a `InjuredPlayersList`. `InjuryProtocolPanel` (Tiptap) e `InjuryProtocolDocuments` usan botones
  MUI `size="small"` y de icono.
- Diseño aprobado: `.design/injured/project/ProtocolMobile|ProtocolDesktop|DocsMobile|DocsDesktop.dc.html`.
- Se sigue el estilo de `coach-injured-redesign` (tarjeta `--rffm-card-bg` = `#1c1c30`, borde
  `rgba(255,255,255,0.08)`, `--rffm-primary`, `--rffm-status-*`).

## Decisions

### D1 · Colores: sin valores nuevos
- Tarjetas: `var(--rffm-card-bg, #1c1c30)`. Pestaña activa: `--rffm-primary`. Chip «Publicado»:
  `--rffm-status-accepted`. «Eliminar»: borde/texto `--rffm-status-declined`. Etiqueta PDF:
  `--rffm-status-declined`. Panel del editor: `rgba(255,255,255,0.05)` sobre la tarjeta (más claro).
  Zona de subida: borde discontinuo `rgba(255,255,255,0.2)`.

### D2 · Selector de pestañas
- En `Injured.tsx`, `div role="tablist"` con 3 `button role="tab"` y `aria-selected`; rejilla de
  3 columnas, `min-height: 44px`, sin scroll. Escritorio: mismo selector con `padding` mayor y
  ajustado al contenido. Estado `activeTab` sin cambios. `.tabPanel` pasa a fondo transparente
  (las tarjetas internas llevan su propio fondo).

### D3 · Protocolo
- Tarjeta única en rejilla con áreas: móvil `title / toolbar / editor / updated / actions`;
  `@media (min-width: 900px)` → `title actions` en la primera fila. `max-width: 920px`.
- Chip «Publicado» si `content` no es vacío (estado ya cargado). Botones de formato 44×44, mismos
  `aria-label`. Acciones: texto «Guardar protocolo» y «Eliminar» (`aria-label="Eliminar protocolo"`
  para conservar el nombre accesible actual).
- Lógica (`handleSave`, `handleDeleteConfirmed`, `notify`, efectos) intacta. Solo lectura: sin barra
  ni acciones; el chip «Publicado» sí se muestra (hay contenido).

### D4 · Documentos
- Zona de subida (solo `isCoach`): «Añadir documento», «Solo PDF · máximo 10 MB», botón
  «Subir documento» y mensaje de error existente. Validaciones sin cambios.
- Tarjeta: etiqueta «PDF», nombre con `overflow-wrap: anywhere`, «Subido el dd/mm/aaaa»
  y botones de texto «Descargar» (`aria-label="Descargar <fichero>"`) y «Eliminar»
  (`aria-label="Eliminar"`) con `min-height: 44px`. Rejilla 1 columna / 3 desde 900 px. Sin `<table>`.

## Tests (TDD)
- `Injured.tabs.test.tsx`: tablist, 3 tabs, `aria-selected` por defecto y tras cambiar.
- `InjuryProtocolPanel.test.tsx`: título, chip, barra, solo lectura, última actualización, botones.
- `InjuryProtocolDocuments.test.tsx`: zona de subida y ayuda, etiqueta PDF, fecha, botones con texto.
