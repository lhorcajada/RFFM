## 1. Backend — Dominio + migración (≈1h)

- [ ] Añadir `MediaUrl`/`MediaType`/`UpdateMedia`/`ClearMedia` a `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameScenario.cs` (ver `design.md` §1).
- [ ] Añadir columnas en `GameScenarioConfiguration.cs` (ver §2).
- [ ] Añadir `ScenarioNotFound` a `Domain/ErrorCodes.cs` (ver §6).
- [ ] Generar migración: `cd Back/ExtractionApi && .\manage-migrations.ps1` (nombre `AddGameScenarioMedia`).
- Verificar: `dotnet build`.

## 2. Backend — `UploadScenarioMedia.cs` (≈2h)

- [ ] Tests primero (Red): `UploadScenarioMediaHandlerTests`, `UploadScenarioMediaValidatorTests` (ver `design.md` "Tests").
- [ ] Implementar endpoint + command + handler + validator (ver §3), calcando `UploadExerciseMedia.cs`.
- Verificar: `dotnet test --filter UploadScenarioMedia`.

## 3. Backend — `DeleteScenarioMedia.cs` (≈1h)

- [ ] Tests primero (Red): `DeleteScenarioMediaHandlerTests`.
- [ ] Implementar endpoint + command + handler (ver §4), calcando `DeletePlayerPhoto.cs`.
- Verificar: `dotnet test --filter DeleteScenarioMedia`.

## 4. Backend — `GetGameModel.cs` expone media (≈30min)

- [ ] Añadir `MediaUrl`/`MediaType` a `ScenarioResponse` y al `Select` del handler (ver §5).
- [ ] Test: extender/crear test de `GetGameModel` handler para verificar que la respuesta incluye media.
- Verificar: `dotnet build && dotnet test --filter GetGameModel`.

## 5. Frontend — Tipos + servicio (≈1h)

- [ ] `types/gameModel.ts`: añadir `mediaUrl`/`mediaType` a `Scenario` (ver §7).
- [ ] `services/gameModelService.ts`: `ApiScenario` + mapper + `uploadScenarioMedia`/`deleteScenarioMedia` (ver §7).
- Verificar: `npm run build` (typecheck).

## 6. Frontend — Validación de vídeo + `ScenarioMediaField.tsx` (≈2h)

- [ ] Tests primero (Red): `ScenarioMediaField.test.tsx` (ver `design.md` "Tests").
- [ ] Implementar `validateVideoConstraints` (ver §8) y el componente `ScenarioMediaField` (ver §9), reutilizando el patrón visual de `ExerciseFormPanel.tsx`.
- Verificar: `npm run test -- ScenarioMediaField`.

## 7. Frontend — Integrar en `ScenarioFormAccordion.tsx` + `GameModelDraftContext.tsx` (≈1h)

- [ ] Extender `UPD_SCENARIO` en `GameModelDraftContext.tsx` (ver §10).
- [ ] Insertar `ScenarioMediaField`/aviso de "guarda primero" en `ScenarioDetailForm` (ver §9).
- [ ] Test: extender `ScenarioFormAccordion.test.tsx`.
- Verificar: `npm run test -- ScenarioFormAccordion`.

## 8. Frontend — Vista de lectura `ScenarioAccordion.tsx` (≈1h)

- [ ] Añadir bloque de imagen/vídeo en `ScenarioDetailView` (ver §11) + estilos responsive en `.module.css`.
- [ ] Test: extender `ScenarioAccordion.test.tsx`.
- Verificar: `npm run test -- ScenarioAccordion` && `npm run build`.

## 9. Verificación final (≈30min)

- [ ] `dotnet test` completo (backend) — 100% pass.
- [ ] `npm run test` completo (frontend) — 100% pass.
- [ ] `npm run build` sin errores de TypeScript.
- [ ] Prueba manual (servidor + frontend corriendo): como coach, abrir un modelo de juego guardado → escenario → subir foto → verla en modo lectura → subir vídeo corto → verlo → borrar → confirmar que desaparece. Probar en viewport móvil que la imagen/vídeo no rompe el layout.
