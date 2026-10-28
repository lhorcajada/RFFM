## Context

`SearchAuditLog.cs` (`Features/Audit/`) es el único endpoint de auditoría; los datos están en
`AppDbContext.UserActivityLogs` (`UserActivityLog`, Id `string`). `AuditLogView` pagina de 25 en 25.

## Decisions

### D1 · Backend: un slice `DeleteAuditLogEntries.cs`
```csharp
app.MapDelete("/api/audit-log", ...)
   .RequireAuthorization(new AuthorizeAttribute { Roles = "Federation,Administrator" });
public record DeleteAuditLogEntriesRequest(string[] Ids);
public record DeleteAuditLogEntriesCommand(string[] Ids) : ICommand<DeleteAuditLogEntriesResponse>;
public record DeleteAuditLogEntriesResponse(int Deleted);
```
- Validator (FluentValidation): `Ids` no nulo, 1–100, sin vacíos ni duplicados.
- Handler: `_db.UserActivityLogs.Where(a => ids.Contains(a.Id)).ExecuteDeleteAsync(ct)` y devuelve el número.
  Los ids que no existen no son error (idempotente).
- Errores de validación → `ProblemDetails` 400, como el resto de features.

### D2 · Frontend: servicio
`deleteAuditLogEntries(ids: string[]): Promise<number>` en `auditLogService.ts` con el cliente Axios único
(`api.delete('/api/audit-log', { data: { ids } })`).

### D3 · Frontend: `AuditLogView`
- Estado `selectedIds: Set<string>`, `confirmOpen`, `deleting`. Se limpia al cambiar `pageNumber` o filtros.
- Prop derivada `canDelete` (roles Federation/Administrator, de `UserContext`/roles ya disponibles); sin permiso no se
  renderiza ningún checkbox ni barra.
- Barra de selección (diseño): `<input type="checkbox">` con `label` de 44 px, contador, «Cancelar selección»,
  «Eliminar (N)» deshabilitado con N=0. Tarjeta seleccionada con borde y fondo de acento vía clase CSS Module.
- Móvil: la barra de acciones queda fija abajo (`position: sticky`) bajo 600 px.
- `ConfirmDialog` (`shared/components/ui/ConfirmDialog`): título «Eliminar eventos», texto con el número, `processing`
  mientras borra. Éxito → snackbar «N eventos eliminados», recarga; si la página queda vacía y no es la 1, retrocede.
- Nada de tablas, `confirm()` nativo ni `style={{}}`.

## Risks
- Borrado irreversible de evidencia: de ahí el permiso restringido y la confirmación.
- `coach/audit-log` lo ve el Coach, que no tiene permiso: ahí la vista queda como hoy; los checkboxes solo
  aparecen a Federación/Administrador. Si se quiere que el Coach borre, es otro cambio.
