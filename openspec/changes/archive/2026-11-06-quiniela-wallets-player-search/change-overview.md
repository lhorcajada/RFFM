## Proposal

### Why

En la lista "Monederos del equipo", una fila de familiar muestra solo un nombre y un saldo. El entrenador no puede saber a qué jugador pertenece el familiar, ni encontrar los familiares de un jugador concreto.

### What Changes

- Cada fila de la lista de monederos lleva los jugadores del equipo a los que está vinculada ("jugadores asociados"):
  - una fila de familiar lista todos los jugadores del equipo a los que está vinculado el familiar;
  - una fila de jugador muestra el nombre propio del jugador;
  - una fila de entrenador no tiene jugadores asociados.
- La lista de monederos incorpora un cuadro de búsqueda. Filtra en el navegador la lista ya cargada por nombre de jugador o de familiar, ignorando mayúsculas, acentos y espacios sobrantes.
  - Buscar el nombre de un jugador devuelve la fila propia del jugador (cuando el jugador tiene usuario en el equipo) y las filas de todos sus familiares.
  - Buscar el nombre de un familiar devuelve esa fila, mostrando todos sus jugadores.
  - Buscar sin coincidencias muestra un mensaje de "sin resultados", distinto del mensaje de equipo vacío.
- El endpoint de monederos añade los jugadores asociados a cada fila de su respuesta existente. Su ruta y sus parámetros no cambian, y no se añade ningún endpoint nuevo.
- Sin cambios en la base de datos ni migraciones. Mobile queda fuera de alcance.

## Design

### Target State

El cambio converge en una fila de respuesta extendida y en una página de lista filtrada.

El endpoint `GET /api/teams/{teamId}/quiniela/wallets` devuelve filas con un campo nuevo, `associatedPlayers`; la ruta y los parámetros no cambian:

```json
[
  {
    "userId": "6f1c...",
    "userName": "Marta Perez",
    "role": "FamilyPlayer",
    "balance": 12.50,
    "associatedPlayers": [
      { "id": "a1b2...", "name": "Jose Perez" },
      { "id": "c3d4...", "name": "Lucia Perez" }
    ]
  },
  { "userId": "...", "userName": "Jose Perez", "role": "Player", "balance": 0.00,
    "associatedPlayers": [ { "id": "a1b2...", "name": "Jose Perez" } ] },
  { "userId": "...", "userName": "Ana Coach", "role": "Coach", "balance": 3.00,
    "associatedPlayers": [] }
]
```

En la web, la página de lista de monederos del entrenador muestra un cuadro de búsqueda encima de la lista de tarjetas. Cada tarjeta conserva su nombre, su rol y su saldo y, cuando la fila tiene jugadores asociados, un área de jugadores que lista todos los nombres. Escribir filtra en el navegador las filas ya cargadas.

### Goals / Non-Goals

Goals:

- Devolver los jugadores asociados de cada fila en la respuesta existente de monederos, sin endpoint nuevo y sin cambios en la base de datos.
- Mostrarlos en cada tarjeta y permitir al entrenador buscar en la lista cargada por nombre de jugador o de familiar, ignorando mayúsculas, acentos y espacios.
- Mantener el diseño de tarjetas responsive (sin tabla), legible a 360 px.

Non-Goals:

- Fuera de alcance: mostrar jugadores asociados o búsqueda en la app Mobile. Revisar cuando Mobile tenga una lista de monederos del equipo (no existe ningún consumidor Mobile de este endpoint).
- Fuera de alcance: búsqueda o paginación en el servidor de la lista de monederos. Revisar cuando el número de participantes de un equipo haga lenta la carga de la lista completa.
- Fuera de alcance: un componente de búsqueda compartido para la app de entrenador. Revisar cuando una segunda página del entrenador necesite el mismo cuadro.
- Sin cambios en otros endpoints de quiniela, en `WalletCard.tsx` ni en el esquema de la base de datos.

### Decisions

#### Decision 1: Associated players come from a different link per role

- Fila de jugador: el registro de jugador de `UserTeam.LinkedTeamPlayerId`, conservado solo cuando ese jugador de equipo pertenece al equipo consultado; sin vínculo, la lista está vacía.
- Fila de FamilyPlayer: todos los jugadores del equipo consultado alcanzables mediante `TeamPlayerFamilyMember.LinkedUserId == userId`, ignorando `UserTeam.LinkedTeamPlayerId` de ese usuario.
- Fila de Coach: siempre vacía, decidido por el rol de la fila, incluso si ese usuario también es familiar de un jugador.

La regla se aplica por rol de cada fila, nunca por usuario, de modo que un usuario que aparece como Coach y como familiar en el mismo equipo obtiene una lista vacía en la fila de Coach.

**Record family**: ddr
**Provenance**: user

Alternativas consideradas: (a) usar también `UserTeam.LinkedTeamPlayerId` para los familiares, descartada porque guarda un único jugador y la especificación exige todos los jugadores vinculados; (b) unir ambos vínculos para las filas de familiar, descartada porque, en la práctica, la aprobación de una cuenta de familiar fija ambos vínculos al mismo jugador, así que la unión no añade ningún jugador y oculta un vínculo incorrecto. La tabla de familiares es la que puede guardar varios jugadores, así que es la fuente de verdad para las filas de familiar.

#### Decision 2: Two extra batched queries in the handler, no per-row queries

El handler mantiene su consulta de participantes y añade exactamente dos lecturas, ambas acotadas al equipo consultado y a los ids de usuario de los participantes: una sobre `TeamPlayerFamilyMember` unida a `TeamPlayer` y `Player` para las filas FamilyPlayer, y otra sobre `TeamPlayers` unida a `Player` para los valores de `LinkedTeamPlayerId` de las filas Player. Ambas usan `AsNoTracking()`. Los resultados se agrupan en memoria por id de usuario y se asocian al construir los DTO.

**Provenance**: derived

#### Decision 3: Player display name is `Name` + `LastName` trimmed, computed in memory

La consulta proyecta `Name` y `LastName`; el nombre se construye en memoria como `$"{Name} {LastName}".Trim()`, igual que en `GetTeamUsers.cs`. No se usa `Alias`. Los jugadores asociados de una fila se ordenan por nombre y, después, por id, para que la respuesta sea determinista.

**Provenance**: derived

#### Decision 4: `AssociatedPlayers` is a new record list on the existing DTO

`QuinielaWalletSummaryDto` gana `IReadOnlyList<QuinielaAssociatedPlayerDto> AssociatedPlayers`, y junto a él se añade `QuinielaAssociatedPlayerDto(Guid Id, string Name)`. `Id` es el id de `TeamPlayer`, el registro acotado al equipo al que apuntan ambos vínculos. La lista nunca es null: las filas sin jugadores llevan una lista vacía. Los campos existentes conservan sus nombres y su orden, así que los clientes actuales siguen funcionando.

**Provenance**: derived

#### Decision 5: Search is a pure client-side filter in its own module

`walletSearch.ts` exporta `normalizeSearchText` (minúsculas, descomposición Unicode NFD con eliminación de las marcas combinantes, secuencias de espacios reducidas a un solo espacio y sin espacios al inicio ni al final) y `filterWallets(wallets, query)`. Una fila coincide cuando la consulta normalizada es subcadena del nombre de usuario normalizado o del nombre normalizado de cualquiera de sus jugadores asociados. Una consulta en blanco devuelve la lista sin cambios. Las filas se devuelven en el orden original, una vez cada una y con todos sus jugadores asociados intactos, porque el filtro selecciona filas y nunca las edita.

La página guarda la consulta en estado local y deriva las filas visibles con `useMemo`; escribir no lanza ninguna petición. El helper vive junto a la página en lugar de en `shared/` porque solo lo usa la página de monederos del entrenador, y el helper de federación es local y no se exporta.

**Provenance**: derived

#### Decision 6: Page states and copy

El cuadro de búsqueda es un `TextField` de MUI con una etiqueta accesible ("Buscar por jugador o familiar") que se muestra encima de la lista una vez cargados los datos. Los estados vacíos son independientes:

- no hay participantes cargados: "No hay participantes en el equipo" (sin cambios), independientemente del texto de búsqueda;
- hay participantes, pero ninguno coincide: "No se encontraron resultados".

Cada tarjeta muestra un área de jugadores (una lista corta y etiquetada de nombres, que se ajusta dentro de la tarjeta) solo cuando la fila tiene jugadores asociados. Los estilos van en el `QuinielaWallets.module.css` existente, usando tokens del tema y las clases responsive de tarjeta ya existentes; sin tabla y sin estilos inline.

**Provenance**: derived

#### Decision 7: Test fixtures and seeds are extended, not replaced

Backend: `QuinielaTestSupport` gana la siembra de jugadores de equipo con sus jugadores, de vínculos de familiar (y de `LinkPlayer` para los usuarios Player), de modo que los tests del handler puedan expresar los escenarios de la especificación. Frontend: los fixtures de lista de `QuinielaWallets.test.tsx` ganan `associatedPlayers`. El campo nuevo es obligatorio en el tipo del front porque el endpoint siempre lo devuelve.

**Provenance**: derived

### Risks / Trade-offs

- [Un familiar con vínculos a jugadores de otros equipos filtra esos nombres] → Mitigación: ambas lecturas filtran por `TeamPlayer.TeamId == teamId`; un test dedicado del handler cubre un familiar vinculado a un jugador de otro equipo.
- [Un usuario tiene varias filas `UserTeam` en el equipo (por ejemplo, Coach y FamilyPlayer)] → Mitigación: los jugadores asociados se deciden por el rol propio de la fila (Decisión 1), y un test cubre una fila de Coach de un usuario que también es familiar.
- [Un campo `associatedPlayers` obligatorio rompe los fixtures tipados del front y cualquier consumidor construido antes de que existiera el campo] → Mitigación: el tipo del front y los fixtures se actualizan en el mismo cambio; no se encontró ningún consumidor Mobile del endpoint, y los campos existentes no se tocan.
- [La coincidencia por subcadena puede encontrar filas no relacionadas con textos cortos] → Mitigación: compromiso aceptado de un filtro simple en el navegador; la lista completa es pequeña (un equipo) y la especificación pide coincidencia por nombre, no ranking.
- [La capitalización de las propiedades JSON del campo nuevo depende del serializador de la API] → Mitigación: los campos existentes ya llegan en camelCase al tipo del front, y el test del endpoint verifica el nombre del campo nuevo en la carga bruta.

### Open Questions

Ninguna. La nota de la propuesta sobre el vínculo entre el usuario de un jugador y su registro de jugador queda resuelta por `UserTeam.LinkedTeamPlayerId` (Decisión 1), confirmado en `UserTeam.cs` (`LinkPlayer`, roles Player y FamilyPlayer únicamente).

### Manual Verification

- Prueba de humo de extremo a extremo entre API y navegador: arrancar la API y la web, abrir "Monederos del equipo" como entrenador de un equipo que tenga un familiar vinculado a dos jugadores, y confirmar que la tarjeta del familiar lista ambos jugadores y que escribir el nombre de un jugador (con otra capitalización y sin acento) muestra la tarjeta de ese familiar y la tarjeta propia del jugador.
- Pantalla estrecha: abrir la misma página a 360 px y confirmar que la tarjeta con varios jugadores ajusta sus nombres sin desplazamiento horizontal. Esta comprobación visual no está cubierta por un test automatizado.

## Step 1: Return associated players from the wallets endpoint

### Interfaces

- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs`
  - `public record QuinielaAssociatedPlayerDto(Guid Id, string Name);` donde `Id` es el id de `TeamPlayer` y `Name` son `Name` y `LastName` del jugador unidos por un espacio y sin espacios sobrantes.
  - `QuinielaWalletSummaryDto` conserva sus cuatro miembros existentes, en el mismo orden, y gana un último miembro `IReadOnlyList<QuinielaAssociatedPlayerDto> AssociatedPlayers`; nunca es null.
- `GetQuinielaWallets.Handler` mantiene sin cambios su ruta, `Query(TeamId)` y el tipo de resultado `IReadOnlyList<QuinielaWalletSummaryDto>`.
- Soporte de tests en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaTestSupport.cs` (los nombres son un contrato para los nuevos tests del handler):
  - `Task<Guid> SeedTeamPlayerAsync(AppDbContext db, QuinielaSeed seed, string name, string lastName)` devuelve el id del nuevo `TeamPlayer` del equipo sembrado.
  - `Task LinkFamilyAsync(AppDbContext db, Guid familyUserId, Guid teamPlayerId)` crea un `TeamPlayerFamilyMember` vinculado a ese usuario.
  - `Task LinkPlayerUserAsync(AppDbContext db, QuinielaSeed seed, Guid playerUserId, Guid teamPlayerId)` llama a `UserTeam.LinkPlayer` sobre la fila de equipo del usuario.

**Test assertions** (todas ancladas a `openspec/changes/quiniela-wallets-player-search/specs/quiniela-wallet/spec.md`, requisito "The coach lists the wallets of the team"):

- Escenario "Family member linked to several players": un usuario FamilyPlayer vinculado a los jugadores "Ana Lopez" y "Beto Lopez" del equipo da exactamente una fila para ese usuario, cuyos nombres en `AssociatedPlayers` son `["Ana Lopez", "Beto Lopez"]` en ese orden.
- Escenario "Family member linked to players of other teams": un FamilyPlayer vinculado a "Ana Lopez" del equipo consultado y a "Cleo Ruiz" de otro equipo da `AssociatedPlayers` con el único nombre `"Ana Lopez"`.
- Escenario "Family member without linked players": un FamilyPlayer sin vínculo de familiar da una fila con `AssociatedPlayers.Count == 0`.
- Escenario "Family member without wallet": un FamilyPlayer con vínculo y sin monedero da `Balance == 0.00m` y un jugador asociado.
- Escenario "Player row": un usuario Player vinculado con `LinkPlayer` a "Ana Lopez" del equipo da `AssociatedPlayers` con exactamente una entrada llamada `"Ana Lopez"`, cuyo `Id` es el id de ese jugador de equipo.
- Escenario "Player user without a linked player record": un usuario Player sin vínculo da `AssociatedPlayers.Count == 0`.
- Escenario "Coach row": un Coach que además está vinculado como familiar de un jugador da, en su fila de Coach, `AssociatedPlayers.Count == 0`.
- Un jugador cuyo `LastName` está vacío da `Name == "<Name>"`, sin espacio final.
- Escenario "List": el número de filas y cada `Balance` son iguales que antes del cambio para la misma siembra.
- Contrato del endpoint: el JSON de una respuesta autorizada de `GET /api/teams/{teamId}/quiniela/wallets` contiene la propiedad `associatedPlayers` en cada fila, como array.

### Tasks

**Files Affected**:

```text
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaTestSupport.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaWalletHandlerTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/QuinielaEndpointTests.cs
- M Back/ExtractionApi/Directory.Build.props — minor version bump (`feat`)
```

## Step 2: Front types and the pure search filter

### Interfaces

- `Front/src/apps/coach/services/quinielaService.ts`
  - `export type QuinielaAssociatedPlayer = { id: string; name: string };`
  - `QuinielaWalletSummary` conserva sus cuatro campos y gana el campo obligatorio `associatedPlayers: QuinielaAssociatedPlayer[]`.
- `Front/src/apps/coach/pages/quiniela/walletSearch.ts`
  - `export function normalizeSearchText(text: string): string` — pasa a minúsculas, elimina las marcas de acento combinantes tras la descomposición NFD, reduce cada secuencia de espacios en blanco a un único espacio y recorta los extremos.
  - `export function filterWallets(wallets: QuinielaWalletSummary[], query: string): QuinielaWalletSummary[]` — devuelve el contenido del array de entrada sin cambios para una consulta normalizada en blanco; en otro caso, solo las filas cuyo `userName` normalizado, o cuyo `name` normalizado de cualquier jugador asociado, contiene la consulta normalizada, en el orden original, una vez cada una y con su `associatedPlayers` intacto.

**Test assertions** (ancladas a `openspec/changes/quiniela-wallets-player-search/specs/quiniela-wallet/spec.md`, requisito "The coach searches the wallets list by player or family member name"):

- `normalizeSearchText("  jOSE   perez ")` → `"jose perez"`; `normalizeSearchText("José Pérez")` → `"jose perez"` (escenario "Case, accents and spaces are ignored").
- `normalizeSearchText("   ")` → `""`.
- Filas: usuario jugador "José Pérez" (jugadores `[José Pérez]`), familiar "Marta" (jugadores `[José Pérez, Lucía Pérez]`), familiar "Pedro" (jugadores `[José Pérez]`), familiar "Rosa" (jugadores `[Otro Niño]`). `filterWallets(rows, "  jOSE   perez ")` → las filas José Pérez, Marta y Pedro, en ese orden, y no Rosa (escenario "Search by player name").
- Una fila de familiar sin usuario jugador: `filterWallets(rows, "lucia")` → solo Marta, y los `associatedPlayers` de Marta siguen listando a los dos jugadores (escenarios "Search by player name when the player has no user" y "Search by family member name").
- `filterWallets(rows, "marta")` → la fila de Marta con `associatedPlayers` de longitud 2 (escenario "Search by family member name").
- Texto que coincide con el jugador A y con un familiar del jugador B: devuelve cada fila coincidente una sola vez, en el orden original, incluso si una fila coincide por nombre de usuario y por nombre de jugador (escenario "Text matching a player and a family member of another player").
- `filterWallets(rows, "")` y `filterWallets(rows, "   ")` → todas las filas, en el orden original (escenario "Empty search box").
- `filterWallets(rows, "zzz")` → `[]` (escenario "No matches").
- `filterWallets` no muta ni su array de entrada ni sus filas.

### Tasks

**Files Affected**:

```text
- M Front/src/apps/coach/services/quinielaService.ts
- A Front/src/apps/coach/pages/quiniela/walletSearch.ts
- A Front/src/apps/coach/pages/quiniela/__tests__/walletSearch.test.ts
- M Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx — fixtures gain the new required field
```

## Step 3: Search box and players area on the wallets list page

### Interfaces

- `Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx` (export por defecto sin cambios): muestra, una vez cargados los datos, un campo de texto con el nombre accesible `Buscar por jugador o familiar` encima de la lista de tarjetas; guarda el texto de búsqueda en estado local; las filas visibles son `filterWallets(wallets, searchText)`.
- Área de jugadores en cada tarjeta, mostrada solo cuando `associatedPlayers.length > 0`, que lista todos los nombres de jugador dentro de la tarjeta.
- Mensajes: `No hay participantes en el equipo` cuando la lista cargada está vacía (sin cambios, se muestra con o sin texto de búsqueda); `No se encontraron resultados` cuando la lista cargada no está vacía y el filtro no devuelve filas.

**Test assertions** (ancladas a `openspec/changes/quiniela-wallets-player-search/specs/quiniela-wallet/spec.md`, requisitos "The wallets list shows the associated players of each row" y "The coach searches the wallets list by player or family member name"):

- Tarjeta de familiar con jugadores `[Ana Lopez]` → el texto `Ana Lopez` aparece dentro de esa tarjeta (escenario "Family member with one player").
- Tarjeta de familiar con tres jugadores → los tres nombres aparecen dentro de la misma tarjeta única, y el nombre del familiar aparece una sola vez en toda la lista (escenario "Family member with several players").
- Fila de jugador con su propio jugador → la tarjeta muestra el nombre propio del jugador como jugador asociado (escenario "Player row").
- Tarjeta de Coach y tarjeta de familiar con `associatedPlayers` vacío → ningún área de jugadores dentro de esas tarjetas, mientras se muestran nombre, rol y saldo (escenarios "Coach row" y "Family member without players").
- Escribir `jOSE   perez` en el campo de texto llamado `Buscar por jugador o familiar` deja solo las tarjetas vinculadas a "José Pérez" (escenarios "Search by player name" y "Case, accents and spaces are ignored").
- Tras escribir el nombre de un familiar, su tarjeta sigue mostrando todos sus jugadores (escenario "Search by family member name").
- Vaciar el campo de texto, o escribir solo espacios, muestra todas las tarjetas (escenario "Empty search box").
- Escribir un texto que no coincide con nada, con participantes cargados, muestra `No se encontraron resultados` y no muestra `No hay participantes en el equipo` (escenario "No matches").
- Con un equipo cuya lista cargada está vacía, `No hay participantes en el equipo` se muestra tanto antes como después de escribir texto, y `No se encontraron resultados` nunca se muestra (escenario "Team without participants").
- Escribir y cambiar el texto no aumenta el número de llamadas al `getQuinielaWallets` simulado más allá de la inicial (escenario "Typing does not call the API").

### Tasks

**Files Affected**:

```text
- M Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx
- M Front/src/apps/coach/pages/quiniela/QuinielaWallets.module.css
- M Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx
- M Front/package.json — minor version bump (`feat`)
```
