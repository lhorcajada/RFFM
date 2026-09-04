## 1. Dominio (~30 min)

- [x] 1.1 Añadir `UpdateColors(shirtColor, shortsColor, socksColor)` a
      `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/ClubKit.cs`

## 2. Comando (TDD) (~2h)

- [x] 2.1 Tests en `SaveClubKitsHandlerTests.cs` (crea/actualiza ambos `ClubKit`, `teamId`
      inexistente → `NotFoundException`; actualizado después para exigir `socksColor`
      explícito en vez de derivarlo)
- [x] 2.2 Implementado `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Kits/SaveClubKits.cs`
- [x] 2.3 Tests verdes (Green)

## 3. Validación de contrato (~30 min)

- [x] 3.1 Tests de validador en `SaveClubKitsValidatorTests.cs` (cantidad != 2, `kitNumber`
      duplicado/fuera de rango, colores con formato inválido, incluido `socksColor`)
- [x] 3.2 Verde

## 4. Verificación (~30 min)

- [x] 4.1 `dotnet build` desde `Back/ExtractionApi` — 0 errores
- [x] 4.2 `dotnet test --filter SaveClubKits` — verde
- [x] 4.3 `dotnet test` completo — 948 pasan, solo los 2 fallos preexistentes no relacionados
      (`AdnLegibleImporterFullDocumentSpotCheckTests`, `GameModelSeederRealDocumentTests`)
- [x] 4.4 `openspec validate add-club-kit-configuration --strict` sin errores

## 5. Handoff a frontend

- [x] 5.1 Contrato exacto documentado (`design.md` §2) y pasado a `front-specialist`
- [x] 5.2 Completado por frontend (ver §6) — ya no queda pendiente

## 6. Frontend delivery (post-backend addendum, `front-specialist`)

- [x] 6.1 `Front/src/apps/coach/services/kitService.ts` — `saveClubKits(teamId, kits)`,
      `ClubKitInput` con `shirtColor`/`shortsColor`/`socksColor`.
- [x] 6.2 `Front/src/apps/coach/pages/convocations/components/KitSelector/ClubKitEditor.tsx`
      (+ `.module.css`) — paleta fija de colores (`utils/kitColors.ts`), 3 selectores por
      equipación (camiseta/pantalón/medias), crea o edita (`initialKits`) las 2 equipaciones a
      la vez.
- [x] 6.3 `ConvocationMatchHeader.tsx` — el panel de equipación es un popup (MUI `Dialog`,
      no un panel inline), con resumen compacto en la cabecera cuando hay equipación
      seleccionada para el partido.
- [x] 6.4 `ConvocationDetailsDialog.tsx` y `convocationSummary.ts` (`buildWhatsAppText`) —
      muestran ambas equipaciones con sus colores reales y marcan cuál se juega.
- [x] 6.5 `npm run test` — suites `convocations`/`attendance`/servicios en verde; barrido
      completo del repo: 1004/1008 pasan, 3 skipped preexistentes, 1 fallo preexistente no
      relacionado (`TeamRulesEdit.test.tsx`, timeout de reordenar, archivo no tocado por este
      cambio). `npm run build` — sin errores de TypeScript.
