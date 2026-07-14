## 1. Backend — lógica de visibilidad compartida (≈1h) ✅

- [x] Crear `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubInvitationCodeVisibility.cs` con `CanViewAsync` y `DirectorClubIdsAsync` (ver `design.md` §1).
- [x] Tests (Red primero): `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ClubInvitationCodeVisibilityTests.cs` — casos: Administrator, ClubDirector del club, otro rol en el club, ClubDirector de otro club, no autenticado.
- Verificar: `dotnet test --filter ClubInvitationCodeVisibilityTests` ✅

## 2. Backend — `GetClub.cs` (≈1h) ✅

- [x] Inyectar `HttpContext`/`AppDbContext` en el endpoint, calcular `CanViewInvitationCode` con `ClubInvitationCodeVisibility.CanViewAsync`, pasarlo a `GetClubQueryApp`.
- [x] Añadir campo `CanViewInvitationCode` a `GetClubQueryApp` y usarlo en `CacheKey` (sufijo `:priv`/`:pub`) y en el handler para nulear `invitationCode`.
- [x] Tests (Red primero): `GetClubHandlerTests` — con `CanViewInvitationCode=true/false`; test de `CacheKey` distinto entre ambos casos.
- Verificar: `dotnet build && dotnet test --filter GetClubHandlerTests` ✅

## 3. Backend — `GetClubs.cs` (≈1h) ✅

- [x] Añadir `CanViewAllInvitationCodes` (Administrator) a `ClubsQueryApp`, resolver `DirectorClubIdsAsync` en el handler, nulear `invitationCode` por club salvo admin o director de ese club concreto.
- [x] Quitar `ICacheRequest` de `ClubsQueryApp` (ver justificación en `design.md` §4 — sin consumidores en frontend hoy, cachear por-usuario no es correcto de forma general).
- [x] Tests (Red primero): `GetClubsHandlerTests` — admin ve todos los códigos; no-admin ve `null` salvo en sus clubs como Directive.
- Verificar: `dotnet build && dotnet test --filter GetClubsHandlerTests` ✅

## 4. Frontend — `ClubSelector.tsx` (≈1h) ✅

- [x] Test primero (Red): `ClubSelector.test.tsx` — todos los clubs con `invitationCode: null` → columna/campo ausente; al menos uno con código → columna presente, celda vacía para los `null`.
- [x] Implementar: `anyClubHasInvitationCode` condiciona `<TableHead>`/`<TableCell>` de la tabla y la inclusión del campo en el array `fields` de la tarjeta compacta.
- Verificar: `npm run test -- ClubSelector` && `npm run build` ✅

## 5. Verificación final (≈30min) ✅

- [x] `dotnet test` completo (backend) — 100% pass.
- [x] `npm run test` completo (frontend) — 100% pass.
- [ ] Prueba manual: como `ClubDirector`, ver el código en Ajustes → Mis clubes; como `Coach` del mismo club, la columna no aparece. (Requiere servidor corriendo)
