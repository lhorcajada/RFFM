## 1. Backend — dominio y esquema (≈2h)

- [x] 1.1 `ValidationConstants.cs`: `PlayerEnfermedadesMaxLength`, `PlayerAlergiasMaxLength`,
  `PlayerProcedenciaMaxLength` + mensajes `*CannotExceedMaxLength`.
- [x] 1.2 `ValidationPlayer.cs`: `ValidateEnfermedades`/`ValidateAlergias`/`ValidateProcedencia`
  (solo longitud máxima, igual patrón que `ValidateLastName`).
- [x] 1.3 `Player.cs`: propiedades + `Update*` + llamada desde el constructor privado.
- [x] 1.4 `PlayerModelBase.cs`: `Enfermedades`/`Alergias`/`Procedencia`.
- [x] 1.5 `Family.cs`: propiedad `Dni`, parámetro en constructor y `UpdateDetails`, incluido
  en `GetEqualityComponents`.
- [x] 1.6 `FamilyModel.cs`: propiedad `Dni`.
- [x] 1.7 `TeamPlayer.SetFamily`: pasar `fm.Dni` en ambas ramas (in-place / nueva instancia).
- [x] 1.8 Tests xUnit (TDD) — escribir primero: `Player.Create`/`UpdateEnfermedades`/
  `UpdateAlergias`/`UpdateProcedencia` guardan el valor y rechazan (o truncan según se decida)
  longitudes excesivas; `Family` con `Dni` distinto no es igual a otra sin `Dni` (equality).
- **Verificación**: `dotnet build` + tests de dominio afectados en verde.

## 2. Backend — EF Core y migración (≈1h)

- [x] 2.1 `PlayerEntityConfiguration.cs`: `HasMaxLength` para los 3 campos nuevos.
- [x] 2.2 `TeamPlayersEntityConfiguration.cs` (owned `Family`): `family.Property(f => f.Dni)`.
- [x] 2.3 Generar migración EF Core (`dotnet ef migrations add
  AddPlayerMedicalFieldsAndTutorDni --project src/RFFM.Api --startup-project src/RFFM.Host`,
  revisar script/proyecto de arranque exacto contra `manage-migrations.ps1`).
- [x] 2.4 Revisar el SQL generado (`Up`/`Down`) antes de aplicar: solo `ADD COLUMN` nullable,
  sin pérdida de datos.
- **Verificación**: `dotnet build` sin errores; migración revisada manualmente (no se aplica
  todavía a Supabase — eso ocurre en la sección 5, tras confirmación explícita).

## 3. Backend — API (≈1-2h)

- [x] 3.1 `Features/Coaches/Players/Queries/GetTeamPlayer.cs`: mapear los 3 campos de `Player`
  en `PlayerModel` de la respuesta.
- [x] 3.2 `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs`:
  - `PlayerInfoRequest` gana `Enfermedades`/`Alergias`/`Procedencia`; el handler los aplica
    igual que `UrlPhoto` (solo si no son `null`).
  - Filtrado por rol restringido: preservar estos 3 campos (no anularlos) al reconstruir
    `PlayerInfo` para `Player`/`FamilyMember` no-Coach/Admin.
  - `FamilyRequest`/`FamilyResponse` ganan `Dni`; mapeo en ambas direcciones (request→
    `FamilyModel`, `item.FamilyMembers`→`FamilyResponse`).
- [x] 3.3 Tests xUnit (TDD) — escribir primero, ampliando `UpdateTeamPlayerSelfEditTests.cs`:
  Coach guarda Enfermedades/Alergias/Procedencia/Dni de tutor; Player/FamilyMember vinculado
  también guarda Enfermedades/Alergias/Procedencia (pero no Dorsal/Demarcación/Nombre, como ya
  se comprobaba); `GetTeamPlayer` devuelve los 3 campos de `Player` tras guardarlos.
- **Verificación**: `dotnet build` + `dotnet test` (proyecto de tests) en verde.

## 4. Frontend (≈2-3h)

- [x] 4.1 `services/teamplayerService.ts`: `FamilyResponse` gana `dni?: string | null`.
- [x] 4.2 `hooks/usePlayerDetailData.ts`: `form` inicial incluye `enfermedades`, `alergias`,
  `procedencia` (desde `tp.player?.*`) y `dni` por cada familiar.
- [x] 4.3 `PlayerDetail.tsx` (edición): Físico gana `TextField multiline` Enfermedades y
  Alergias; Contacto gana `TextField` Procedencia.
- [x] 4.4 `components/PhysicalInfo.tsx` / `components/ContactInfo.tsx` (lectura): filas nuevas
  a juego con el resto (`styles.row`).
- [x] 4.5 `components/FamilyMembersEdit.tsx` / `components/FamilyMembers.tsx`: campo/fila DNI
  del tutor.
- [x] 4.6 `hooks/usePlayerSave.ts`: payload incluye `playerInfo.enfermedades/alergias/procedencia`
  y `familyMembers[].dni`.
- [x] 4.7 Tests Vitest (TDD) — escribir primero: Físico en edición muestra/guarda
  Enfermedades/Alergias; Contacto en edición muestra/guarda Procedencia; `FamilyMembersEdit`
  muestra/guarda DNI del tutor; regresión de `PlayerDetail`/`usePlayerSave` ya existentes sigue
  en verde.
- **Verificación**: `npm run test` (archivos afectados) + `npm run build` en verde.

## 5. Importación de datos desde los excels (≈2-3h, requiere confirmación explícita)

- [x] 5.1 Escribir `docs/jugadores/import_players.py`: parseo de los 2 CSV, normalización de
  nombre/DNI, cruce contra `app."Players"` (22 jugadores actuales) con el diccionario de
  overrides manuales confirmado, y generación de `import_report.json`/informe en consola con
  el detalle campo a campo (antes → después) por jugador — **sin escribir en BD** (modo
  dry-run por defecto). Añadidas también, tras revisar el primer dry-run: deduplicación de
  tutores repetidos en la misma fila y validación de Localidad/C.Postal (se omiten si no
  tienen forma de ciudad/CP válido) para no arrastrar filas mal rellenadas del excel original.
- [x] 5.2 Ejecutado en modo dry-run contra Supabase (solo lecturas) y presentado el informe
  completo al usuario para revisión (22/22 jugadores con cambios propuestos, 2 casos
  especiales detectados y resueltos: 1 tutor duplicado fusionado, 1 fila con
  ciudad/CP inválidos omitidos).
- [x] 5.3 Migración EF Core de la sección 2 aplicada contra Supabase (`dotnet ef database
  update` vía `manage-migrations.ps1 -Action apply`) — confirmación explícita del usuario
  obtenida antes de ejecutar.
- [x] 5.4 Tras aprobación del informe dry-run, ejecutado el script con `--apply` (transacción
  por jugador) — confirmación explícita del usuario obtenida antes de ejecutar. Resultado:
  22 jugadores actualizados, 0 fallos.
- [x] 5.5 Verificados 3 jugadores representativos (incluyendo el caso de la fila mal
  rellenada y el caso NIE/extranjero) directamente contra Supabase: datos correctos, tildes/ñ
  preservadas, campos inválidos correctamente omitidos.
- [x] 5.6 Eliminados `import_players.py` e `import_report.json` de `docs/jugadores/` (ya no
  hacen falta, los datos ya están en BD). Los 2 CSV originales se mantienen en
  `docs/jugadores/` por decisión explícita del usuario.
- **Verificación**: informe dry-run revisado y aprobado antes de 5.3/5.4; confirmación
  explícita del usuario obtenida en cada paso irreversible (migración en prod, escritura en
  prod, borrado de ficheros).

## 6. Verificación final

- [x] `dotnet build` + `dotnet test` (backend) en verde (634/636; los 2 fallos son
  preexistentes en `GameModelImport`/`GameModelSeeder`, no relacionados con este cambio).
- [x] `npm run build` + `npm run test` (frontend) en verde (34/34 tests nuevos/afectados en
  verde; build de producción sin errores).
- [x] Repasar checklist de `.claude/rules/git.md` §6.3 antes de proponer commit: no
  commitear/pushear sin build+tests en verde y confirmación explícita del usuario.
