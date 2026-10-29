## 1. Backend — `CreateTeamsBatch` (TDD)

- [x] 1.1 RED: tests del validador (`CreateTeamsBatchValidatorTests`): campos vacíos, `Letters` vacío, > 26, letra inválida, repetidas (tras normalizar).
- [x] 1.2 RED: tests del handler (`CreateTeamsBatchHandlerTests`): crea todas, omite existentes sin distinguir mayúsculas, todo omitido, categoría inexistente, equipos sin foto y con `LeagueId`.
- [x] 1.3 GREEN: `Features/Coaches/Teams/Commands/CreateTeamsBatch.cs` (endpoint, comando, validador, handler, DTOs, invalidación de caché y permiso `ClubTeams`/`ReadWrite`).
- [ ] 1.4 `dotnet build` y tests del área (`dotnet test --filter CreateTeamsBatch`).

## 2. Frontend — lógica y servicio (TDD)

- [x] 2.1 RED: `teamBatch.test.ts` (`buildTeamName`, `getExistingLetters`, `lettersRange`) y test de `teamService.createTeamsBatch` (URL, cuerpo, temporada activa).
- [x] 2.2 GREEN: `teamBatch.ts` y `createTeamsBatch` en `teamService.ts`.

## 3. Frontend — componentes (TDD)

- [x] 3.1 RED→GREEN: `TeamCrest` y su uso como fallback en `ClubTeamCard` (actualizar el test del icono por defecto).
- [x] 3.2 RED→GREEN: `TeamLettersPicker` (bloqueadas, `aria-pressed`, atajos, objetivos ≥44px).
- [x] 3.3 RED→GREEN: `BatchSummary` (contadores, lista, botón «Crear N equipos» deshabilitado con 0).
- [x] 3.4 RED→GREEN: `CreateTeam` con selector de modo; `single` sin cambios; `batch` envía letras, se reinicia al cambiar categoría, snackbar de resultado/error y navegación (incluida la vuelta a ajustes). Actualizar `CreateTeam.test.tsx` existente.
- [ ] 3.5 CSS Modules responsive mobile-first (sin tablas) comprobado a ~390px y escritorio contra `.design/teams-new`.

## 4. Verificación y versiones

- [x] 4.1 Suite completa Front una sola vez (`npx vitest run --maxWorkers=2`) y `npm run build`.
- [ ] 4.2 Suite completa Back una sola vez (`dotnet test`) y `dotnet build`.
- [x] 4.3 Subir versión minor: `Front/package.json` y `Back/ExtractionApi/Directory.Build.props`.
- [x] 4.4 `openspec validate club-teams-batch-create --strict`.
