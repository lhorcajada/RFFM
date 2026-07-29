# Implement — add-game-scenario-media

Script técnico para el agente `openspec-implementer`. TDD estricto (Red → Green → Refactor) por bloque. No avances al siguiente bloque sin que los tests del bloque actual pasen. Todo el código exacto está en `design.md` — este script indica el orden y qué archivo tocar en cada paso; copia los snippets de `design.md` salvo que aquí se diga algo distinto.

Convenciones detectadas en el repo:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`, xUnit, `#nullable enable`, `[Collection(PostgresCollection.Name)]` + `PostgresContainerFixture` real (no InMemory) para tests que tocan `AppDbContext` — ver `GetClubHandlerTests.cs` como plantilla de fixture.
- Tests frontend co-ubicados en `__tests__/` junto al componente, Vitest + Testing Library, mocks de `gameModelService` con `vi.mock`.

---

## Bloque 1 — Backend: Dominio + migración

### 1.1 Green (sin test unitario dedicado — es un cambio de entidad + config, cubierto por los tests del Bloque 2/3)

Editar `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameScenario.cs`: añadir `MediaUrl`, `MediaType`, `UpdateMedia`, `ClearMedia` (código exacto en `design.md` §1).

Editar `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/GameModels/GameScenarioConfiguration.cs`: añadir las dos `builder.Property(...)` (código en `design.md` §2).

Editar `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`: añadir `public const string ScenarioNotFound = "ScenarioNotFound";` junto a las constantes de `GameModelNotFound` (línea ~61).

Generar migración:
```bash
cd Back/ExtractionApi
.\manage-migrations.ps1
```
Nombre sugerido cuando lo pida el script: `AddGameScenarioMedia`.

Verificar: `dotnet build` (sin la migración aplicada todavía, solo compila).

---

## Bloque 2 — Backend: `UploadScenarioMedia.cs`

### 2.1 Red

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UploadScenarioMediaHandlerTests.cs`. Estructura (adaptar el seed de `GameModel`/`GameScenario`/`Team`/`Club`/`UserClub` al patrón ya usado en tests existentes de `GameModels`, p.ej. buscar un test existente que seedee un `GameModel` completo para copiar el helper de seed — si no existe, seedear manualmente: `Club.Create(...)`, `Team` asociado, `UserClub` con el usuario, `GameModel.Create(teamId, "Modelo", "2025")` o constructor equivalente, y un `GameScenario` vía el constructor público):

Casos (usar `Moq` para `IStorageService`):
- `Handle_UploadsImage_SetsMediaUrlAndTypeImage` — `IFormFile` mock con `ContentType = "image/jpeg"`, `_storage.UploadAsync(...)` devuelve una URL fake; tras `Handle`, `scenario.MediaUrl`/`MediaType == "image"` persistidos (releer de la DB).
- `Handle_UploadsVideo_SetsMediaTypeVideo` — `ContentType = "video/mp4"`.
- `Handle_ReplacingExistingMedia_DeletesOldFile` — escenario con `MediaUrl` previo seedeado; verificar `_storage.Verify(s => s.DeleteAsync(...), Times.Once)`.
- `Handle_UserWithoutClubAccess_ThrowsDomainException` — `UserClubs` no incluye al usuario para ese club → `DomainException` con `ErrorCodes.GameModelAccessDenied`.
- `Handle_ScenarioNotFound_ThrowsDomainException` — id inexistente → `ErrorCodes.ScenarioNotFound`.

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UploadScenarioMediaValidatorTests.cs`:
- `ContentType` no permitido (`"application/pdf"`) → `Validate(...).IsValid == false`.
- `File.Length > 20MB` → inválido.
- `File.Length == 0` → inválido.
- Cada `ContentType` permitido (`image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`) con tamaño válido → válido.

Ejecutar `dotnet test --filter UploadScenarioMedia` → deben fallar en compilación (los tipos no existen todavía).

### 2.2 Green

Crear `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/UploadScenarioMedia.cs` con el contenido exacto de `design.md` §3 (endpoint, command, result, handler, validator).

Ejecutar `dotnet test --filter UploadScenarioMedia` → deben pasar todos.

### 2.3 Refactor

Revisar `using` sobrantes. Confirmar que `AppRoles`/`IRequireFeaturePermission`/`CoachFeatureRoutes.GameModel` ya existen y se reutilizan tal cual (no crear nuevas rutas de permiso).

---

## Bloque 3 — Backend: `DeleteScenarioMedia.cs`

### 3.1 Red

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/DeleteScenarioMediaHandlerTests.cs`:
- `Handle_WithExistingMedia_ClearsFieldsAndDeletesFile` — seed con `MediaUrl` no nulo → tras `Handle`, `scenario.MediaUrl == null` y `_storage.Verify(s => s.DeleteAsync(...), Times.Once)`.
- `Handle_WithoutExistingMedia_IsIdempotent` — `MediaUrl == null` → no lanza, no llama `DeleteAsync`.
- `Handle_UserWithoutClubAccess_ThrowsDomainException`.
- `Handle_ScenarioNotFound_ThrowsDomainException`.

Ejecutar `dotnet test --filter DeleteScenarioMedia` → fallan en compilación.

### 3.2 Green

Crear `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/DeleteScenarioMedia.cs`, calcando la estructura de `UploadScenarioMedia.cs` del Bloque 2 pero:
- `DELETE /api/game-models/scenarios/{id}/media`, sin `IFormFile` (no recibe body).
- Command: `record DeleteScenarioMediaCommand(string ScenarioId, string UserId) : IRequest, IRequireFeaturePermission` (mismo `FeatureRoute`/`RequiredPermission` que `UploadScenarioMedia`).
- Handler: resuelve el escenario (mismo chequeo de acceso), si `scenario.MediaUrl` no es null, `await _storage.DeleteAsync(Bucket, Path.GetFileName(scenario.MediaUrl), ct)`, luego `scenario.ClearMedia()`, `SaveChangesAsync`. Devuelve `Unit.Value`.
- Endpoint devuelve `Results.NoContent()`.

Ejecutar `dotnet test --filter DeleteScenarioMedia` → deben pasar.

### 3.3 Refactor

Sin cambios estructurales adicionales.

---

## Bloque 4 — Backend: `GetGameModel.cs` expone media

### 4.1 Red

Buscar tests existentes de `GetGameModel` (`grep -r "GetGameModelHandlerTests\|class Handler.*GameModelQuery" Back/ExtractionApi/tests`). Si existen, añadir una aserción en un test existente (o crear uno nuevo) que seedee un `GameScenario` con `MediaUrl`/`MediaType` y verifique que `ScenarioResponse.MediaUrl`/`MediaType` los reflejan. Si no existe ningún test de este handler, crear `GetGameModelHandlerMediaTests.cs` mínimo con ese único caso (no dupliques toda la cobertura del handler, ya existente o no, solo el caso de media).

Ejecutar el filtro correspondiente → debe fallar en compilación (los campos no existen en `ScenarioResponse`).

### 4.2 Green

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Queries/GetGameModel.cs`:
- `ScenarioResponse` gana `string? MediaUrl, string? MediaType` al final (ver `design.md` §5).
- En el `Select` que construye cada `ScenarioResponse` (líneas ~160-169), añadir `s.MediaUrl, s.MediaType` como últimos dos argumentos posicionales.

Ejecutar test → debe pasar. Ejecutar `dotnet build` completo para confirmar que no rompió otros consumidores del record (no debería, es un `record` con constructor posicional nuevo, cualquier otro sitio que lo construya con nombres de propiedad no se ve afectado; si algún test construye `ScenarioResponse` posicionalmente sin estos dos campos, actualizarlo).

### 4.3 Refactor

Sin cambios adicionales.

---

## Bloque 5 — Frontend: Tipos + servicio

### 5.1 Green (cambio de tipos, sin test unitario dedicado — se cubre indirectamente en Bloques 6-8)

Editar `Front/src/apps/coach/types/gameModel.ts`: añadir a `Scenario` los campos `mediaUrl?: string | null; mediaType?: "image" | "video" | null;` (ver `design.md` §7).

Editar `Front/src/apps/coach/services/gameModelService.ts`:
- `ApiScenario` gana `mediaUrl: string | null; mediaType: "image" | "video" | null;`.
- `mapApiToGameModel`: al construir cada `Scenario` (dentro del `.push({...})`), añadir `mediaUrl: s.mediaUrl, mediaType: s.mediaType`.
- Añadir `uploadScenarioMedia`/`deleteScenarioMedia` al objeto `gameModelService` (código exacto en `design.md` §7).

Verificar: `npm run build` (typecheck pasa; no debería haber otros consumidores rotos porque los campos son opcionales).

---

## Bloque 6 — Frontend: `ScenarioMediaField.tsx`

### 6.1 Red

Crear `Front/src/apps/coach/pages/game-model/components/__tests__/ScenarioMediaField.test.tsx`. Mockear `gameModelService` con `vi.mock("../../../../services/gameModelService")`. Casos:

- `renderiza el botón de subir cuando no hay media` — sin `mediaUrl`, aparece texto tipo "Subir imagen / vídeo".
- `sube una imagen válida y llama al servicio` — simula `fireEvent.change` del input con un `File` `image/jpeg` pequeño; espera `gameModelService.uploadScenarioMedia` llamado con `(scenarioApiId, file)` y que se invoque `onChange(url, "image")`.
- `rechaza un vídeo que excede la duración/resolución sin llamar al servicio` — mockear `HTMLVideoElement.prototype` (`Object.defineProperty` de `duration`, `videoWidth`, `videoHeight`) y disparar `loadedmetadata` manualmente (jsdom no decodifica vídeo real); verificar que aparece un mensaje de error y que `uploadScenarioMedia` NO se llamó.
- `con media existente, muestra preview y botón Quitar que borra` — pasa `mediaUrl`/`mediaType="image"` como props; clic en "Quitar" → llama `gameModelService.deleteScenarioMedia(scenarioApiId)` y luego `onChange(null, null)`.

Ejecutar `npm run test -- ScenarioMediaField` → deben fallar (el componente no existe).

### 6.2 Green

Crear `Front/src/apps/coach/pages/game-model/components/ScenarioMediaField.tsx` + `ScenarioMediaField.module.css`. Implementar:
- Función `validateVideoConstraints` (código en `design.md` §8), exportada o co-ubicada en el mismo archivo.
- Componente con props `{ scenarioApiId: string; mediaUrl?: string | null; mediaType?: "image" | "video" | null; onChange: (mediaUrl: string | null, mediaType: "image" | "video" | null) => void }`.
- Estado local: `uploading`, `error`.
- Input oculto `accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"` + `label`/`Button` (mismo patrón visual que `ExerciseFormPanel.tsx` líneas 356-389: `IconButton` "✕" para quitar, preview `<img>`/`<video controls>` condicional por `mediaType`).
- `handleFileChange`: valida tamaño (`file.size > 20 * 1024 * 1024` → error), si es vídeo llama `validateVideoConstraints`, si todo ok pone `uploading=true`, llama `gameModelService.uploadScenarioMedia`, en éxito llama `onChange(result.url, result.mediaType)`, en error muestra mensaje genérico.
- `handleRemove`: llama `gameModelService.deleteScenarioMedia(scenarioApiId)`, en éxito `onChange(null, null)`.

Ejecutar `npm run test -- ScenarioMediaField` → deben pasar todos.

### 6.3 Refactor

CSS Modules co-ubicado, sin estilos globales. Confirmar que el componente no importa nada del theme Federation (solo Coach).

---

## Bloque 7 — Frontend: Integrar en `ScenarioFormAccordion.tsx` + `GameModelDraftContext.tsx`

### 7.1 Red

Editar `Front/src/apps/coach/pages/game-model/components/__tests__/ScenarioFormAccordion.test.tsx` (o crear si no existe): añadir un test que renderice un escenario **sin** `apiId` y verifique que se muestra el texto "Guarda el modelo de juego" (o el texto exacto elegido) y que `ScenarioMediaField` NO se renderiza; y otro test con `apiId` presente donde sí se renderiza el campo de media.

Ejecutar `npm run test -- ScenarioFormAccordion` → el nuevo test debe fallar.

### 7.2 Green

Editar `Front/src/apps/coach/context/GameModelDraftContext.tsx`: extender el tipo del action `UPD_SCENARIO` (línea ~27) para incluir `"mediaUrl" | "mediaType"` en el `Pick` (ver `design.md` §10). El reducer no cambia de lógica.

Editar `Front/src/apps/coach/pages/game-model/components/ScenarioFormAccordion.tsx`: en `ScenarioDetailForm` (tras el `Autocomplete`, línea ~334, antes del `Box` de "Subprincipios"), insertar el bloque condicional de `design.md` §9 (`ScenarioMediaField` si `scenario.apiId`, aviso en caso contrario). Importar `ScenarioMediaField` del Bloque 6.

Ejecutar `npm run test -- ScenarioFormAccordion` → deben pasar todos.

### 7.3 Refactor

Confirmar que `dispatch({ type: "UPD_SCENARIO", ... })` en el `onChange` de `ScenarioMediaField` actualiza el draft correctamente (no requiere guardar el modelo para reflejar el cambio en memoria — la subida ya persistió en backend de forma inmediata).

---

## Bloque 8 — Frontend: Vista de lectura `ScenarioAccordion.tsx`

### 8.1 Red

Editar `Front/src/apps/coach/pages/game-model/components/__tests__/ScenarioAccordion.test.tsx` (o crear si no existe): tres casos — `mediaType: "video"` renderiza un `<video>` con el `src` correcto; `mediaType: "image"` renderiza un `<img>`; sin `mediaUrl` no renderiza ningún elemento de media.

Ejecutar `npm run test -- ScenarioAccordion` → deben fallar.

### 8.2 Green

Editar `Front/src/apps/coach/pages/game-model/components/ScenarioAccordion.tsx`: en `ScenarioDetailView` (tras el `Typography` de `context`, línea ~137), insertar el bloque de `design.md` §11.

Editar `ScenarioAccordion.module.css`: añadir `.mediaViewer`/`.mediaViewerContent` (`max-width: 100%; height: auto; border-radius: 8px;` — ver `design.md` §11 para el razonamiento de responsive/nitidez).

Ejecutar `npm run test -- ScenarioAccordion` → deben pasar.

### 8.3 Refactor

Confirmar que `npm run build` no reporta errores de TypeScript.

---

## Bloque 9 — Verificación final

```bash
# Backend
cd Back/ExtractionApi
dotnet build
dotnet test

# Frontend
cd Front
npm run build
npm run test
```

Manual (requiere backend + frontend corriendo, con un modelo de juego ya guardado con al menos un escenario):
1. Abrir el modelo de juego en modo edición → seleccionar un escenario guardado → subir una foto → confirmar que se ve el preview inmediatamente.
2. Volver a la vista de lectura del mismo escenario → confirmar que la foto se ve, nítida, en desktop y en un viewport móvil (DevTools responsive).
3. Subir un vídeo corto (<10s, ≤1920x1080, ≤20MB) → confirmar reproducción con controles.
4. Intentar subir un vídeo que exceda 10s o 1920x1080 → confirmar que se rechaza con un mensaje claro y no se sube.
5. Borrar la media → confirmar que desaparece tanto en edición como en lectura.
6. Escenario recién creado y no guardado todavía → confirmar que el campo de media está deshabilitado con el aviso correspondiente.

Si todo pasa: `openspec validate add-game-scenario-media` y mover la carpeta a `openspec/changes/archive/2026-07-23-add-game-scenario-media/`.
