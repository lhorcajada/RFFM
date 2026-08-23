## Architecture Decisions

### 0. Lo que ya existe y no hay que tocar

- `UserTeam.LinkedTeamPlayerId` ya identifica qué `TeamPlayer` tiene vinculado un
  usuario `Player`/`FamilyMember` (`RoleId` 4/5, ver `Membership.cs`). Reutilizar tal
  cual — mismo patrón que `Features/Mobile/Attendance/Commands/ConfirmAttendance.cs`
  (líneas 71-85: `ICurrentUserService currentUser`, comprobación
  `db.Set<UserTeam>().AnyAsync(ut => ut.ApplicationUserId == currentUser.UserId && ut.LinkedTeamPlayerId == teamPlayerId)`).
- `PUT /api/catalog/teamplayer/{id}` ya acepta y persiste `ContactInfo`,
  `PhysicalInfo`, `FamilyMembers` y `PlayerInfo.UrlPhoto` — no hay que tocar el shape
  del `UpdateRequest` ni el mapeo a `TeamPlayerResponse`.
- `shared/utils/errorMessages.ts` (`mapApiErrorToMessage`, `getErrorMessage`) ya
  traduce códigos de error de negocio vía i18next (`errors:<code>`) — es el mecanismo
  "forma de tratar los errores" del resto de formularios. Reutilizar, no reinventar.
- `FamilyMember` (backend) solo tiene 2 valores fijos: `Mother` (1) / `Father` (2) —
  mismo patrón que `DominantFoot` (Select con 3 valores fijos) ya usado en el tab
  Físico de `PlayerDetail.tsx`.

### 1. Backend — `UpdateTeamPlayer.cs`

Autorizar el rol y añadir comprobación de propiedad + filtrado de campos dentro del
mismo handler inline (sigue sin ser CQRS, por la razón ya documentada en el comentario
de cabecera del archivo — no se convierte a `ICommand` en este cambio):

```csharp
[Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]
async (string id, UpdateRequest req, AppDbContext db, ICurrentUserService currentUser, CancellationToken cancellationToken) =>
{
    var isPrivileged = currentUser.Roles.Any(r =>
        string.Equals(r, "Coach", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(r, "Administrator", StringComparison.OrdinalIgnoreCase));

    if (!isPrivileged)
    {
        var isOwnPlayer = await db.Set<UserTeam>().AsNoTracking().AnyAsync(ut =>
            ut.ApplicationUserId == currentUser.UserId && ut.LinkedTeamPlayerId == id,
            cancellationToken);

        if (!isOwnPlayer)
            return Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "No autorizado",
                detail: "No tienes permiso para editar esta ficha de jugador.",
                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.TeamPlayerEditForbidden });

        // Ignora en silencio los campos que Player/FamilyMember no pueden tocar.
        req = req with
        {
            Dorsal = null,
            Demarcation = null,
            PlayerInfo = req.PlayerInfo is null
                ? null
                : new PlayerInfoRequest(null, null, null, req.PlayerInfo.UrlPhoto),
        };
    }

    // ... resto del handler sin cambios (Include, SetDorsal si Dorsal.HasValue, etc.) ...
}
```

Notas:
- `ICurrentUserService` ya se inyecta igual en `ConfirmAttendance.Handler` — confirmar
  namespace exacto (`RFFM.Api.Domain.Services`) y que está registrado en DI para
  handlers de Minimal API inline (no solo Mediator handlers); si el binding automático
  de parámetros de Minimal API no lo resuelve, inyectar `HttpContext` y leer
  `currentUser` a través del servicio manualmente (`app.Services`/`context.RequestServices`).
- `using RFFM.Api.Domain.Aggregates.UserClubs;` para `UserTeam`.
- Nuevo código en `Domain/ErrorCodes.cs`: `public const string TeamPlayerEditForbidden = "TeamPlayerEditForbidden";`.
- Como `req.PlayerInfo.Name`/`LastName` ya se comprueban con `!string.IsNullOrEmpty`
  antes de aplicar, poner esos campos a `null` es suficiente para que el resto del
  handler los ignore sin tocar más código downstream.

### 2. Frontend — `PlayerDetail.tsx`

```tsx
const canEditFull = roles.includes("Coach") || roles.includes("Administrator");
const canEditRestricted = roles.includes("Player") || roles.includes("FamilyMember");
const canEdit = canEditFull || canEditRestricted;
```

- Tab 0 (Demarcación): `<Demarcations editing={editing && canEditFull} .../>` — nunca
  editable para `canEditRestricted`, aunque `editing === true`.
- Tab 1 (Contacto) y Tab 2 (Físico): sin cambio de condición (`!editing ? Read : Edit`),
  ya que ambos roles pueden editarlos.
- Tab 3 (Familia): pasa de `<FamilyMembers teamPlayer={teamPlayer} />` fijo a
  `!editing ? <FamilyMembers teamPlayer={teamPlayer} /> : <FamilyMembersEdit form={form} setForm={setForm} />`.
- Tab "Lesiones" (activeTab 5): el botón "Registrar lesión" cambia su condición de
  `canEdit` a `canEditFull` — evita que `canEditRestricted` (que ahora también hace
  `canEdit === true`) vea ese botón de acción de Coach.
- `PlayerHeader` (foto): no necesita cambios de props — ya solo depende de `editing`
  para mostrar el control de subida; al permitir `editing=true` para
  `canEditRestricted`, la foto queda editable automáticamente.

### 3. Nuevo componente `FamilyMembersEdit.tsx`

Mismo patrón visual que los bloques inline de Contacto/Físico
(`styles.card` + `styles.sectionInner`), iterando `form.familyMembers` (array que hay
que añadir al estado `form` — hoy `usePlayerDetailData` no lo incluye, solo
`teamPlayer.familyMembers` se lee para mostrar). Un `TextField` por
Nombre/Teléfono/Email y un `Select` para Parentesco con las 2 opciones fijas (Madre=1,
Padre=2 — mismo patrón que `DOMINANT_FOOT_MAP`/`DOMINANT_FOOT_ID_TO_NAME` en
`PlayerDetail.tsx`). Sin botones de añadir/eliminar fila (fuera de alcance). Si no hay
familiares, mostrar el mismo bloque de "-" que ya usa la vista de solo lectura (no se
puede crear el primero desde aquí, coherente con "solo editar existentes").

`usePlayerDetailData` (o el propio `usePlayerSave`): incluir `familyMembers` en el
`form` inicial a partir de `teamPlayer.familyMembers`, y en `usePlayerSave.handleSave`
añadir `familyMembers: form.familyMembers` al payload (mapeando `familyMember` → id vía
`FAMILY_MEMBER_MAP` nuevo, mismo patrón que `DOMINANT_FOOT_MAP`).

### 4. Manejo de errores en el guardado

`usePlayerSave.ts`:
```ts
} catch (e) {
  notify(mapApiErrorToMessage(e), "error");
}
```
(sustituye el `catch { notify("Error al guardar. Inténtelo de nuevo.", "error"); }`
actual). `teamplayerService.updateTeamPlayer` deja de tragarse el error silenciosamente
con `return null` en el `catch` — debe re-lanzarlo (`throw e`) para que
`usePlayerSave` pueda mapearlo, o alternativamente devolver el error junto al dato
(decisión del implementador: re-lanzar es más simple y ya es el patrón que espera
`mapApiErrorToMessage`, pensado para recibir el `AxiosError` completo).

`core/api/client.ts`: añadir soporte para un flag por-request que impida la navegación
global a `/error-500`:
```ts
// en la función del interceptor, antes de cada gotoErrorPage(...):
const suppressRedirect = (error?.config as any)?.suppressErrorRedirect === true;
if (!suppressRedirect) gotoErrorPage(reason);
```
Aplicar la comprobación en las tres ramas que hoy llaman `gotoErrorPage` (timeout,
network, 500). `updateTeamPlayer` pasa `{ suppressErrorRedirect: true }` como config de
axios en su llamada `client.put(url, payload, { suppressErrorRedirect: true })`.

`Domain/ErrorCodes.cs` nuevo código `TeamPlayerEditForbidden` necesita entrada en
`shared/i18n/locales/es/errors.json` y `en/errors.json` para que
`getErrorMessage` lo traduzca (si no hay traducción, cae al `detail` del backend, que
ya es un mensaje legible en español — añadir igualmente la entrada explícita para
seguir la convención i18n del resto de códigos).

## Files

**Backend** (modificados):
- `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs`
- `Domain/ErrorCodes.cs`

**Frontend** (nuevos):
- `apps/coach/pages/player/components/FamilyMembersEdit.tsx`

**Frontend** (modificados):
- `apps/coach/pages/player/PlayerDetail.tsx`
- `apps/coach/pages/player/hooks/usePlayerSave.ts`
- `apps/coach/pages/player/hooks/usePlayerDetailData.ts`
- `apps/coach/services/teamplayerService.ts`
- `core/api/client.ts`
- `shared/i18n/locales/es/errors.json`, `shared/i18n/locales/en/errors.json`

## Tests (TDD — Red → Green → Refactor)

**Backend** (xUnit, `RFFM.Api.Tests`, mismo estilo que `InjuryEndpointAuthorizationTests.cs`/`RatingEndpointAuthorizationTests.cs`):
- Coach/Administrator: guarda dorsal, demarcación, contacto, físico y familia sin
  restricciones (regresión del comportamiento actual).
- Player/FamilyMember vinculado a ese `TeamPlayer`: guarda contacto/físico/familia/foto;
  dorsal/demarcación/nombre/alias enviados en el payload se ignoran (la respuesta y el
  estado en BD no cambian esos campos).
- Player/FamilyMember **no** vinculado a ese `TeamPlayer` (o vinculado a otro distinto):
  `403` con `code = TeamPlayerEditForbidden`, no se persiste ningún cambio.
- Rol sin ninguno de los 4 roles: `401`/`403` por `[Authorize]` (ya cubierto hoy, solo
  verificar que sigue igual).

**Frontend** (Vitest + Testing Library, co-ubicados en `apps/coach/pages/player/__tests__/`):
- `PlayerDetail.test.tsx` (o archivo existente si ya hay uno): con rol `Player`, al
  entrar en modo edición, Demarcación no muestra controles de edición pero Contacto,
  Físico y Familia sí; el botón "Registrar lesión" no aparece.
- `FamilyMembersEdit.test.tsx`: renderiza un campo por familiar existente y no ofrece
  botón de añadir/eliminar; el Select de parentesco solo ofrece Madre/Padre.
- `usePlayerSave`/servicio: error de negocio (403 con `code`) muestra el mensaje
  traducido de `errors:TeamPlayerEditForbidden`; error 500 muestra el mensaje genérico
  de `errors:ServerError` y **no** navega (mock de `registerNavigate`/`navigateTo` no
  se invoca).

Coverage objetivo: backend handlers ≥80% (CLAUDE.md), frontend ≥75%.

## Amendment — Address en Contacto + añadir familiares

### A. Backend — `ContactRequest` gana `Address`

`UpdateTeamPlayer.cs`:
```csharp
public record AddressRequest(string? Street, string? City, string? Province, string? PostalCode, string? Country);
public record ContactRequest(string? Phone, string? Email, AddressRequest? Address);
```
En el handler, al construir el `ContactModel`:
```csharp
if (req.ContactInfo != null)
{
    item.SetContactInfo(new ContactModel
    {
        Phone = req.ContactInfo.Phone,
        Email = req.ContactInfo.Email,
        Address = req.ContactInfo.Address is null ? null : new AddressModel
        {
            Street = req.ContactInfo.Address.Street ?? string.Empty,
            City = req.ContactInfo.Address.City ?? string.Empty,
            Province = req.ContactInfo.Address.Province ?? string.Empty,
            PostalCode = req.ContactInfo.Address.PostalCode ?? string.Empty,
            Country = req.ContactInfo.Address.Country ?? string.Empty,
        },
    });
}
```
`ContactModel`/`SetContactInfo`/`Address` (Domain) ya soportan esto sin cambios — el
único hueco era el DTO del endpoint, que no tenía `Address` y por tanto siempre mandaba
`null`, borrando la dirección existente en cada guardado de contacto.

### B. Frontend — campos de dirección en el tab Contacto

`usePlayerDetailData.ts`: añadir al `form` inicial `street`, `city`, `postalCode`,
`province`, `country` desde `tp.contactInfo?.address`. Se cargan los 5 aunque la UI solo
exponga 3 campos, para no perder `province`/`country` al reenviar el payload (si ya
tenían valor, se reenvían tal cual).

`PlayerDetail.tsx` (tab Contacto, bloque de edición): añadir `TextField` para Calle,
y una fila con Ciudad + Código Postal (mismo patrón visual que Altura/Peso en el tab
Físico — dos campos en línea vía `styles.row2` o similar ya existente).

`usePlayerSave.ts`: el payload de `contactInfo` pasa a incluir
```ts
address: {
  street: form.street ?? null,
  city: form.city ?? null,
  postalCode: form.postalCode ?? null,
  province: form.province ?? null,
  country: form.country ?? null,
},
```

`teamplayerService.ts`: `AddressResponse`/`ContactInfoResponse`/`ContactRequest` del
`updateTeamPlayer` payload type ganan el sub-objeto `address`.

### C. Frontend — añadir familiares en `FamilyMembersEdit.tsx`

- Botón "Añadir familiar" visible solo si `members.length < 2` (dominio: como mucho un
  valor `Mother` y un valor `Father`, igual que el `Select` de Parentesco solo ofrece
  esas 2 opciones).
- `onClick`: `setForm({ ...form, familyMembers: [...members, { name: "", phone: "", email: "", familyMemberId: null, familyMember: null }] })`.
- Sin botón de eliminar (sigue fuera de alcance quitar familiares ya guardados).
- Si `members.length === 0`, ya no se muestra el bloque "-" de la vista de lectura — se
  muestra directamente el botón "Añadir familiar" dentro de `styles.card`.

`usePlayerSave.ts`: antes de incluir `familyMembers` en el payload, filtrar las filas
totalmente vacías (sin `name`, `phone`, `email` ni `familyMemberId`) que el usuario haya
añadido y no haya rellenado, para no crear familiares fantasma:
```ts
familyMembers: (form.familyMembers ?? [])
  .filter((f: any) => f.name || f.phone || f.email || f.familyMemberId)
  .map((f: any) => ({ name: f.name ?? null, phone: f.phone ?? null, email: f.email ?? null, familyMemberId: f.familyMemberId ?? null })),
```

Backend: sin cambios — `TeamPlayer.SetFamily` ya soporta pasar de N a N+1 elementos (la
rama `canUpdateInPlace == false` crea instancias `Family` nuevas, insertables gracias al
`GuidStringValueGenerator` ya añadido para el caso de edición in-place).

### Files (amendment)

**Backend** (modificado): `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs`
(nuevo `AddressRequest`, `ContactRequest.Address`, mapeo en el handler).

**Frontend** (modificados): `PlayerDetail.tsx`, `hooks/usePlayerDetailData.ts`,
`hooks/usePlayerSave.ts`, `components/FamilyMembersEdit.tsx`,
`services/teamplayerService.ts`.

### Tests (amendment, TDD)

**Backend**: guardar `contactInfo.address` como Coach y como Player vinculado persiste
`Street`/`City`/`PostalCode`/`Province`/`Country`; guardar contacto sin `address` en el
payload no borra la dirección previamente guardada (regresión del bug encontrado).

**Frontend**: tab Contacto en edición muestra Calle, Ciudad y Código Postal y los
guarda en el payload; `FamilyMembersEdit` con 0 familiares muestra el botón "Añadir
familiar" y al pulsarlo aparece un formulario en blanco; con 2 familiares no se muestra
el botón; guardar con una fila añadida y rellenada incluye ese familiar en el payload;
guardar con una fila añadida y vacía no la incluye en el payload.
