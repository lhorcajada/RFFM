## Why

El club dispone de dos excels (exportados a CSV en `docs/jugadores/`, temporadas anteriores)
con fichas de inscripción de jugadores: DNI, dirección completa, fecha de nacimiento real,
enfermedades/alergias, procedencia (club anterior) y datos de hasta 2 tutores (nombre, DNI,
dirección, teléfono, email). Cruzando ambos excels con la plantilla actual del club (FEPE,
Cadete D) se han identificado los **22 jugadores actuales** (20 coincidencias exactas de
nombre+apellidos, 2 confirmadas manualmente por pequeñas discrepancias de datos:
`Cascales SAMCHEZ`→`SANCHEZ` typo en BD, y `Erik` sin apellidos→`Fernández Garcinuño, Erik`).

Nuestro esquema ya guarda `Player.Dni`, `Player.BirthDate` y la dirección/teléfono/email de
cada tutor (`TeamPlayerFamilies`), pero **no** tiene dónde guardar enfermedades, alergias,
procedencia ni el DNI del tutor — datos presentes en los excels y valiosos para la gestión del
equipo (protocolos médicos, contacto de emergencia, historial del jugador).

## What Changes

- **Backend (dominio + esquema)**: nuevos campos `Player.Enfermedades`, `Player.Alergias`,
  `Player.Procedencia` (texto libre, igual que `LastTeamName`/`LastTeamCategory`), y
  `Family.Dni` (owned entity `TeamPlayerFamilies`, mismo patrón que `Player.Dni` pero sin la
  validación estricta de checksum — los DNIs de tutores en los excels tienen errores de
  transcripción que no deben bloquear el guardado de una ficha).
- **Backend (API)**: `GetTeamPlayer`/`UpdateTeamPlayer` exponen y aceptan los 4 campos nuevos
  (en `PlayerModel`/`PlayerInfoRequest` para los 3 de jugador, en `FamilyRequest`/`FamilyResponse`
  para el DNI del tutor).
- **Frontend**: `PlayerDetail.tsx` — pestaña Físico gana Enfermedades/Alergias (texto libre);
  pestaña Contacto gana Procedencia; `FamilyMembersEdit.tsx`/`FamilyMembers.tsx` ganan el DNI
  del tutor. Visibles y editables para Coach/Administrator; Enfermedades/Alergias también
  editables por Player/FamilyMember vinculado (mismo alcance que el resto de Físico, ver
  `player-self-edit-physical-family-contact`).
- **Importación de datos** (una sola vez, contra Supabase producción): script que parsea los
  dos CSV, normaliza DNIs (mayúsculas, sin guiones/espacios), cruza contra los 22 jugadores
  actuales por nombre+apellidos normalizado (con las 2 correcciones manuales confirmadas), y
  actualiza cada jugador con los campos rellenables desde el excel: `Dni`, `BirthDate`
  (la columna "Edad" del excel es en realidad la fecha de nacimiento), `Enfermedades`,
  `Alergias`, `Procedencia`, `ContactInfo` (dirección/teléfono/email si están vacíos en BD),
  y hasta 2 familiares (`Tutor_1`→primer `FamilyMember` disponible, `Tutor_2`→segundo) con
  nombre/DNI/dirección/teléfono/email. El script corre primero en modo dry-run (informe sin
  escribir) y solo aplica los cambios tras revisión y confirmación explícita del usuario.

## Impact

- Backend: `Domain/Entities/Players/Player.cs`, `ValidationPlayer.cs`, `ValidationConstants.cs`,
  `Domain/Models/PlayerModelBase.cs`, `Domain/ValueObjects/Family.cs`, `Domain/Models/FamilyModel.cs`,
  `Infrastructure/Persistence/Configuration/Entities/PlayerEntityConfiguration.cs`,
  `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/TeamPlayersEntityConfiguration.cs`,
  `Features/Coaches/Players/Queries/GetTeamPlayer.cs`,
  `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs`, nueva migración EF Core.
- Frontend: `PlayerDetail.tsx`, `components/FamilyMembers.tsx`, `components/FamilyMembersEdit.tsx`,
  `hooks/usePlayerDetailData.ts`, `hooks/usePlayerSave.ts`, `services/teamplayerService.ts`.
- Datos: script de importación puntual (no forma parte del código de producción de la app;
  vive en `docs/jugadores/` o `scripts/` como herramienta de un solo uso) que escribe
  directamente en la base de datos Supabase de producción tras confirmación explícita.

## Out of Scope

- Tercer tutor (`Tutor_3` del excel): el dominio solo modela 2 roles fijos (`Madre`/`Padre`);
  no se amplía el modelo de `FamilyMember` en este cambio.
- Dorsal, edad de admisión, posición y "N_Fenix" del excel: son datos de temporada pasada
  (dorsal/posición ya se gestionan por temporada actual en `TeamPlayer`; "N_Fenix" viene vacío
  en ambos excels) — no se importan.
- Validación estricta (checksum) del DNI del tutor: se guarda tal cual (normalizado en
  formato) sin validar el dígito de control, a diferencia del DNI del jugador.
- Jugadores de los excels que ya no están en la plantilla actual (bajas): no se crean fichas
  nuevas, solo se actualizan los 22 jugadores ya existentes.
