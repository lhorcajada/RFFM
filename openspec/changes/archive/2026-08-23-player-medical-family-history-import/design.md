## Architecture Decisions

### 0. Dónde viven los campos nuevos

- `Enfermedades`, `Alergias`, `Procedencia` → en `Player` (no en `TeamPlayer`), mismo nivel
  que `Dni`/`BirthDate`/`LastTeamName`: son datos de la persona, no de su paso por un equipo
  concreto en una temporada. Texto libre (`string?`), sin validación de formato — mismo
  patrón que `LastTeamName`/`LastTeamCategory` (solo `HasMaxLength`).
- `Dni` del tutor → en `Family` (owned entity de `TeamPlayer.FamilyMembers`, tabla
  `TeamPlayerFamilies`), junto a `Address`/`Phone`/`Email`/`Name`/`FamilyMember` ya
  existentes. Sin validación de checksum (a diferencia de `Player.Dni`): los DNIs de tutores
  de los excels traen erratas y no deben bloquear el guardado.

### 1. Backend — Dominio

`Player.cs`:
```csharp
public string? Enfermedades { get; private set; }
public string? Alergias { get; private set; }
public string? Procedencia { get; private set; }

public void UpdateEnfermedades(string? enfermedades) { ValidationPlayer.ValidateEnfermedades(enfermedades); Enfermedades = enfermedades; }
public void UpdateAlergias(string? alergias) { ValidationPlayer.ValidateAlergias(alergias); Alergias = alergias; }
public void UpdateProcedencia(string? procedencia) { ValidationPlayer.ValidateProcedencia(procedencia); Procedencia = procedencia; }
```
Llamadas también desde el constructor privado `Player(PlayerModelBase)`, igual que
`UpdateDni`. `PlayerModelBase` gana `Enfermedades`/`Alergias`/`Procedencia` (`string?`).

`ValidationConstants.cs`: `PlayerEnfermedadesMaxLength = 2000`,
`PlayerAlergiasMaxLength = 2000`, `PlayerProcedenciaMaxLength = 200` (mismo orden de magnitud
que `LastTeamName`/`LastTeamCategory`); mensajes `*CannotExceedMaxLength` a juego con el
resto del archivo.

`Family.cs`: añade `Dni` (`string?`, propiedad `private set`), parámetro en el constructor y
en `UpdateDetails`, incluido en `GetEqualityComponents`. `FamilyModel.cs` (Domain/Models) gana
`Dni`. `TeamPlayer.SetFamily` ya construye `Family`/llama `UpdateDetails` — solo hace falta
pasar `fm.Dni` al nuevo parámetro en ambas ramas (in-place y nueva instancia).

### 2. Backend — EF Core

`PlayerEntityConfiguration.cs`: 3 `builder.Property(...).HasMaxLength(...)` nuevas, igual
patrón que `LastTeamName`.

`TeamPlayersEntityConfiguration.cs` (bloque `OwnsMany(tp => tp.FamilyMembers, family => {...})`):
añadir `family.Property(f => f.Dni)` (sin `HasMaxLength` estricta, o una generosa tipo 30, ya
que no se valida formato).

Nueva migración EF Core:
```
cd Back/ExtractionApi
dotnet ef migrations add AddPlayerMedicalFieldsAndTutorDni --project src/RFFM.Api --startup-project src/RFFM.Host
```
(revisar el nombre exacto de startup project en `manage-migrations.ps1` antes de ejecutar).

### 3. Backend — API

`GetTeamPlayer.cs` / `UpdateTeamPlayer.cs`:
- `PlayerModel` (Domain/Models, usado en ambos) ya es compartido — añadir `Enfermedades`,
  `Alergias`, `Procedencia` ahí una sola vez, ambos endpoints lo heredan sin más cambio en el
  mapeo (`new PlayerModel { ..., Enfermedades = player?.Enfermedades, ... }`).
- `UpdateTeamPlayer.PlayerInfoRequest` gana `Enfermedades`, `Alergias`, `Procedencia`;
  el handler aplica `if (req.PlayerInfo.Enfermedades != null) playerEntity.UpdateEnfermedades(...)`
  igual que el resto de campos opcionales de `PlayerInfoRequest`.
- Restricción de rol (`Player`/`FamilyMember` no vinculado a Coach/Admin): el bloque que hoy
  anula `PlayerInfo` a `(null, null, null, req.PlayerInfo.UrlPhoto)` pasa a preservar también
  `Enfermedades`/`Alergias`/`Procedencia` — son campos de físico/contacto que esos roles ya
  pueden tocar, igual que la foto:
  ```csharp
  PlayerInfo = req.PlayerInfo is null
      ? null
      : new PlayerInfoRequest(null, null, null, req.PlayerInfo.UrlPhoto,
            req.PlayerInfo.Enfermedades, req.PlayerInfo.Alergias, req.PlayerInfo.Procedencia)
  ```
- `UpdateTeamPlayer.FamilyRequest`/`FamilyResponse` (y las mismas records en `GetTeamPlayer.cs`)
  ganan `Dni`; `TeamPlayer.SetFamily` ya recibe `FamilyModel` desde el handler — añadir
  `Dni = f.Dni` al mapeo `req.FamilyMembers.Select(f => new FamilyModel { ... })`.

### 4. Frontend

`teamplayerService.ts`: `PlayerResponse`/el tipo inline de `player` en `TeamPlayerResponse`
sigue como `any` (patrón ya existente, no se introduce tipado nuevo ahí); `FamilyResponse`
gana `dni?: string | null`; el payload de `updateTeamPlayer` (`FamilyResponse` reutilizado)
ya cubre `Dni` sin cambio adicional de tipo.

`usePlayerDetailData.ts`: `form` inicial gana `enfermedades`, `alergias`, `procedencia` desde
`tp.player?.enfermedades` etc., y cada entrada de `familyMembers` gana `dni: f.dni ?? ""`.

`PlayerDetail.tsx`:
- Tab Físico (edición): dos `TextField` `multiline` (Enfermedades, Alergias) tras el `Select`
  de Pie — mismo `styles.card`/`sectionInner`.
- Tab Contacto (edición): `TextField` Procedencia tras el bloque de dirección.
- `PhysicalInfo.tsx`/`ContactInfo.tsx` (vista lectura): filas nuevas a juego (`styles.row`).

`FamilyMembersEdit.tsx`/`FamilyMembers.tsx`: `TextField`/fila DNI junto a Nombre.

`usePlayerSave.ts`: payload — `playerInfo.enfermedades/alergias/procedencia` desde `form`;
cada elemento de `familyMembers` incluye `dni: f.dni ?? null`.

### 5. Importación de datos (una sola vez)

Script Python (`docs/jugadores/import_players.py`, no forma parte de la app — herramienta de
un solo uso, se puede borrar tras usarla) que:

1. Lee ambos CSV (`;` delimitado, UTF-8 con BOM) y la tabla `app."Players"` (+ `app."TeamPlayers"`/
   `app."TeamPlayerFamilies"`/`app."TeamPlayerContactInfos"` para no pisar datos ya rellenos)
   vía `psycopg2`, leyendo la cadena de conexión de
   `~/AppData/Roaming/Microsoft/UserSecrets/3978d671-c78a-4fe6-8f87-efbc382c7568/secrets.json`
   (mismo secreto que usa la API en local — nunca hardcodeado en el script ni en el repo).
2. Normaliza nombre completo (mayúsculas, sin acentos, espacios colapsados) para cruzar
   `Apellidos, Nombre` del excel contra `LastName`/`Name` de `Players`, aplicando el mapa de
   correcciones manuales confirmado (`CASCALES SAMCHEZ`→`SANCHEZ`, `ERIK` sin apellidos→
   `FERNANDEZ GARCINUÑO, ERIK`) como diccionario explícito de overrides, no heurística difusa
   en producción.
3. Normaliza DNI (mayúsculas, sin espacios/guiones) y solo lo aplica si pasa
   `DniValidator`-equivalente en Python (mismo algoritmo que `DniValidator.cs`); si no es
   válido, lo deja fuera y lo reporta como advertencia (no bloquea el resto de campos de ese
   jugador). El DNI del tutor se normaliza igual pero se guarda sin validar checksum.
4. La columna "Edad" del excel es la fecha de nacimiento (`dd/mm/yyyy`) — se parsea y solo se
   escribe si `Players.BirthDate` está vacío en BD (no se pisa un dato ya presente).
5. Dirección/teléfono/email de contacto: solo se rellenan los campos que estén vacíos en
   `TeamPlayerContactInfos` (no se sobrescribe nada ya existente, por si el propio jugador ya
   lo editó desde la app).
6. Family: mapea `Tutor_1`→primer hueco de `FamilyMembers` del `TeamPlayer` (creando la fila
   si no existe, como ya soporta `TeamPlayer.SetFamily` con la rama de tamaño distinto),
   `Tutor_2`→segundo; ignora `Tutor_3`. Si ya hay 2 familiares guardados, no los toca (fuera
   de alcance ampliar a un tercero).
7. **Modo dry-run por defecto**: imprime/guarda un informe (`import_report.json`) por jugador
   con los campos que cambiarían (antes → después) y las advertencias (DNI inválido, sin
   match, etc.), sin ejecutar ningún `UPDATE`. Solo con el flag explícito `--apply` ejecuta los
   `UPDATE` dentro de una transacción por jugador (rollback si algo falla a mitad).
8. Tras `--apply`, borra el propio script y los CSV de `docs/jugadores/` (o los mueve fuera del
   repo) — no deben quedar en el repositorio datos de menores en claro.

## Tests (TDD)

**Backend**: tests unitarios de dominio (`Player_Update*_Should_*`, `Family` equality con
`Dni`) y de integración existentes (`UpdateTeamPlayerSelfEditTests`) ampliados para cubrir que
`Enfermedades`/`Alergias`/`Procedencia` se guardan para Coach y para Player/FamilyMember
vinculado, y que `Dni` del tutor se persiste vía `FamilyRequest`.

**Frontend**: `PlayerDetail.test.tsx` (Físico muestra/edita Enfermedades/Alergias; Contacto
muestra/edita Procedencia), `FamilyMembersEdit.test.tsx` (campo DNI), `usePlayerSave.test.ts`
(payload incluye los 4 campos nuevos).

**Importación**: no lleva tests automatizados (script de un solo uso) — la verificación es el
informe dry-run revisado manualmente antes de `--apply`, más una comprobación posterior vía
`GET /api/catalog/teamplayer/{id}` de 2-3 jugadores representativos.
