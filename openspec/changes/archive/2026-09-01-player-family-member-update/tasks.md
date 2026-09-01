## 1. Backend — endpoint `PUT` de edición individual

- [x] 1.1 (TDD Red) Añadir tests de integración a
      `tests/RFFM.Api.Tests/IntegrationTests/FamilyMemberEndpointTests.cs`
      (sección nueva `// ── PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId} ───`):
      - `UpdateFamilyMember_WithDisallowedRole_ReturnsForbidden` (Theory "Player"/"FamilyMember")
      - `UpdateFamilyMember_WithCoachRoleAndValidData_UpdatesSuccessfully` (verifica 200 + valores
        actualizados en BD, y que el `Id` no cambia)
      - `UpdateFamilyMember_WithInvalidData_ReturnsBadRequest` (mismos casos que
        `CreateFamilyMember_WithInvalidData_ReturnsBadRequest`)
      - `UpdateFamilyMember_ForNonExistentFamilyMember_ReturnsNotFound`
      - `UpdateFamilyMember_BelongingToAnotherTeamPlayer_ReturnsNotFound`
      Verificación: `dotnet test --filter FamilyMemberEndpointTests` falla (Red) — el endpoint no existe.
- [x] 1.2 (TDD Green) Crear
      `src/RFFM.Api/Features/Coaches/Players/Commands/UpdateFamilyMember.cs`
      (`IFeatureModule`, `UpdateFamilyMemberCommand : ICommand<CreateFamilyMember.FamilyMemberResponse>`,
      `Handler`, `Validator`) según `design.md` sección "Decisions".
- [x] 1.3 Registrar el `Validator` en el bootstrap de test
      (`services.AddScoped<IValidator<UpdateFamilyMember.UpdateFamilyMemberCommand>, UpdateFamilyMember.Validator>();`
      en `StartHostAsync` de `FamilyMemberEndpointTests.cs`) — el registro real en
      producción ya lo cubre el scan automático de `AddFeatureModules`/DI existente
      (mismo mecanismo que `CreateFamilyMember`).
- [x] 1.4 Verificación: `dotnet build` y
      `dotnet test --filter FamilyMemberEndpointTests` en verde (Green).

## 2. Frontend — botón y formulario de edición

- [x] 2.1 (TDD Red) Añadir tests a
      `Front/src/apps/coach/pages/player/components/__tests__/FamilyMembersEdit.test.tsx`:
      - Renderiza un botón "Editar" (`aria-label="Editar familiar {nombre}"`) por
        cada familiar existente.
      - Al pulsarlo, el formulario se precarga con los valores actuales del
        familiar (incluido `familyMemberId` mapeado desde `member.familyMember`).
      - Al guardar, llama a `updateFamilyMember(teamPlayerId, member.id, payload)`
        (mock del servicio) y el elemento actualizado sustituye al anterior en
        `onFamilyMembersChange`.
      - En error de guardado, muestra el mensaje de error y no cierra el formulario.
      Verificación: `npm run test -- FamilyMembersEdit` falla (Red).
- [x] 2.2 (TDD Green) Añadir `updateFamilyMember` a
      `apps/coach/services/teamplayerService.ts` (mismo patrón que
      `createFamilyMember`) y export en el `default` del archivo.
- [x] 2.3 (TDD Green) Modificar `FamilyMembersEdit.tsx`: generalizar
      `adding`/`draft` a `editingId: string | null`, añadir botón "Editar" por
      tarjeta, precarga de `draft`, y bifurcación create/update en `handleSubmit`
      según `design.md` sección "Frontend".
- [x] 2.4 Verificación: `npm run test -- FamilyMembersEdit` en verde (Green), y
      `npm run build` sin errores de TypeScript.

## 3. Verificación final

- [x] 3.1 `dotnet test` (suite completa afectada) en verde. 810/812 (2 fallos
      preexistentes en `AdnLegibleImporterFullDocumentSpotCheckTests`/
      `GameModelSeederRealDocumentTests`, sin relación con este cambio).
- [x] 3.2 `npm run test` (suite `FamilyMembersEdit`) en verde: 19/19.
- [x] 3.3 `npm run build` en verde.
- [ ] 3.4 Confirmar manualmente (o vía `run`/browser) en
      `coach/player/{id}?teamId={teamId}` que "Editar" en una tarjeta de
      familiar abre el formulario precargado, guarda, y refleja el cambio sin
      recargar la página. No verificado en este cambio (usuario confirmó
      manualmente por su cuenta: "Todo funciona correctamente").
