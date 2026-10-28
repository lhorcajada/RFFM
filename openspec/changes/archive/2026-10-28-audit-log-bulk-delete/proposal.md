## Why

El registro de auditoría (`AuditLogView`, usado en `coach/audit-log` y en Federación) es de solo lectura y crece sin
límite. Hay que poder **seleccionar varios eventos y eliminarlos de una vez** (diseño en
`.design/audit-log-multiselect/`). Al ser evidencia, solo lo hacen Federación y Administrador.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nuevo `DELETE /api/audit-log` con cuerpo `{ ids: string[] }` (1–100 ids, sin vacíos ni repetidos).
  - Solo roles `Federation` y `Administrator` (`403` para el resto).
  - Borrado físico de `UserActivityLogs`; ids inexistentes se ignoran. Responde `200` con `{ deleted: n }`.
  - Sin migración. **Versión**: API minor.
- **Frontend (`Front`)**:
  - `auditLogService.deleteAuditLogEntries(ids)`.
  - `AuditLogView`: checkbox por tarjeta, «Seleccionar página», contador, «Cancelar selección» y «Eliminar (N)»,
    visibles solo para Federación/Administrador.
  - Confirmación con `ConfirmDialog`; aviso con `rffm.show_snackbar`; recarga la lista tras borrar.
  - La selección se vacía al cambiar de página o de filtros.
  - Responsive: en móvil las acciones quedan en una barra fija inferior. **Versión**: web minor.

## Capabilities

### New Capabilities
- `audit-log-bulk-delete`: selección múltiple y eliminación múltiple de eventos de auditoría.

## Impact

- `Back/ExtractionApi`: `Features/Audit/DeleteAuditLogEntries.cs` (nuevo), `Directory.Build.props`.
- `Front`: `shared/services/auditLogService.ts`, `shared/components/ui/AuditLogView/AuditLogView.tsx` y `.module.css`,
  `package.json`.
- **Fuera de alcance**:
  - seleccionar todos los eventos de un filtro (solo la página actual);
  - borrado lógico y deshacer;
  - eliminar a Coach o ClubDirector (siguen en solo lectura);
  - Mobile.
