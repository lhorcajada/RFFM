# Implement: audit-log-bulk-delete

Lee primero `proposal.md`, `design.md`, `specs/audit-log-bulk-delete/spec.md` y `tasks.md`. Diseño visual de referencia:
`.design/audit-log-multiselect/project/*.dc.html` (no commitear). Estricto TDD: Red (ver el test fallar) → Green → Refactor.
NO hagas `git commit/push`. Marca en `tasks.md` solo lo realmente hecho.

## 1. Backend (`Back/ExtractionApi`)

1. Tests primero, siguiendo los patrones de `tests/RFFM.Api.Tests/UnitTests/SearchAuditLogHandlerTests.cs` (Postgres container,
   `[Collection(PostgresCollection.Name)]`) y `IntegrationTests/SearchAuditLogEndpointTests.cs` (cabecera `X-Test-Role`):
   - `DeleteAuditLogEntriesValidatorTests`: lista vacía, >100, id vacío, ids repetidos → inválido; 1 id válido.
   - `DeleteAuditLogEntriesHandlerTests`: borra solo los ids pedidos, ignora inexistentes, devuelve `Deleted`.
   - `DeleteAuditLogEntriesEndpointTests`: 403 Coach y ClubDirector, 200 Federation y Administrator, 400 lista inválida,
     y que los eventos ya no salen en `GET /api/audit-log`.
2. Crear `src/RFFM.Api/Features/Audit/DeleteAuditLogEntries.cs` (un solo archivo, como `SearchAuditLog.cs`):
   `IFeatureModule` con `MapDelete("/api/audit-log")`, `RequireAuthorization(Roles = "Federation,Administrator")`,
   request `{ Ids }`, `ICommand<Response>`, validator FluentValidation (comando con validador obligatorio), handler con
   `ExecuteDeleteAsync`. Mira cómo otros features devuelven `ProblemDetails` en validación y copia ese patrón.
   Comprueba si `ICommand` dispara invalidación de caché y sigue el patrón vigente.
3. Subir `<Version>` minor en `Back/ExtractionApi/Directory.Build.props` (1.33.0 → 1.34.0).
4. Verificar: `dotnet build` y `dotnet test` (filtra a los tests nuevos y a SearchAuditLog; luego la suite).

## 2. Front (`Front`)

1. Tests primero:
   - `src/shared/services/__tests__/auditLogService.test.ts`: `deleteAuditLogEntries` hace `client.delete('/api/audit-log', { data: { ids } })` y devuelve `deleted`.
   - `src/shared/components/ui/AuditLogView/__tests__/` (nuevo archivo, p. ej. `AuditLogView.bulkDelete.test.tsx`; mira los
     existentes de esa carpeta para mocks y `MemoryRouter`): los escenarios de `spec.md` (sin permiso sin checkboxes; seleccionar
     página y contador; «Eliminar» deshabilitado con 0; cambiar página/filtro vacía selección; confirmar → servicio +
     snackbar `rffm.show_snackbar` + recarga; cancelar; error mantiene selección). Queries por rol/label, nombres de test en español.
2. Implementación:
   - `auditLogService.ts`: `deleteAuditLogEntries(ids: string[]): Promise<number>` con el `client` existente (sin `any`).
   - `AuditLogView.tsx` + `.module.css`: estado `selectedIds`, `confirmOpen`, `deleting`; `canDelete` por roles Federation/Administrator
     desde `UserContext` (mira cómo `AppHeader`/`Footer` leen roles y reutiliza ese mecanismo); checkbox por tarjeta (`label` ≥44 px),
     «Seleccionar página», contador, «Cancelar selección», «Eliminar (N)»; `ConfirmDialog` de `shared/components/ui/ConfirmDialog/ConfirmDialog.tsx`;
     tarjeta seleccionada con clase CSS Module; barra inferior sticky bajo 600 px. Usa variables CSS del tema (`--rffm-*`); sin
     colores nuevos hardcodeados, sin `style={{}}`, sin tablas, sin `confirm()`.
   - Si al borrar la página queda vacía y `pageNumber > 1`, retroceder una página.
3. Subir versión minor en `Front/package.json` (`npm version 1.85.0 --no-git-tag-version`).
4. Verificar en `Front/`: `npm run test -- AuditLogView auditLogService` y luego `npm run test` y `npm run build`.

## Informe final
Lista de archivos tocados, resultado de cada comando de verificación, tareas no hechas y cualquier desviación del diseño.
