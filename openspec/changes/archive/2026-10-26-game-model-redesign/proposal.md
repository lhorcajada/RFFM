## Why

La vista de lectura del Modelo de Juego del Coach muestra todo el modelo como un único árbol largo con
todas las fases desplegadas. Es difícil localizar una fase concreta, la jerarquía (principio →
subprincipio → zona → sub-subprincipio) se lee como texto corrido y los pendientes abiertos quedan
al final del documento.

## What Changes

- **Solo frontend (`Front/`)**, vista de lectura de `GameModel`; sin cambios de API ni backend.
  - Navegación por fases: una lista de botones (una por fase con principios, más «Balón parado» si el
    modelo tiene reglas) con contador; solo se muestra el contenido de la fase elegida.
  - Cada principio es una tarjeta con su número; sus subprincipios son tarjetas anidadas con zonas,
    sub-subprincipios, habilidades como chips y notas como avisos de color por tipo.
  - Los pendientes abiertos se muestran siempre visibles junto a la navegación de fases.
  - Responsive mobile-first, sin scroll horizontal ni tablas: en móvil la navegación se apila encima
    del contenido y los botones/chips se reparten en varias filas.
- Se mantiene: carga por temporada, selector de temporada, acciones (Nuevo, Eliminar, Editar,
  Imprimir PDF), permisos y la **vista de impresión** (`GameModelTree` con `print`), sin cambios.
- **Versión**: web minor (1.74.0 → 1.75.0).

## Capabilities

### New Capabilities
- `game-model-redesign`: navegación por fases, tarjetas jerárquicas y pendientes visibles de la vista
  de lectura del Modelo de Juego.

## Impact

- Nuevo `Front/src/apps/coach/pages/game-model/components/GameModelView.tsx` (+ `.module.css`) y test.
- `Front/src/apps/coach/pages/game-model/GameModel.tsx` (usa `GameModelView` en pantalla).
- `GameModelTree.tsx` queda solo para impresión (sin cambios de código).
- `Front/package.json` (versión).
- **Fuera de alcance**: editor (`GameModelCreate`), diálogos, impresión, backend.
