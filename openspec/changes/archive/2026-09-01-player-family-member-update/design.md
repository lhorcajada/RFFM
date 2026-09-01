## Context

- `TeamPlayerFamilyMember.UpdateDetails(...)` (`Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs:56`)
  ya existe y hace exactamente lo que necesitamos (actualiza `Name`, `LastName`,
  `Phone`, `Email`, `Dni`, `FamilyMember`, `Address` in-place), pero es `internal`
  y hoy solo lo llama `TeamPlayer.SetFamily` (el `PUT` masivo). No hace falta
  tocar el dominio ni el esquema — solo un nuevo Handler que lo invoque para un
  único familiar identificado por Id.
- El sibling exacto a seguir es `CreateFamilyMember.cs`: mismo namespace
  (`Features/Coaches/Players/Commands`), mismo `[Authorize(Roles = "Coach,Administrator")]`,
  mismo `Validator : AbstractValidator<T>` con las mismas reglas de
  nombre/apellidos/relación/email/teléfono.
- `DeleteFamilyMember.cs` es el sibling para el patrón de "buscar por
  `Id` + `TeamPlayerId` y devolver 404 si no existe o pertenece a otro
  `TeamPlayer`" — se reutiliza igual aquí antes de aplicar `UpdateDetails`.

## Goals / Non-Goals

**Goals:**
- `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}` permite
  corregir los datos de un familiar ya persistido sin perder su `Id` ni afectar
  a los demás familiares del jugador.
- Misma validación de entrada que `POST` (consistencia).
- 404 si el `TeamPlayer` o el familiar no existen, o si el familiar pertenece a
  otro `TeamPlayer` (igual que `DeleteFamilyMember`).

**Non-Goals:**
- No se toca `Address` desde el frontend (sigue sin exponerse en el
  formulario); el Handler preserva el `Address` ya existente del familiar en
  vez de dejarlo `null` sin querer.
- No se cambia el `PUT` masivo `UpdateTeamPlayer`/`SetFamily`.
- No se añade migración EF (sin cambios de esquema).

## Decisions

### 1. Nuevo archivo `Features/Coaches/Players/Commands/UpdateFamilyMember.cs`

Vertical slice = 1 feature = 1 archivo, igual que `CreateFamilyMember.cs`.

```csharp
public record UpdateFamilyMemberRequest(
    string? Name,
    string? LastName,
    int FamilyMemberId,
    string? Phone,
    string? Email,
    string? Dni);

public record UpdateFamilyMemberCommand(string TeamPlayerId, string FamilyMemberId, UpdateFamilyMemberRequest Request)
    : ICommand<CreateFamilyMember.FamilyMemberResponse>;
```

Reutiliza `CreateFamilyMember.FamilyMemberResponse` como tipo de respuesta
(mismo shape exacto: `Id, Name, LastName, Phone, Email, FamilyMember, Dni`) en
vez de duplicar el record — evita otro tipo idéntico solo por estar en otro
archivo.

### 2. Validator idéntico al de `CreateFamilyMember`

Mismas reglas (`Name`/`LastName` obligatorios y ≤100, `FamilyMemberId` debe
resolver con `FamilyMemberVO.FromId`, `Email` formato válido si se informa,
`Phone` con el mismo patrón, `Dni` ≤20). Se duplica el validator (no se
extrae una clase base compartida) porque `CreateFamilyMemberCommand` y
`UpdateFamilyMemberCommand` son tipos distintos y las reglas de
FluentValidation no se comparten entre `AbstractValidator<T>` de tipos
distintos sin una indirección que no aporta valor para 6 reglas.

### 3. Handler

```csharp
public async ValueTask<CreateFamilyMember.FamilyMemberResponse> Handle(
    UpdateFamilyMemberCommand command, CancellationToken cancellationToken = default)
{
    var familyMember = await _db.TeamPlayerFamilyMembers
        .FirstOrDefaultAsync(f => f.Id == command.FamilyMemberId && f.TeamPlayerId == command.TeamPlayerId, cancellationToken);

    if (familyMember is null)
        throw new NotFoundException($"FamilyMember '{command.FamilyMemberId}' Not Found", ErrorCodes.FamilyMemberNotFound);

    var relation = FamilyMemberVO.FromId(command.Request.FamilyMemberId);

    familyMember.UpdateDetails(
        command.Request.Name,
        command.Request.LastName,
        command.Request.Phone,
        command.Request.Email,
        command.Request.Dni,
        relation?.Name,
        familyMember.Address); // preserva Address existente, no editable desde este endpoint

    await _db.SaveChangesAsync(cancellationToken);

    return CreateFamilyMember.ToResponse(familyMember);
}
```

`UpdateDetails` pasa de `internal` a **sin cambio de modificador** — sigue
siendo `internal`, el nuevo Handler vive en el mismo assembly
(`RFFM.Api`) que `TeamPlayer.SetFamily`, así que no hace falta tocar su
visibilidad. `CreateFamilyMember.ToResponse` pasa de `internal static` (ya lo
es) a reutilizarse tal cual desde el nuevo archivo, mismo assembly.

### 4. Ruta REST

```
PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}
```

Mismo recurso que `DELETE`, verbo `PUT` para reemplazo completo del
sub-recurso individual (no `PATCH`: todos los campos editables del formulario
se envían siempre, igual que `POST`) — coherente con la sección 7.2/12 de
`.claude/rules/dotnet.md` y `architecture.md` (PUT = reemplazo del recurso).

## Frontend (Front/, app Coach)

**Alcance**: `apps/coach/pages/player/components/FamilyMembersEdit.tsx` y
`apps/coach/services/teamplayerService.ts`.

### Decisiones

1. **`teamplayerService.ts`**: nuevo `updateFamilyMember(teamPlayerId, familyMemberId, payload): Promise<FamilyResponse>`
   (`PUT`, mismo `CreateFamilyMemberPayload` reutilizado como tipo de payload —
   shape idéntico), siguiendo el patrón de `createFamilyMember`/`updatePlayerInjury`
   ya existentes en el mismo archivo.
2. **`FamilyMembersEdit.tsx`**: el estado `adding`/`draft` se generaliza a
   `editingId: string | null` (`null` = modo "añadir", string = modo "editar
   este Id") en vez de duplicar todo el formulario. El botón "Editar" (icono,
   junto al de "Eliminar" ya existente, `aria-label="Editar familiar {nombre}"`)
   precarga `draft` con los valores actuales del familiar (mapeando
   `member.familyMember` string → `familyMemberId` numérico vía
   `FAMILY_MEMBER_OPTIONS`) y abre el mismo formulario inline. Al guardar:
   si `editingId` es `null` → `createFamilyMember` (comportamiento actual sin
   cambios); si no → `updateFamilyMember(teamPlayerId, editingId, payload)` y
   reemplaza el elemento correspondiente en `familyMembers` vía
   `onFamilyMembersChange` con la respuesta del backend.
3. El formulario de edición reemplaza la tarjeta del familiar que se está
   editando (no se abre uno nuevo aparte), igual patrón visual que "Añadir".
   Mientras se edita un familiar, el botón "Añadir familiar" sigue disponible
   (no son modos mutuamente excluyentes a nivel de UI, pero solo puede haber un
   formulario de edición abierto a la vez — abrir "Editar" en otra tarjeta
   cierra el anterior, mismo criterio que ya aplica `closeAddForm`).
4. Errores de guardado (`saveError`) se muestran igual en ambos modos
   (`mapApiErrorToMessage`), sin cerrar el formulario para no perder lo
   escrito — mismo comportamiento que "Añadir" ya tiene.
