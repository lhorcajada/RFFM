## 1. Backend — autorización y filtrado de campos (≈2h)

- [x] 1.1 `Domain/ErrorCodes.cs`: añadir `TeamPlayerEditForbidden`.
- [x] 1.2 `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs`:
  - Ampliar `[Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]`.
  - Inyectar `ICurrentUserService` en el handler inline.
  - Si el rol no es Coach/Administrator: comprobar propiedad vía
    `UserTeam.LinkedTeamPlayerId` (patrón `ConfirmAttendance.cs`); `403` +
    `TeamPlayerEditForbidden` si no coincide.
  - Si coincide: anular `Dorsal`, `Demarcation` y todo `PlayerInfo` salvo `UrlPhoto`
    antes de aplicar el resto del handler (sin tocar la lógica existente de
    aplicación/mapeo de respuesta).
- [x] 1.3 Tests xUnit (`RFFM.Api.Tests`, TDD Red→Green→Refactor) — escribir primero:
  - Coach: sigue pudiendo modificar todos los campos (regresión).
  - Player/FamilyMember vinculado: guarda contacto/físico/familia/foto; dorsal,
    demarcación, nombre y alias enviados no se aplican.
  - Player/FamilyMember no vinculado (o vinculado a otro `TeamPlayer`): `403`
    `TeamPlayerEditForbidden`, sin persistir cambios.
- **Verificación**: `dotnet build` y `dotnet test --filter UpdateTeamPlayer` (o el
  nombre real de la clase de test) en verde.

## 2. Frontend — permisos de edición por pestaña (≈2h)

- [x] 2.1 `PlayerDetail.tsx`: separar `canEditFull`/`canEditRestricted`/`canEdit`;
  Demarcación usa `editing && canEditFull`; botón "Registrar lesión" usa
  `canEditFull` (no `canEdit`).
- [x] 2.2 Quitar el `useEffect` que fuerza `setEditingState(false)` para roles
  restringidos (o ajustarlo para que solo aplique cuando no hay ningún rol editor,
  ni completo ni restringido).
- [x] 2.3 Tests Vitest (TDD) — escribir primero: con rol `Player`, entrar en modo
  edición muestra formularios en Contacto/Físico/Familia pero no en Demarcación; no
  aparece "Registrar lesión"; con rol `Coach` el comportamiento actual no cambia
  (regresión).
- **Verificación**: `npm run test -- PlayerDetail` en verde.

## 3. Frontend — formulario de edición de Familia (≈2h)

- [x] 3.1 `usePlayerDetailData.ts`: incluir `familyMembers` en el `form` inicial,
  mapeando `FamilyMember` (texto) → id (`FAMILY_MEMBER_MAP`, patrón
  `DOMINANT_FOOT_MAP`).
- [x] 3.2 Nuevo `components/FamilyMembersEdit.tsx`: un bloque por familiar existente
  (TextField Nombre/Teléfono/Email + Select Parentesco con Madre/Padre), sin añadir
  ni eliminar filas, mismo estilo (`styles.card`/`sectionInner`) que Contacto/Físico.
- [x] 3.3 `PlayerDetail.tsx` tab Familia: `!editing ? <FamilyMembers/> : <FamilyMembersEdit/>`.
- [x] 3.4 `usePlayerSave.ts`: añadir `familyMembers` al payload de guardado (mapeado
  de vuelta a `FamilyMemberId`).
- [x] 3.5 Tests Vitest (TDD) — escribir primero: `FamilyMembersEdit` renderiza un
  campo por familiar existente, sin botones de añadir/eliminar, Select limitado a
  2 opciones; guardar incluye `familyMembers` en el payload enviado al servicio.
- **Verificación**: `npm run test -- FamilyMembersEdit` y `npm run test -- PlayerDetail`
  en verde; `npm run build` sin errores de tipos.

## 4. Frontend — manejo de errores del guardado (≈1-2h)

- [x] 4.1 `apps/coach/services/teamplayerService.ts` (`updateTeamPlayer`): dejar de
  tragar el error (`catch { return null }`) — re-lanzarlo para que la capa de arriba
  pueda mapearlo; pasar `{ suppressErrorRedirect: true }` como config de la llamada
  `client.put`.
- [x] 4.2 `core/api/client.ts`: en el interceptor de respuesta, comprobar
  `error?.config?.suppressErrorRedirect === true` antes de cada `gotoErrorPage(...)`
  (network, timeout, 500) y omitir la navegación si está presente.
- [x] 4.3 `usePlayerSave.ts`: sustituir el mensaje fijo de error por
  `mapApiErrorToMessage(e)` (`shared/utils/errorMessages.ts`).
- [x] 4.4 `shared/i18n/locales/es/errors.json` y `en/errors.json`: añadir entrada para
  `TeamPlayerEditForbidden`.
- [x] 4.5 Tests Vitest (TDD) — escribir primero: error de negocio (403 con `code`)
  muestra el mensaje traducido correspondiente; error 500 muestra el mensaje genérico
  de `errors:ServerError` sin invocar la navegación (`registerNavigate`/`navigateTo`
  mockeado, verificar que no se llama).
- **Verificación**: `npm run test -- usePlayerSave` (o el archivo de test relevante)
  y `npm run test -- client` en verde.

## 6. Amendment — dirección en Contacto (bug) + añadir familiares (≈2h)

- [x] 6.1 Backend `UpdateTeamPlayer.cs`: añadir `AddressRequest` y campo `Address` a
  `ContactRequest`; mapear a `ContactModel.Address` en el handler.
- [x] 6.2 Tests xUnit (TDD) — escribir primero: guardar `contactInfo.address` persiste
  `Street`/`City`/`PostalCode`/`Province`/`Country`; guardar contacto sin `address`
  (`null`) no borra una dirección ya guardada (regresión del bug encontrado).
- [x] 6.3 Frontend `usePlayerDetailData.ts`: incluir `street`, `city`, `postalCode`,
  `province`, `country` en el `form` inicial desde `tp.contactInfo?.address`.
- [x] 6.4 Frontend `PlayerDetail.tsx` (tab Contacto, edición): añadir `TextField` Calle,
  y fila Ciudad + Código Postal.
- [x] 6.5 Frontend `usePlayerSave.ts`: incluir `address` dentro de `contactInfo` en el
  payload de guardado.
- [x] 6.6 Frontend `teamplayerService.ts`: añadir `address` al tipo del payload de
  `updateTeamPlayer` (`ContactRequest`).
- [x] 6.7 Frontend `FamilyMembersEdit.tsx`: botón "Añadir familiar" visible cuando
  `members.length < 2`; añade una fila en blanco al form; sin botón de eliminar.
- [x] 6.8 Frontend `usePlayerSave.ts`: filtrar del payload `familyMembers` las filas
  totalmente vacías (sin nombre, teléfono, email ni parentesco) antes de guardar.
- [x] 6.9 Tests Vitest (TDD) — escribir primero: tab Contacto en edición muestra y
  guarda Calle/Ciudad/CP; `FamilyMembersEdit` con 0 familiares muestra el botón añadir
  y al pulsarlo aparece un formulario en blanco; con 2 familiares no se muestra el
  botón; guardar con la fila añadida rellena la incluye en el payload; guardar con la
  fila añadida vacía no la incluye.
- **Verificación**: `dotnet test` (backend) y `npm run test -- PlayerDetail` /
  `npm run test -- FamilyMembersEdit` / `npm run test -- usePlayerSave` (frontend) en
  verde; `dotnet build` y `npm run build` sin errores.

## 7. Verificación final

- [x] `dotnet build` + `dotnet test` (backend completo o al menos el proyecto de
  tests afectado) en verde. (628 passed / 2 fallos preexistentes no relacionados en
  `GameModelImport`/`GameModelSeeder`, confirmados fuera del alcance de este cambio.)
- [x] `npm run build` + `npm run test` (frontend completo) en verde. (470 passed / el
  único fallo es `e2e/scoped-membership.spec.ts`, un archivo Playwright recogido por
  error por Vitest, preexistente y no relacionado.)
- [x] Repasar checklist de `.claude/rules/git.md` §6.3 antes de proponer commit: no
  commitear/pushear sin build+tests en verde y confirmación explícita del usuario.
