## 1. Dominio — promover `Family` a entidad `TeamPlayerFamilyMember` (~2h)

- [x] 1.1 Escribir tests xUnit **primero** (Red) en el proyecto de tests de dominio:
  - `TeamPlayerFamilyMember.Create` con datos válidos asigna `Id` no vacío.
  - `TeamPlayerFamilyMember.Create` sin `Name`/`LastName` lanza (o falla como
    corresponda al patrón de dominio del proyecto — revisar si otras entidades del
    mismo agregado lanzan `ArgumentException` como `TeamPlayerSanction.Create`, o si
    la validación de "obligatoriedad" se deja al `Validator` de FluentValidation en
    el command y el dominio solo valida invariantes más fuertes).
  - Decisión: siguiendo el patrón de `Family`/`AddFamilyMemberEmailIfMissing`
    (permite crear un familiar solo con email, sin Name/LastName), el dominio
    únicamente exige `TeamPlayerId` no vacío (como `TeamPlayerSanction.Create`);
    `Name`/`LastName` obligatorios quedan en el `Validator` de `CreateFamilyMember`.
    Ver `tests/RFFM.Api.Tests/UnitTests/TeamPlayerFamilyMemberTests.cs`.
- [x] 1.2 Crear `Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs : BaseEntity`
  con `TeamPlayerId`, `Name`, `LastName`, `Phone`, `Email`, `Dni`,
  `FamilyMember` (relación, `Domain.ValueObjects.FamilyMember`), navegación
  `TeamPlayer`, factoría estática `Create(...)`, mismo estilo que
  `TeamPlayerSanction.cs`.
- [x] 1.3 `Domain/ValueObjects/FamilyMember.cs`: añadir `LegalGuardian` (3) y
  `Other` (4) a `List()`.
- [x] 1.4 `TeamPlayer.cs`: cambiar `FamilyMembers` de `List<Family>` a
  `List<TeamPlayerFamilyMember>`; `SetFamily`/`AddFamilyMemberEmailIfMissing`
  actualizados para construir/actualizar `TeamPlayerFamilyMember`.
- [x] 1.5 Verificación: `dotnet build` + tests de dominio en verde
  (`dotnet test tests/RFFM.Api.Tests --filter TeamPlayerFamilyMember`).

## 2. Infraestructura EF Core — migración (~2h)

- [x] 2.1 Nuevo `Infrastructure/Persistence/Configuration/Entities/TeamPlayerFamilyMemberEntityConfiguration.cs`
  (`IEntityTypeConfiguration<TeamPlayerFamilyMember>`), mismo patrón que
  `TeamPlayerSanctionEntityConfiguration.cs`: tabla `TeamPlayerFamilies`, `HasKey(Id)`,
  `HasOne(TeamPlayer).WithMany(FamilyMembers).HasForeignKey(TeamPlayerId)`,
  `MaxLength` en `Name`(100)/`LastName`(100)/`Phone`(15)/`Email`(255)/`Dni`(20).
  Decisión: `Address` se mantiene (table-split, misma tabla `TeamPlayerFamilies`,
  columnas `Address_*` sin cambios) — no se expone en ningún DTO nuevo ni existente
  (ya no lo hacía `FamilyResponse` antes de este cambio), pero se conserva sin
  pérdida de datos para los registros ya existentes.
- [x] 2.2 `AppDbContext.cs`: `DbSet<TeamPlayerFamilyMember> TeamPlayerFamilyMembers { get; set; }`
  añadido; configuración `OwnsMany` de `Family` y `GuidStringValueGenerator`
  eliminadas de `TeamPlayersEntityConfiguration.cs` (sin otros usos).
- [x] 2.3 Migración generada: `.\manage-migrations.ps1 -Action create -MigrationName PromoteFamilyToEntityAndAddLastName`.
  Diff resultante: únicamente `AddColumn LastName` (nullable, varchar(100)) sobre
  `TeamPlayerFamilies` — sin `DROP TABLE` ni pérdida de datos, tal y como preveía
  el design.md (la shadow key "Id" ya era una columna real en la tabla).
- [x] 2.4 Migración verificada aplicando limpiamente contra un Postgres real
  (Testcontainers, vía `PostgresContainerFixture.InitializeAsync` → `MigrateAsync`)
  en cada ejecución de la suite de integración; no hay entorno de Development
  accesible desde este sandbox para una verificación manual adicional.
- **Verificación**: `dotnet build` OK; migración aplicada sin errores contra Postgres real (tests).

## 3. Feature `CreateFamilyMember` (~2h)

- [x] 3.1 Tests xUnit **primero** (Red) en
  `tests/RFFM.Api.Tests/IntegrationTests/FamilyMemberEndpointTests.cs` (Postgres
  real vía Testcontainers, host con Mediator+FluentValidation completos):
  - Coach crea familiar con datos válidos → `201 Created`, `Id` no vacío, persistido.
  - Validación: falta `Name`/`LastName`, `FamilyMemberId` desconocido, email/teléfono
    con formato inválido → `400`.
  - `TeamPlayer` inexistente → `404`.
  - Rol sin `Coach`/`Administrator` → `403`.
  - Relaciones no parentales (`LegalGuardian`/`Other`) → `201 Created`.
- [x] 3.2 Creado `Features/Coaches/Players/Commands/CreateFamilyMember.cs`
  (`IFeatureModule`): `MapPost("/api/catalog/teamplayer/{id}/family-members", ...)`
  con `[Authorize(Roles = "Coach,Administrator")]`, `CreateFamilyMemberCommand :
  ICommand<FamilyMemberResponse>`, `Handler`, `Validator`. Divergencia menor del
  design.md: mensajes de validación como literales en español (no
  `ValidationMessages.resx`) — ningún validator existente en el repo usa hoy ese
  resx (verificado por grep), así que se siguió el patrón real más cercano
  (`CreateExerciseValidator`, `SaveTeamRules.Validator`) en vez del aspiracional.
- [x] 3.3 Handler: comprueba existencia de `TeamPlayer` (`NotFoundException` →
  404 vía el mapeo ya existente en `ServiceCollectionExtensions.AddCustomProblemDetails`),
  crea `TeamPlayerFamilyMember.Create(...)`, añade a `db.TeamPlayerFamilyMembers`,
  guarda, mapea a `FamilyMemberResponse`.
- **Verificación**: `dotnet test --filter CreateFamilyMember` en verde; `dotnet build` sin warnings nuevos.

## 4. Feature `DeleteFamilyMember` (~1-2h)

- [x] 4.1 Tests xUnit **primero** (Red) en el mismo `FamilyMemberEndpointTests.cs`:
  - Coach elimina familiar existente → `204`, registro eliminado, resto de
    familiares del mismo `TeamPlayer` intactos.
  - `familyMemberId` inexistente o de otro `TeamPlayer` → `404`, nada eliminado.
  - Rol sin `Coach`/`Administrator` → `403`.
- [x] 4.2 Creado `Features/Coaches/Players/Commands/DeleteFamilyMember.cs`
  (`IFeatureModule`): `MapDelete("/api/catalog/teamplayer/{id}/family-members/{familyMemberId}", ...)`
  con `[Authorize(Roles = "Coach,Administrator")]`, `DeleteFamilyMemberCommand : ICommand`,
  `Handler`. Sin validator.
- [x] 4.3 Handler: busca por `familyMemberId` **y** `TeamPlayerId == id`, `NotFoundException`
  (404) si no coincide, `db.TeamPlayerFamilyMembers.Remove(...)` + `SaveChangesAsync`, `204`.
- **Verificación**: `dotnet test --filter DeleteFamilyMember` en verde.

## 5. Contrato de lectura — `Id`/`LastName` en respuestas existentes (~1-2h)

- [x] 5.1 Tests xUnit **primero** (Red):
  - `tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerHandlerTests.cs` (nuevo): `GetTeamPlayer`
    devuelve `Id`/`LastName` no nulos por familiar, y detecta la regresión de que
    `FamilyMembers` ahora requiere `Include` explícito (antes se auto-cargaba por
    ser owned collection).
  - `tests/RFFM.Api.Tests/IntegrationTests/UpdateTeamPlayerSelfEditTests.cs`
    (extendido): el PUT devuelve `Id`/`LastName` del familiar persistido.
- [x] 5.2 `Features/Coaches/Players/Queries/GetTeamPlayer.cs`: `FamilyResponse` gana
  `Id`/`LastName`; añadido `.Include(tp => tp.FamilyMembers)` (antes no lo necesitaba
  por ser owned collection); mapeo actualizado.
- [x] 5.3 `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs`: mismo cambio en
  `FamilyResponse`/`FamilyRequest` (`LastName` añadido, parámetro opcional al final
  para no romper positional callers existentes); `SetFamily` actualizado.
- **Verificación**: `dotnet test --filter TeamPlayer` (ambos features) en verde.

## 6. Regresión y verificación final (~1h)

- [x] 6.1 Suite completa `dotnet test` del proyecto backend ejecutada: 797/799 en
  verde. Las 2 fallas restantes (`AdnLegibleImporterFullDocumentSpotCheckTests`,
  `GameModelSeederRealDocumentTests`, ambas sobre un heading de Zona no resuelto en
  el documento ADN real) son preexistentes y no relacionadas con este cambio
  (confirmado por `git log` sobre `AdnLegibleImporter.cs`, sin tocar en este diff).
  Regresión real detectada y corregida durante este trabajo: `CreateUser.Handler`
  (`AddFamilyMemberEmailIfMissing`) cargaba `TeamPlayer` sin `.Include(tp =>
  tp.FamilyMembers)`, lo que — al dejar de ser owned collection — hacía que el
  chequeo de email duplicado viera siempre una lista vacía y creara un
  `TeamPlayerFamilyMember` repetido; corregido añadiendo el `Include`.
- [x] 6.2 `dotnet build` de la solución completa: 0 errores, 0 warnings nuevos.
- [x] 6.3 `Domain/ErrorCodes.cs` ampliado con `TeamPlayerNotFound`,
  `FamilyMemberNotFound` y `FamilyMemberRelationUnknown` (este último reservado,
  sin uso actual — la validación de relación desconocida se resuelve en el 400 de
  FluentValidation, no como `NotFoundException`/`DomainException`).
- [x] 6.4 Handoff a front-specialist: contrato final documentado en el resumen de
  la sesión — rutas, shape de `FamilyMemberResponse`/`CreateFamilyMemberRequest`,
  códigos de error (`TeamPlayerNotFound`, `FamilyMemberNotFound`), y el hecho de que
  `GetTeamPlayer`/`UpdateTeamPlayer.FamilyResponse` ahora incluyen `id`/`lastName`.

## 7. Frontend — `FamilyMembersEdit.tsx` + servicio (~3-4h)

- [x] 7.1 `teamplayerService.ts`: tipar `FamilyResponse` con `id: string` y
  `lastName?: string | null`; añadir `createFamilyMember(teamPlayerId, payload):
  Promise<FamilyResponse>` (`POST /api/catalog/teamplayer/{id}/family-members`) y
  `deleteFamilyMember(teamPlayerId, familyMemberId): Promise<void>`
  (`DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`), ambas
  propagando el error (sin try/catch silencioso) para que el componente lo capture
  y muestre el mensaje.
- [x] 7.2 Tests **primero** (Red) en
  `apps/coach/pages/player/components/__tests__/FamilyMembersEdit.test.tsx`
  (reescrito): mock de `createFamilyMember`/`deleteFamilyMember`. Casos: renderiza
  tarjeta por familiar existente (con nombre+apellidos), botón "Añadir familiar"
  siempre visible (sin límite), abre formulario de alta, valida nombre/apellidos/
  relación obligatorios antes de llamar al servicio, email con formato inválido
  bloquea el envío, éxito añade la tarjeta nueva a la lista vía
  `onFamilyMembersChange`, error de servicio muestra mensaje y no cierra el
  formulario; botón "Eliminar" por tarjeta abre `ConfirmDialog`, confirmar llama a
  `deleteFamilyMember` y quita la tarjeta vía `onFamilyMembersChange` en éxito,
  mantiene la tarjeta y muestra error en fallo; el Select de parentesco ahora
  ofrece las 4 opciones (Madre/Padre/Tutor legal/Otro).
- [x] 7.3 Reescribir `FamilyMembersEdit.tsx`: props `teamPlayerId`,
  `familyMembers`, `onFamilyMembersChange`; quitar `MAX_FAMILY_MEMBERS`; formulario
  de alta inline + `ConfirmDialog` de borrado (ver design.md). Actualizar
  `FamilyMembers.tsx` (vista lectura) y `PlayerDetail.tsx` para pasar las nuevas
  props (`teamPlayer.id`, `teamPlayer.familyMembers`, callback que actualiza
  `teamPlayer` vía `setTeamPlayer`) y ampliar `FAMILY_MEMBER_LABEL` con
  `LegalGuardian`/`Other`.
- [x] 7.4 `usePlayerDetailData.ts`: quitar `familyMembers` de la construcción de
  `form` (ya no se edita ahí). `usePlayerSave.ts`: quitar por completo el bloque
  `familyMembers` del payload del `PUT`.
- [x] 7.5 Verificación: `npm run test` (subconjunto `FamilyMembersEdit` y archivos
  afectados) y `npm run build` en verde.
