## Why

Cada escenario del modelo de juego (`GameScenario`, dentro de `coach/game-model`) solo tiene `Name` y `Context` (texto libre) para describir la situación táctica. El coach necesita poder ilustrarla con una foto o un vídeo corto ("se ve la situación del escenario") para que sea más fácil de entender por el resto del cuerpo técnico y, potencialmente, por las familias. Hoy no existe ningún campo de media en `GameScenario` ni en su DTO de respuesta (`ScenarioResponse` de `GetGameModel.cs`).

## What Changes

- **Backend**: `GameScenario` gana `MediaUrl`/`MediaType` (nullable). Dos endpoints nuevos, siguiendo el patrón ya existente de `UploadExerciseMedia.cs` (imagen o vídeo, reemplaza borrando el archivo anterior) y `DeletePlayerPhoto.cs`:
  - `POST /api/game-models/scenarios/{id}/media` — sube/reemplaza el archivo (bucket `game-scenarios` en `IStorageService`, ya usado hoy con almacenamiento local o Supabase según `Storage:UseLocal`).
  - `DELETE /api/game-models/scenarios/{id}/media` — borra el archivo y limpia los campos.
  - Validación: imágenes `image/jpeg|png|webp`; vídeo `video/mp4|webm`. Límite de tamaño 20 MB (aplica a ambos, ya que el propio vídeo lo pide así). La resolución (1920x1080 máx.) y duración (10s máx.) del vídeo **no se validan en backend** (requeriría ffprobe, fuera de alcance) — se validan en el frontend antes de subir, leyendo metadata del `<video>`.
  - `GetGameModel.cs` (`ScenarioResponse`) expone `MediaUrl`/`MediaType`.
- **Frontend**: en `ScenarioFormAccordion.tsx` (edición) y `ScenarioAccordion.tsx` (lectura), un bloque de imagen/vídeo por escenario, reutilizando el patrón ya usado en `ExerciseFormPanel.tsx`/`useExerciseForm.ts` (input oculto, preview, botón "Quitar"). Como el escenario necesita existir en backend (`apiId`) para subir media —igual que ocurre con `UploadExerciseMedia`—, si el escenario aún no se ha guardado se deshabilita la subida con un aviso ("Guarda el modelo de juego primero"). Subida/borrado inmediatos (no forman parte del `PUT` masivo de `UpdateGameModel`).

## Non-Goals

- No se valida resolución/duración de vídeo en backend.
- No se toca el flujo de subida masiva (`PUT /api/game-models/{id}`) — la media se gestiona por endpoints propios, igual que en ejercicios.
- No se añade un componente `MediaUploadField` genérico reutilizable en `shared/` (se replica el patrón puntualmente); se puede extraer en un cambio futuro si se repite una tercera vez.

## Impact

- **Back**: `Domain/Aggregates/GameModels/GameScenario.cs`, nueva config EF, migración, `Features/Coaches/GameModels/Commands/UploadScenarioMedia.cs` (nuevo), `Features/Coaches/GameModels/Commands/DeleteScenarioMedia.cs` (nuevo), `Features/Coaches/GameModels/Queries/GetGameModel.cs`, `Domain/ErrorCodes.cs`.
- **Front**: `types/gameModel.ts`, `services/gameModelService.ts`, `context/GameModelDraftContext.tsx`, `pages/game-model/components/ScenarioFormAccordion.tsx`, `pages/game-model/components/ScenarioAccordion.tsx`.
