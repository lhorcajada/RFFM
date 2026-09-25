## Context

- Dominio: `SubSubPrincipio` tiene `SubprincipioId?` y `ZonaId?` (exactamente uno) y ya expone
  `ReparentToSubprincipio` / `ReparentToZona`. `TrainingSessionSubSubPrincipio`,
  `ExerciseModelRelationItem`, `Habilidad` y `Nota` borran en cascada con el sub-subprincipio.
- `UpdateGameModel.UpsertSubprincipios` → para un subprincipio existente llama a `UpsertZonas`
  (que a su vez llama a `UpsertSubSubPrincipios(zona.SubSubPrincipios, …)`) y después a
  `UpsertSubSubPrincipios(sp.SubSubPrincipios, …)`. Cada llamada empareja **solo** dentro de su
  propia lista y borra lo que no emparejó. Las zonas nuevas crean siempre sub-subprincipios nuevos
  (`BuildSspForUpdate`). Resultado: mover = borrar + crear.
- `GetAdnCoverage`: si el subprincipio tiene zonas, agrega solo sobre las zonas; ignora los
  generales.
- Front: `mapSubSubPrincipioRequest` ya envía `id: ssp.apiId`. El editor
  (`GameModelFormEditor.tsx`) oculta "Añadir zona" si hay directos y oculta los directos si hay
  zonas. `dragPayload.ts` (`flattenSubprincipioTargets`, `buildSubSubPrincipioMap`) y
  `AdnDraggableTree.tsx` usan "zonas si las hay y, si no, directos".

## Decisions

### D1 · Backend: emparejar sub-subprincipios a nivel de subprincipio
Para un subprincipio existente, se sustituye el emparejamiento por lista por un **pool** con todos
sus sub-subprincipios actuales (directos + los de todas sus zonas):

```csharp
var pool = sp.SubSubPrincipios.Concat(sp.Zonas.SelectMany(z => z.SubSubPrincipios)).ToList();
var matchedSspIds = new HashSet<string>();
// 1) zonas (existentes y nuevas) → UpsertSubSubPrincipiosInto(pool, zonaRequest.SubSubPrincipios, target: zona)
// 2) generales            → UpsertSubSubPrincipiosInto(pool, spr.SubSubPrincipios, target: sp)
// 3) borrar pool.Where(s => !matchedSspIds.Contains(s.Id))
```

`UpsertSubSubPrincipiosInto` busca en el pool por `Id` (o por `Key` si no viene id, como hoy).
Si lo encuentra: actualiza campos, habilidades y notas como hoy y, si el padre es distinto, lo
**mueve**: lo quita de la colección del padre anterior, lo añade a la del nuevo y llama a
`ReparentToZona(zona.Id)` / `ReparentToSubprincipio(sp.Id)`. Mover también la colección evita que
EF vea datos contradictorios (FK nuevo, pero la entidad sigue en la colección antigua). Si no lo
encuentra, lo crea como hoy (`BuildSspForUpdate`). El borrado se hace **una sola vez** al final,
después de procesar zonas y generales, así el orden de procesado no importa.

`UpsertZonas` deja de borrar sub-subprincipios; las zonas nuevas se crean vacías y se rellenan
desde el pool con el mismo `UpsertSubSubPrincipiosInto`. Las zonas eliminadas se siguen borrando,
pero antes se procesan los sub-subprincipios, así que uno que salía de una zona eliminada hacia otro
padre ya no está en ella y no se borra en cascada.

`MarkNested`/notas: las notas de un sub-subprincipio movido se siguen emparejando por su id como
hoy (`UpsertNotas(…, subSubPrincipioId: existing.Id)`).

No cambian el endpoint, los DTOs ni el validador. Subprincipios nuevos (`BuildSubprincipioForUpdate`)
no cambian: todo lo que contienen es nuevo.

### D2 · Backend: cobertura con generales
En `GetAdnCoverage`, rama "subprincipio con zonas": si además tiene generales, se mapean, se añaden
a `sspCoverages` y su estado agregado (`AggregateStatus`) entra como un hijo más junto a los estados
de las zonas en `AggregateStatusFromChildren`. Sin generales, el resultado es el mismo de hoy.

### D3 · Front: acción `MOVE_SSP` en el draft
`GameModelDraftContext` añade
`{ type: "MOVE_SSP"; pi; spi; fromZi?: number; sspi; toZi?: number }`: saca el objeto
`SubSubPrincipio` (mismo `id`/`apiId`, habilidades y notas) del origen y lo añade al final del
destino (`toZi` indefinido = general). Origen = destino → sin cambios.

### D4 · Front: editor
- `SubprincipioEditor`: "Añadir zona" siempre; la sección de directos siempre visible, con título
  "Sin zona (generales)" si hay zonas (si no, "Sub-subprincipios directos" como hoy); "Añadir
  sub-subprincipio directo" siempre. Se actualiza el texto de ayuda de la sección de zonas.
- `SubSubPrincipioEditor` recibe `zonas` del subprincipio; si hay alguna, pinta un `Select`
  "Zona" (`size="small"`) con "Sin zona (general)" + una opción por zona (etiqueta = `label` o
  `zoneKeys` o "Zona sin definir", como el resumen de `ZonaEditor`). `onChange` → `MOVE_SSP`.

### D5 · Front: tablero
- `flattenSubprincipioTargets`: zonas **y** generales.
- `buildSubSubPrincipioMap`: zonas **y** generales.
- `AdnDraggableTree` (bloque de subprincipio): pinta las zonas y, si además hay generales, un
  bloque "Sin zona" con sus `DraggableSsp`. Sin zonas, igual que hoy.

## Risks / Trade-offs

- `Key` de un sub-subprincipio se construye con fase + número, no con el padre: moverlo no cambia la
  key, así que no hay colisiones nuevas.
- Datos ya existentes con mezcla: pasan a verse en editor y tablero, y su cobertura puede cambiar
  (un subprincipio "completado" con generales sin usar pasa a "en curso"). Es lo correcto.
- Eliminar una zona sigue eliminando sus sub-subprincipios; queda fuera de este cambio.

## Files

| Archivo | Cambio |
|---|---|
| `Back/…/Features/Coaches/GameModels/Commands/UpdateGameModel.cs` | pool por subprincipio, mover en vez de recrear |
| `Back/…/Features/Coaches/GameModels/Queries/GetAdnCoverage.cs` | generales en subprincipios con zonas |
| `Back/…/tests/…/IntegrationTests/UpdateGameModelHandlerTests.cs` | escenarios de mover |
| `Back/…/tests/…/IntegrationTests/GetAdnCoverageHandlerTests.cs` | escenario de mezcla |
| `Front/…/context/GameModelDraftContext.tsx` (+ test) | `MOVE_SSP` |
| `Front/…/pages/game-model/components/GameModelFormEditor.tsx` (+ test) | zonas siempre, generales visibles, selector "Zona" |
| `Front/…/season-plan/components/dragPayload.ts`, `AdnDraggableTree.tsx` (+ tests) | incluir generales |
