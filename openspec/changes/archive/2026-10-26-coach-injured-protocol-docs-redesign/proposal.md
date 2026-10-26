## Why

En la página Lesionados del Coach, las pestañas «Protocolo» y «Documentos» usan un selector MUI
`Tabs` con scroll horizontal, botones pequeños (< 44 px) y acciones solo de icono. En móvil las
pestañas no caben a la vista y las acciones son difíciles de pulsar.

## What Changes

- **Solo frontend (`Front/`)**; sin cambios de API ni de lógica de carga/guardado/borrado.
  - Selector de pestañas segmentado de 3 botones (Lesionados / Protocolo / Documentos), cada uno
    ≥ 44 px de alto, sin scroll en 390 px, con la pestaña activa resaltada y accesible
    (`tablist` / `tab` / `aria-selected`).
  - Protocolo: tarjeta con título «Protocolo de lesiones», chip «Publicado» cuando hay contenido,
    barra de formato con botones ≥ 44 px, editor en panel más claro, «Última actualización» al pie y
    acciones «Guardar protocolo» / «Eliminar» (al pie en móvil, en la cabecera en escritorio, ancho
    máximo ~920 px). Solo lectura: sin barra ni acciones.
  - Documentos: zona de subida con «Solo PDF · máximo 10 MB» y botón «Subir documento»; tarjetas de
    PDF con etiqueta PDF, nombre, fecha de subida y botones de texto «Descargar» / «Eliminar»
    ≥ 44 px. 1 columna en móvil y 3 desde ~900 px. Sin tablas.
- **Versión**: web minor (1.70.0 → 1.71.0).

## Capabilities

### New Capabilities
- `coach-injured-protocol-docs-redesign`: selector de pestañas, panel de protocolo y panel de
  documentos de la página Lesionados del Coach.

## Impact

- `Front/src/apps/coach/pages/injured/Injured.tsx` (+ `Injured.module.css`).
- `components/InjuryProtocolPanel.tsx` y `components/InjuryProtocolDocuments.tsx` (+ `.module.css`).
- Tests: `Injured.tabs.test.tsx`, `InjuryProtocolPanel.test.tsx`, `InjuryProtocolDocuments.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: pestaña «Lesionados», backend/API, nuevos colores.
