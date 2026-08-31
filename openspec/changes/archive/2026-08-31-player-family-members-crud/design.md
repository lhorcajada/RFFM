## Context

- `TeamPlayer.FamilyMembers` es hoy `List<Family>`, una colección **owned** de EF
  Core (`builder.OwnsMany(tp => tp.FamilyMembers, ...)`,
  `TeamPlayersEntityConfiguration.cs`), con una clave `"Id"` **shadow** (string,
  generada por `GuidStringValueGenerator`) que nunca se expone en C# ni en el DTO
  `FamilyResponse` (`GetTeamPlayer.cs`, `UpdateTeamPlayer.cs`). La única forma de
  escribir es `TeamPlayer.SetFamily(List<FamilyModel>?)`
  (`Domain/Entities/TeamPlayers/TeamPlayer.cs:149`), invocada únicamente desde
  `PUT /api/catalog/teamplayer/{id}` con el array completo. Cuando el array entrante
  tiene el mismo tamaño que el actual, actualiza in-place (preserva identidad EF);
  si el tamaño difiere, **descarta todas las instancias y crea otras nuevas**
  (`canUpdateInPlace` en `SetFamily`), lo que en la práctica ya permite añadir/quitar
  filas a nivel de datos, pero de forma opaca y sin que el cliente pueda dirigirse a
  una fila concreta (no hay un id que referenciar).
- El catálogo de relación `Domain/ValueObjects/FamilyMember.cs` es un smart-enum-like
  con solo `Mother`/`Father` (ids 1/2), reflejado 1:1 en el frontend
  (`FAMILY_MEMBER_ID_TO_NAME`, `MAX_FAMILY_MEMBERS = 2` en
  `apps/coach/pages/player/components/FamilyMembersEdit.tsx`).
- El sibling más cercano para "sub-recurso hijo de TeamPlayer con Create/Update/Delete
  individuales" es `SetPlayerSanction.cs` / `SetPlayerInjury.cs`: ambos usan **entidad
  propia con `Id` real** (`TeamPlayerSanction : BaseEntity`, `TeamPlayerInjury`), un
  `DbSet<T>` dedicado en `AppDbContext`, y su propio
  `IEntityTypeConfiguration<T>` en `Infrastructure/Persistence/Configuration/Entities/`.
  Ambos usan **handlers Minimal API inline** (no Mediator `ICommand`) con el
  razonamiento documentado en su cabecera: "inline Minimal API handlers... so
  FluentValidation / FeaturePermissionBehavior don't apply here either", protegidos
  con `[Authorize(Roles = "Coach,Administrator")]` en vez de
  `IRequireFeaturePermission`.

## Goals / Non-Goals

**Goals:**
- Cada familiar tiene un `Id` estable y persistido, expuesto en toda respuesta que
  lo incluya (creación, `GetTeamPlayer`, `UpdateTeamPlayer`).
- `POST`/`DELETE` dedicados para alta/baja individual, siguiendo REST estricto
  (recurso plural anidado bajo el `TeamPlayer` dueño).
- Sin límite de número de familiares por jugador.
- El catálogo de relación cubre roles no parentales (tutor legal, otro contacto).
- Validación de entrada real (FluentValidation) para nombre/apellidos/relación
  obligatorios y formato de email/teléfono — mejora sobre el `PUT` actual, que no
  valida nada de `FamilyRequest`.

**Non-Goals:**
- No se toca el flujo de auto-alta de familiar por email en registro
  (`TeamPlayer.AddFamilyMemberEmailIfMissing`, usado por `CreateUser.cs`) — sigue
  creando un `Family`/`TeamPlayerFamilyMember` con solo `Email` informado.
- No se añade un endpoint `PUT` de edición individual en este cambio (el `PUT`
  masivo de `UpdateTeamPlayer` sigue existiendo para editar campos de familiares ya
  creados; ver Open Questions). Solo se piden Create y Delete.
- No se retira/cambia el comportamiento de `SetFamily` para el `PUT` existente más
  allá de lo estrictamente necesario para que ambos caminos (`PUT` masivo y
  `POST`/`DELETE` nuevos) sigan siendo consistentes contra la misma tabla.
- No se implementa el frontend en este documento (front-specialist, coordinar
  contrato — ver Impact del proposal).

## Decisions

### 1. Promover `Family` (owned value object) a entidad `TeamPlayerFamilyMember : BaseEntity`

**Por qué**: sin un `Id` real accesible en C#/DTOs es imposible construir
`DELETE .../family-members/{familyMemberId}` de forma limpia — la shadow key de EF
no es legible desde el dominio ni serializable en una respuesta sin trucos
(`EF.Property<string>(f, "Id")`). Mirroring `TeamPlayerSanction`/`TeamPlayerInjury`
(mismo patrón exacto: entidad con Id, FK `TeamPlayerId`, DbSet dedicado) es más
consistente con el resto del código de "sub-recursos hijos de TeamPlayer" que forzar
el owned-collection a exponer su shadow key.

**Alternativa descartada**: exponer la shadow key vía `EF.Property<string>` en el
mapeo a `FamilyResponse` sin tocar el modelo de datos. Se descarta porque el `Id`
seguiría sin ser accesible desde `SetFamily`/domain methods para compartriments
futuros, y porque cualquier operación de borrado tendría que hacerse manipulando la
colección `OwnsMany` completa (cargar, `RemoveAt`, reasignar) en vez de un
`DbSet<T>.Remove` directo — más frágil y no es el patrón ya establecido en el
proyecto para este caso exacto.

**Detalle de la migración de datos**: la tabla física `TeamPlayerFamilies` ya tiene
una columna `Id` (PK, generada por `GuidStringValueGenerator`). Promoverla a
propiedad real de la entidad (`public string Id { get; private set; }` heredado de
`BaseEntity`, que ya inicializa `Id = Guid.NewGuid().ToString()`) no requiere mover
datos: la migración de EF generada será un no-op de esquema (mismo nombre/tipo de
columna) o, como mucho, quitará el `ValueGenerator` custom porque `BaseEntity` ya
asigna el `Id` en el constructor. **Añade** una columna nueva `LastName` (nullable,
`varchar(100)`) para cubrir "apellidos" (hoy `Family.Name` es un único campo).

### 2. Command+Handler+Validator con Mediator, no handlers inline

**Por qué**: el usuario pidió explícitamente `Command`/`Handler`/`Validator` (CQRS
estricto, `ICommand`) para este cambio, que es también la convención **por
defecto** del proyecto (`copilot-instructions.md`: "un validator es requerido para
todo `ICommand`"). `SetPlayerSanction.cs`/`SetPlayerInjury.cs` divergen de esa
convención deliberadamente (comentario explícito: minimal-API inline porque no hay
tiempo/necesidad de CQRS para esos sub-recursos), pero aquí sí queremos validación
real de nombre/apellidos/relación/email/teléfono — FluentValidation es exactamente
la herramienta pensada para eso, y forzarla dentro de un handler inline con
`Results.ValidationProblem` a mano (como hace `SetPlayerSanction` para su único
campo `category`) sería más código y menos consistente que un `Validator<T>` real.
Se documenta esta divergencia respecto a los siblings más cercanos para que quede
claro que es intencional, no un descuido.

**Autorización**: en lugar de `IRequireFeaturePermission` (que exige refactor a
Mediator del árbol de features de `Squad`/`Players`, no solo de este comando), se
usa `[Authorize(Roles = "Coach,Administrator")]` a nivel de endpoint — mismo patrón
que `SetPlayerSanction`/`SetPlayerInjury`/las escrituras de `UpdateTeamPlayer`
cuando el actor es `Coach`/`Administrator`. Esta feature es de uso exclusivo del
coach (el enunciado no pide autoedición de `Player`/`FamilyMember`), así que no
hace falta la lógica de "propiedad del propio `TeamPlayer`" que sí tiene
`UpdateTeamPlayer` para esos roles.

### 3. Dos archivos nuevos, uno por comando (vertical slice = 1 feature = 1 .cs)

- `Features/Coaches/Players/Commands/CreateFamilyMember.cs`: `IFeatureModule` con
  `CreateFamilyMemberCommand : ICommand<FamilyMemberResponse>`, `Handler`,
  `Validator : AbstractValidator<CreateFamilyMemberCommand>`.
- `Features/Coaches/Players/Commands/DeleteFamilyMember.cs`: `IFeatureModule` con
  `DeleteFamilyMemberCommand : ICommand`, `Handler`. Sin validator (solo dos ids de
  ruta, sin cuerpo) — coherente con `DeletePlayer.cs`/`DeletePlayerPhoto.cs`, que
  tampoco llevan validator.

### 4. Rutas REST

```
POST   /api/catalog/teamplayer/{id}/family-members
DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}
```

Se mantiene el prefijo `/api/catalog/teamplayer/{id}/...` (no
`/api/players/{playerId}/...`) porque `{id}` en todos los sub-recursos hermanos
(`/ratings`, `/injuries`, `/sanctions`) es el `TeamPlayer.Id`, no el `Player.Id` —
usar un prefijo distinto para family-members rompería la consistencia de rutas del
propio agregado y confundiría cuál id espera cada endpoint. `family-members` en
plural y kebab-case, sin verbos, igual que `sanctions`/`injuries`.

### 5. Shape de request/response

```csharp
// CreateFamilyMember.cs
public record CreateFamilyMemberRequest(
    string Name,
    string LastName,
    int FamilyMemberId,   // relación: Mother=1, Father=2, LegalGuardian=3, Other=4
    string? Phone,
    string? Email,
    string? Dni);

public record CreateFamilyMemberCommand(string TeamPlayerId, CreateFamilyMemberRequest Request)
    : ICommand<FamilyMemberResponse>;

public record FamilyMemberResponse(
    string Id, string? Name, string? LastName, string? Phone, string? Email,
    string? FamilyMember, string? Dni = null);
```

`GetTeamPlayer.FamilyResponse` y `UpdateTeamPlayer.FamilyResponse` ganan el mismo
campo `Id` (y `LastName`) al inicio del record — cambio aditivo, no rompe clientes
existentes que ignoren campos desconocidos.

### 6. Validación (`CreateFamilyMemberCommand.Validator`)

```csharp
RuleFor(x => x.Request.Name).NotEmpty().MaximumLength(100);
RuleFor(x => x.Request.LastName).NotEmpty().MaximumLength(100);
RuleFor(x => x.Request.FamilyMemberId)
    .Must(id => FamilyMember.FromId(id) != null)
    .WithMessage("Parentesco desconocido.");
RuleFor(x => x.Request.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Request.Email));
RuleFor(x => x.Request.Phone)
    .Matches(@"^[+]?[0-9\s-]{6,15}$")
    .When(x => !string.IsNullOrWhiteSpace(x.Request.Phone));
RuleFor(x => x.Request.Dni).MaximumLength(20);
```

Mensajes desde `ValidationMessages.resx` (patrón existente), no strings literales en
el validator.

### 7. Catálogo de relación ampliado

`Domain/ValueObjects/FamilyMember.cs` añade `LegalGuardian = new(3, "LegalGuardian")`
y `Other = new(4, "Other")` a `List()`. El frontend mapea estos ids a "Tutor legal"/
"Otro" (mismo patrón que `FAMILY_MEMBER_LABEL`), fuera del alcance de este agente.

## Risks / Trade-offs

- **[Riesgo] Migración de esquema en tabla con datos existentes** (`Family`/
  `Address` owned) → Mitigación: la migración solo promueve una shadow key ya
  existente a propiedad real y añade una columna nullable (`LastName`); no hay
  reordenación ni pérdida de filas. Probar la migración contra una copia de la BD
  de Development antes de aplicarla a Production, y verificar con
  `dotnet ef migrations script` que no incluye ningún `DROP`/`TRUNCATE` inesperado.
- **[Riesgo] Doble camino de escritura** (`PUT` masivo `SetFamily` + nuevos
  `POST`/`DELETE`) puede desincronizarse si `SetFamily` sigue construyendo
  `Family`/`TeamPlayerFamilyMember` sin `LastName` → Mitigación: actualizar
  `FamilyModel`/`SetFamily`/`UpdateTeamPlayer.FamilyRequest` para incluir
  `LastName` en el mismo cambio, y añadir un test de regresión que verifique que
  editar por `PUT` no deja el campo en `null` sobre un registro creado por `POST`.
- **[Riesgo] Autorización solo por rol** (`Coach,Administrator`), sin comprobar que
  el `TeamPlayer` pertenece a un equipo del coach autenticado → Mitigación:
  consistente con el resto de sub-recursos hermanos (`SetPlayerSanction`,
  `SetPlayerInjury`, `UpdateTeamPlayer` para coach) que tampoco comprueban
  pertenencia al equipo — no se introduce un hueco de seguridad nuevo, solo se
  mantiene el nivel de autorización ya aceptado en el resto del feature.

## Migration Plan

1. Migración EF Core (`dotnet ef migrations add PromoteFamilyToEntityAndAddLastName`,
   proyecto `RFFM.Api`, aplicando `.\manage-migrations.ps1`).
2. Deploy backend con los dos nuevos endpoints + campo `Id`/`LastName` aditivo en
   `GetTeamPlayer`/`UpdateTeamPlayer` (no rompe frontend actual, que ignora campos
   desconocidos).
3. Coordinar con front-specialist el consumo de `POST`/`DELETE` y la eliminación de
   `MAX_FAMILY_MEMBERS`.
4. Rollback: revertir el deploy del backend es seguro mientras no se haya
   ejecutado la migración en Production; si ya se ejecutó, la migración `Down()`
   debe poder revertir la columna añadida sin pérdida de los `Id` (ya existían como
   shadow key antes del cambio).

## Frontend (Front/, app Coach)

**Alcance**: consumir los dos endpoints nuevos (`POST`/`DELETE family-members`) desde
`apps/coach/pages/player/components/FamilyMembersEdit.tsx`, quitar
`MAX_FAMILY_MEMBERS`, y dejar de enviar `familyMembers` en el `PUT` masivo de
`UpdateTeamPlayer` (`usePlayerSave.ts`) — imprescindible porque `SetFamily`
**reemplaza el array completo** sin `Id`, así que si el `PUT` masivo se sigue
disparando con `familyMembers` poblado desde `form`, borraría/recrearía (sin
`Id`s estables) cualquier familiar dado de alta por el nuevo `POST`, rompiendo la
UX de borrado individual la próxima vez que el coach pulse "Guardar" en otra
pestaña.

### Decisiones

1. **Los familiares dejan de vivir en `form`/`setForm`** (el objeto que sí viaja en
   el `PUT` masivo). Pasan a vivir directamente en `teamPlayer.familyMembers`
   (estado ya existente en `usePlayerDetailData`, actualizado localmente tras cada
   `POST`/`DELETE` exitoso) — igual que `injuryInfo`, que ya se actualiza así tras
   `createPlayerInjury` en `PlayerDetail.tsx`. `FamilyMembersEdit` pasa a recibir
   `teamPlayerId: string`, `familyMembers: FamilyResponse[]`,
   `onFamilyMembersChange: (next: FamilyResponse[]) => void` en vez de `form`/`setForm`.
2. **Alta**: botón "Añadir familiar" (sin límite) abre un formulario inline en la
   propia tarjeta (mismo patrón visual que el formulario de edición ya existente:
   `memberFormGrid` en `PlayerDetail.module.css`) con Nombre, Apellidos, Parentesco
   (Madre/Padre/Tutor legal/Otro), Teléfono, Email, DNI — todos opcionales salvo
   Nombre/Apellidos/Parentesco (obligatorios, validados en cliente antes de llamar
   al backend, alineado con el `Validator` de `CreateFamilyMemberCommand`: nombre y
   apellidos no vacíos, relación obligatoria, email con formato válido si se
   informa). Al confirmar, llama a `createFamilyMember(teamPlayerId, payload)`; si
   tiene éxito, añade el `FamilyMemberResponse` devuelto (con su `Id` real) a la
   lista local vía `onFamilyMembersChange` y cierra el formulario; si falla, muestra
   el error (vía `mapApiErrorToMessage`) sin cerrar el formulario, para que el coach
   no pierda lo escrito.
3. **Baja**: cada tarjeta de familiar existente (con `Id`, ya guardado) gana un
   botón "Eliminar" (icono, `aria-label="Eliminar familiar"`) que abre
   `ConfirmDialog` (`shared/components/ui/ConfirmDialog`, mismo componente que usa
   `PlayerLinkCode.tsx` para regenerar el código). Al confirmar, llama a
   `deleteFamilyMember(teamPlayerId, familyMember.id)`; si tiene éxito, quita el
   elemento de la lista local vía `onFamilyMembersChange`; si falla, mantiene la
   tarjeta y muestra el error.
4. **Sin edición inline de familiares ya guardados** en este cambio (coherente con
   el Non-Goal del backend: no hay `PUT` individual). Un familiar ya persistido solo
   se puede eliminar y volver a crear, no editar campo a campo.
5. **`teamplayerService.ts`**: nuevos `createFamilyMember(teamPlayerId, payload):
   Promise<FamilyResponse>` (`POST`, lanza en error — el componente decide cómo
   mostrarlo) y `deleteFamilyMember(teamPlayerId, familyMemberId): Promise<void>`
   (`DELETE`, lanza en error), siguiendo el patrón de `createPlayerInjury`/
   `deletePlayerInjury` ya existentes en el mismo archivo. `FamilyResponse` (tipo ya
   existente, renombrado desde el uso disperso de `any[]`) gana `id: string` y
   `lastName?: string | null`.
6. **`usePlayerSave.ts`**: se elimina por completo la construcción del campo
   `familyMembers` en el payload del `PUT` (el backend trata su ausencia/`null`
   igual que antes trataba un array vacío: no toca la colección — `if
   (req.FamilyMembers != null)`).
7. **CSS**: se reutiliza `PlayerDetail.module.css` (patrón ya establecido por
   `FamilyMembers.tsx`/`FamilyMembersEdit.tsx`, que no tienen su propio `.module.css`
   co-ubicado) añadiendo únicamente las clases necesarias para el botón de borrar
   por tarjeta y el formulario de alta colapsable — no se introduce un módulo CSS
   nuevo para mantener consistencia con el resto de la página.

## Open Questions

- ¿Se necesita también un `PUT` individual (`PUT .../family-members/{id}`) para
  editar un familiar existente sin reenviar el array completo, o el `PUT` masivo de
  `UpdateTeamPlayer` es suficiente para ese caso? El enunciado solo pide Create y
  Delete — se deja fuera de alcance, pero queda como candidato a un change
  posterior si el frontend lo necesita.
- ¿El límite de 100 caracteres en `Name`/`LastName` y el patrón de teléfono deben
  alinearse con las reglas ya usadas en `ContactRequest`/`PlayerContactInfo`
  (`HasMaxLength(15)` en `TeamPlayerContactInfos.Phone`)? Se ha asumido el mismo
  máximo de 15 para `Phone` en `TeamPlayerFamilyMember` por consistencia con
  `TeamPlayerContactInfos`.
