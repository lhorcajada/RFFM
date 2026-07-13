# Tasks — fix-coach-config-cross-user-leak

Orden: contrato ya hecho → backend (TDD) → frontend (TDD) → verificación E2E manual (incluye flujo de crear temporada).

## 1. Contrato (completado)

- [x] 1.1 proposal.md
- [x] 1.2 design.md

## 2. Backend — scoping por usuario (TDD)

- [x] 2.1 **Red**: `RFFM.Api.Tests` — `GetConfigHandlerTests`: con filas de 2 coaches en BD, `Handle` con `ICurrentUserService.UserId = coachA` devuelve solo la fila de `coachA`; coach sin fila propia devuelve `[]` (nunca la de otro).
- [x] 2.2 **Red**: `CreateConfigHandlerTests`: `CoachId` del body distinto al del token → la entidad creada usa el `CoachId` del token.
- [x] 2.3 **Red**: `UpdateConfigHandlerTests` / `DeleteConfigHandlerTests`: modificar/borrar fila de otro coach → `ForbiddenAccessException`; modificar/borrar fila propia → éxito.
- [x] 2.4 Ejecutar `dotnet test --filter "GetConfigHandlerTests|CreateConfigHandlerTests|UpdateConfigHandlerTests|DeleteConfigHandlerTests"` → deben fallar (comportamiento actual no filtra).
- [x] 2.5 **Green**: editar `ConfigurationCoach.cs` — inyectar `ICurrentUserService` en los 4 handlers; `GetConfigHandler` filtra `Where(c => c.CoachId == userId)`; `CreateConfigHandler` usa `userId` del token en vez de `request.Request.CoachId`; `UpdateConfigHandler`/`DeleteConfigHandler` comprueban `entity.CoachId == userId` y lanzan `ForbiddenAccessException` si no.
- [x] 2.6 **Green**: añadir `.RequireAuthorization()` a los 4 `MapGet/MapPost/MapPut/MapDelete` de `ConfigurationCoachModule`.
- [x] 2.7 Verificar: `dotnet build` + `dotnet test` → todos verdes.

## 3. Frontend — quitar fallback cruzado (TDD)

- [x] 3.1 **Red**: `Front/src/apps/coach/services/__tests__/configurationCoachService.test.ts` — `getCurrent()` devuelve `configs[0]` cuando `getAll()` (mockeado) devuelve 1 fila propia; devuelve `null` cuando `getAll()` devuelve `[]`.
- [x] 3.2 Ejecutar `npm run test -- configurationCoachService` → ambos casos pasan ya con el código actual (comportamiento no reproducible a nivel de mock unitario; el objetivo del test es fijar el contrato antes de simplificar el código).
- [x] 3.3 **Green**: simplificado `getCurrent()` en `configurationCoachService.ts` a `configs[0] ?? null`; eliminado el import de `coachAuthService` (confirmado que no se usaba en ningún otro punto del archivo).
- [x] 3.4 Verificar: `npm run test -- configurationCoachService` (2/2 pasan) + `npm run build` (build correcto).

## 4. Verificación E2E manual

- [x] 4.1 Backend + frontend corriendo. Login como Coach A (ya tiene club/temporada) → Configuración → ve su propia temporada. (verificado manualmente por el usuario)
- [x] 4.2 Registrar un Coach B nuevo → login → Configuración → Temporadas → **no** ve la temporada de Coach A (lista vacía). (verificado manualmente por el usuario)
- [x] 4.3 Con el token de Coach B, `PUT /api/coaches/configuration/{idDeConfigDeCoachA}` (Postman/curl) → 403 `ProblemDetails`. (verificado manualmente por el usuario)
- [x] 4.4 Sin token, `GET /api/coaches/configuration` → 401. (verificado manualmente por el usuario)
- [x] 4.5 Coach B: usar el flujo existente de "crear temporada" desde Configuración → confirmar que la temporada se crea correctamente y queda asociada a su propio club (sin afectar a Coach A). (verificado manualmente por el usuario)
- [x] 4.6 `dotnet build` + `dotnet test` verdes. (60/60 verificado por back-specialist)
- [x] 4.7 `npm run build` + `npm run test` verdes. (verificado por front-specialist)
- [x] 4.8 `openspec validate fix-coach-config-cross-user-leak` → OK.
- [x] 4.9 Archivar a `openspec/changes/archive/2026-07-13-fix-coach-config-cross-user-leak/`.
