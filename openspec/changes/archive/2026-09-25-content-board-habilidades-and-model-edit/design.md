## Context

- `GetGameModel` devuelve `Habilidades` (`Id`, `Nombre`, `Descripcion`, `Entrenable`,
  `ReferenciaAKey`) por sub-subprincipio; `gameModelService` las mapea a `Habilidad[]` en
  `SubSubPrincipio.habilidades`. `ContentBoardPage` ya carga el `GameModel` completo vía
  `useContentBoardData`.
- `SessionTargetTree` resuelve el texto de cada objetivo con `textoMap`
  (`buildSubSubPrincipioTextoMap` en `dragPayload.ts`), que baja por
  `ContentBoardPage → SessionBoardPanel → SessionCard → SessionTargetTree`.
- `GameModelCreate` (rutas `game-model/create` y `game-model/edit`) lee `state.season` y
  `teamId` (query o state) y, al guardar/cancelar, navega a `/coach/game-model${location.search}`.
- Al montarse, `ContentBoardPage` vuelve a cargar todo con `useContentBoardData`; al volver del
  editor se remonta, así que el modelo se recarga sin lógica extra.

## Decisions

### D1 · Componente `HabilidadChips`
Nuevo `season-plan/components/HabilidadChips.tsx` (+ `.module.css`): recibe `habilidades: Habilidad[]`
y pinta un `Chip` pequeño (`size="small"`, `variant="outlined"`) por habilidad, dentro de un
contenedor `flex-wrap`. Cada chip va envuelto en `Tooltip` de MUI con `enterTouchDelay={0}` (se
abre con un toque en móvil) y el título:
- `referenciaAKey` → `Igual que {referenciaAKey}`;
- si no → `descripcion` y, si hay, `Entrenable: {entrenable}` en otra línea.
Lista vacía → `null`. Colores desde el tema del Coach (sin hex nuevos).

### D2 · Árbol ADN
`DraggableSsp` (`AdnDraggableTree.tsx`) pinta `<HabilidadChips habilidades={ssp.habilidades} />`
debajo del texto, **fuera** de la fila arrastrable (igual que el texto), para que tocar un chip no
inicie un arrastre.

### D3 · Objetivos de sesión: mapa de habilidades
`SessionTargetDetail` no trae habilidades. Se añade `buildSubSubPrincipioHabilidadesMap(gameModel)`
en `dragPayload.ts` (mismo recorrido que `buildSubSubPrincipioTextoMap`) → `Map<string, Habilidad[]>`.
`ContentBoardPage` lo memoiza y lo pasa como prop opcional `habilidadesMap` por
`SessionBoardPanel → SessionCard → SessionTargetTree`; `Leaf` pinta `HabilidadChips` bajo el texto.
Prop opcional con valor por defecto `new Map()` para no romper otros usos/tests.

### D4 · Botón "Editar modelo" / "Crear modelo"
En la `topBar` de `ContentBoardPage`:
- con `gameModel`: botón `outlined` "Editar modelo" (icono `EditOutlined`);
- sin `gameModel`: en el estado vacío, botón "Crear modelo" junto al enlace existente.

Ambos navegan con:
```ts
navigate(`/coach/game-model/${gameModel ? "edit" : "create"}?teamId=${teamId}`, {
  state: {
    season,
    teamId,
    returnTo: `${location.pathname}${location.search}`,
    returnState: location.state,
  },
});
```
`season` es el nombre de la temporada activa que el tablero ya obtiene. Se deshabilita mientras
`season` esté vacío. `returnState` conserva la etiqueta del microciclo en la cabecera al volver.

### D5 · `GameModelCreate` con `returnTo`
`locationState` pasa a `{ season?; teamId?; returnTo?; returnState? }`. Nueva función
`goBack()` usada en `handleSave` (tras guardar) y `handleCancel`:
```ts
const goBack = () =>
  locationState?.returnTo
    ? navigate(locationState.returnTo, { state: locationState.returnState })
    : navigate(`/coach/game-model${location.search}`);
```

## Risks / Trade-offs

- Las habilidades suman altura a cada fila del árbol. Los chips son pequeños y hacen wrap; si
  molesta, en otro cambio se puede plegar el detalle.
- Tooltip en móvil: con `enterTouchDelay={0}` se abre con un toque; también se cierra con un toque
  fuera.

## Files

| Archivo | Cambio |
|---|---|
| `season-plan/components/HabilidadChips.tsx` (+ `.module.css`) | nuevo |
| `season-plan/components/dragPayload.ts` | `buildSubSubPrincipioHabilidadesMap` |
| `season-plan/components/AdnDraggableTree.tsx` | chips bajo el texto de cada sub-subprincipio |
| `season-plan/components/SessionTargetTree.tsx`, `SessionCard.tsx`, `SessionBoardPanel.tsx` | prop `habilidadesMap` y chips en cada objetivo |
| `season-plan/ContentBoardPage.tsx` | mapa memoizado, "Editar modelo" / "Crear modelo" |
| `pages/game-model/GameModelCreate.tsx` | `returnTo` / `returnState` |
| Tests | `HabilidadChips.test.tsx`, `dragPayload.habilidadesMap.test.ts`, `AdnDraggableTree.habilidades.test.tsx`, `SessionTargetTree.test.tsx`, `ContentBoardPage.test.tsx`, `GameModelCreate.returnTo.test.tsx` |
