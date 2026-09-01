## Why

`player-family-members-crud` (archivado 2026-08-31) añadió `POST`/`DELETE`
individuales para familiares/contactos de un `TeamPlayer`, pero dejó
explícitamente fuera de alcance la edición individual (Open Question del
propio cambio): "¿Se necesita también un `PUT .../family-members/{id}`... o
el `PUT` masivo de `UpdateTeamPlayer` es suficiente?". En la práctica no es
suficiente: desde que el frontend dejó de enviar `familyMembers` en el `PUT`
masivo (para no pisar altas/bajas hechas por los nuevos endpoints), no queda
ningún camino para corregir un dato mal introducido (teléfono, email, DNI,
nombre, parentesco) en un familiar ya guardado. Hoy en
`coach/player/{id}` el coach solo puede eliminar y volver a crear el
familiar completo para corregir un error tipográfico, perdiendo el `Id`
original sin necesidad.

## What Changes

- **Backend**: nuevo endpoint `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`,
  mismo patrón CQRS (`ICommand`/`Handler`/`Validator`) que
  `CreateFamilyMember.cs`, reutilizando el método `UpdateDetails` ya existente
  en `TeamPlayerFamilyMember` (hoy solo invocado por `TeamPlayer.SetFamily`).
  Misma validación que la creación (nombre/apellidos/parentesco obligatorios,
  formato de email/teléfono).
- **Frontend**: `FamilyMembersEdit.tsx` gana un botón "Editar" por tarjeta de
  familiar ya guardado, que abre el mismo formulario inline usado para "Añadir"
  (reutilizado, no duplicado) precargado con los datos actuales; al guardar
  llama al nuevo endpoint `PUT` y actualiza la lista local con la respuesta.

## Capabilities

### New Capabilities
- `player-family-member-update`: edición individual de un familiar/contacto ya
  persistido de un `TeamPlayer`, sin reenviar el array completo.

### Modified Capabilities
(ninguna spec existente en `openspec/specs/` cubre familiares hoy — no aplica)

## Impact

- **Back**: nuevo `Features/Coaches/Players/Commands/UpdateFamilyMember.cs`;
  `Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs` (`UpdateDetails` pasa
  de `internal` a uso desde el nuevo Handler, mismo assembly, sin cambio de
  firma); sin migración EF (no hay cambio de esquema).
- **Front**: `apps/coach/pages/player/components/FamilyMembersEdit.tsx`,
  `apps/coach/services/teamplayerService.ts` (nuevo método
  `updateFamilyMember`).
