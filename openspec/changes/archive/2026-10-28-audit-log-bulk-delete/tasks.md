## 1. Backend (~1,5h)

- [x] Red: validator de `DeleteAuditLogEntries` (vacío, >100, ids vacíos, repetidos).
- [x] Red: handler (Postgres): borra los pedidos, ignora inexistentes, no toca otros eventos.
- [x] Red: autorización: 401 anónimo, 403 Coach/ClubDirector, 200 Federation/Administrator.
- [x] Green: `Features/Audit/DeleteAuditLogEntries.cs` (design D1).
- [x] Subir la versión minor de la API en `Directory.Build.props`.
- **Verify**: `dotnet build` y `dotnet test`.

## 2. Servicio web (~0,5h)

- [x] Red → Green: `deleteAuditLogEntries` en `auditLogService.ts` (envía `data: { ids }`, devuelve `deleted`).

## 3. Vista (~2h)

- [x] Red (`AuditLogView` tests): sin permiso no hay checkboxes; con permiso sí.
- [x] Red: «Seleccionar página» marca todas y el contador; «Eliminar» deshabilitado con 0.
- [x] Red: cambiar de página o filtro vacía la selección.
- [x] Red: confirmar llama al servicio con los ids, avisa y recarga; cancelar no borra; error mantiene selección.
- [x] Green: `AuditLogView.tsx` + `.module.css` (design D3), `ConfirmDialog`, snackbar por el bus de eventos.
- [x] Subir la versión minor de la web en `Front/package.json`.
- **Verify**: `npm run test` y `npm run build`; comprobar a ~390 px que la barra inferior no tapa tarjetas.

## 4. Cierre

- [x] `openspec validate audit-log-bulk-delete --strict`.
- [x] Commits tras confirmación del usuario: `feat(mcp-api)` y `feat(front)` por separado.
