## Why

Un usuario con rol `Player` o `FamilyMember` no puede editar nada de la ficha de su
jugador vinculado (`PlayerDetail.tsx`, app Coach): `canEdit` solo es `true` para
`Coach`/`Administrator`. Además, la pestaña **Familia** no tiene formulario de edición
para nadie, ni siquiera para el Coach — solo hay vista de solo lectura
(`FamilyMembers.tsx`). El backend (`PUT /api/catalog/teamplayer/{id}`) ya persiste
`contactInfo`, `physicalInfo` y `familyMembers`, pero solo lo puede llamar
Coach/Administrator y no filtra qué campos puede tocar cada rol.

## What Changes

- **Backend**: permitir que `Player`/`FamilyMember` llamen a
  `PUT /api/catalog/teamplayer/{id}`, pero solo cuando el `TeamPlayer` objetivo está
  vinculado a su usuario (`UserTeam.LinkedTeamPlayerId`, patrón ya usado en
  `ConfirmAttendance.cs`). Si no está vinculado → `403` con código de error de negocio
  nuevo (`TeamPlayerEditForbidden`). Si está vinculado pero no es Coach/Administrator,
  el handler ignora silenciosamente los campos que no puede tocar (`Dorsal`,
  `Demarcation`, y de `PlayerInfo` todo salvo `UrlPhoto`) — solo se persisten
  `ContactInfo`, `PhysicalInfo`, `FamilyMembers` y la foto.
- **Frontend**: en `PlayerDetail.tsx`, separar `canEditFull` (Coach/Administrator, edita
  todo) de `canEditRestricted` (Player/FamilyMember, edita Contacto/Físico/Familia/foto).
  La pestaña Demarcación nunca muestra formulario para `canEditRestricted`, aunque el
  jugador esté en modo edición. La pestaña Familia gana un formulario de edición nuevo
  (editar familiares existentes: nombre, parentesco, teléfono, email — sin añadir ni
  eliminar filas), disponible también para Coach (hoy no existe para nadie). El botón
  "Registrar lesión" sigue restringido a `canEditFull` únicamente.
- **Manejo de errores**: reutilizar `mapApiErrorToMessage`/`getErrorMessage`
  (`shared/utils/errorMessages.ts`, ya i18n-aware) en el guardado de la ficha, en vez del
  mensaje genérico fijo actual. Añadir un flag de configuración Axios
  (`suppressErrorRedirect`) al cliente único (`core/api/client.ts`) para que, en esta
  llamada de guardado, un error 500/network/timeout muestre el mensaje genérico
  traducido en el propio formulario en vez de navegar a `/error-500` (comportamiento
  global hoy).

## Impact

- Backend: `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs`,
  `Domain/ErrorCodes.cs`.
- Frontend: `apps/coach/pages/player/PlayerDetail.tsx`,
  `apps/coach/pages/player/components/FamilyMembers.tsx` (nuevo hermano
  `FamilyMembersEdit.tsx`), `apps/coach/pages/player/hooks/usePlayerSave.ts`,
  `apps/coach/pages/player/hooks/usePlayerDetailData.ts`, `core/api/client.ts`,
  `shared/i18n/locales/{es,en}/errors.json`.
- No afecta a Mobile (fuera de alcance, no se menciona en la solicitud).

## Out of Scope

- Eliminar familiares ya guardados (solo añadir y editar).
- Cambiar el flujo de vinculación usuario↔jugador (ya existe, se reutiliza tal cual).
- Traducir los valores actuales de solo-lectura de Familia ("Mother"/"Father" sin
  traducir) — bug preexistente, no introducido por este cambio.

## Amendment (post-implementación, verificación manual con datos reales)

Al probar la implementación inicial con un jugador real aparecieron dos huecos:

- **Contacto**: el formulario de edición solo tenía Teléfono/Email — Calle, Ciudad y
  Código Postal (que sí se muestran en la vista de solo lectura, `ContactInfo.tsx`, y
  que el backend ya sabe persistir vía `ContactModel.Address`) no tenían campos de
  edición ni viajaban en el `UpdateRequest.ContactRequest`, que carecía de un
  sub-objeto `Address`. Efecto colateral no detectado por los tests: al guardar
  contacto se pasaba siempre `Address = null` a `SetContactInfo`, borrando cualquier
  dirección ya guardada.
- **Familia**: para un jugador sin familiares aún vinculados, el formulario de edición
  (pensado solo para editar existentes) no mostraba nada — no hay forma de dar de alta
  el primer familiar desde esta pantalla. Se amplía el alcance: permitir **añadir**
  familiares desde `FamilyMembersEdit.tsx` (máximo 2, uno por cada valor de
  `FamilyMember`: Madre/Padre — no hay más categorías en el dominio), manteniendo fuera
  de alcance la eliminación. El backend (`TeamPlayer.SetFamily`) ya soporta esta
  inserción sin cambios: la rama de reemplazo completo de la colección (cuando el
  tamaño cambia) ya crea instancias `Family` nuevas insertables gracias al
  `GuidStringValueGenerator` añadido para el caso de edición.
