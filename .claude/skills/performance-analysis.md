# Performance Analysis Skill

Aplicar cuando hay consultas lentas, grandes volúmenes de datos, procesos batch o problemas de memoria.

---

## Propósito

Guiar el análisis y la optimización de rendimiento en el backend .NET, asegurando que las consultas, la carga de datos y el uso de caché sean eficientes y consistentes con las convenciones del proyecto.

Usar este skill cuando:

- Se detectan consultas lentas o timeouts en endpoints.
- Se trabaja con grandes volúmenes de datos (listados, exportaciones, reportes).
- Se implementan procesos batch o operaciones masivas.
- Hay problemas de memoria (alta ocupación, GC pressure, leaks).
- Se añaden o modifican consultas EF Core en handlers.
- Se introducen nuevas relaciones o navegaciones que pueden afectar queries existentes.
- Se revisa código existente por degradación de rendimiento.

---

## Antes del Cambio

Analizar antes de tocar cualquier archivo:

### 1. Identificar el cuello de botella

- Determinar si el problema es CPU, memoria, I/O o base de datos.
- Revisar logs y métricas de APM si están disponibles.
- Verificar si el problema es reproducible o esporádico.
- Identificar si ocurre en desarrollo, staging o solo en producción.

### 2. Consulta problemática

- Identificar el handler y la consulta EF Core específica.
- Habilitar logging de EF Core para ver la SQL generada:
  ```csharp
  optionsBuilder.EnableSensitiveDataLogging().LogTo(Console.WriteLine, LogLevel.Information);
  ```
- Ejecutar la SQL generada directamente en SSMS con `SET STATISTICS IO ON` y `SET STATISTICS TIME ON`.
- Verificar el plan de ejecución (`ctrl+M` en SSMS) y buscar scans en lugar de seeks.

### 3. Volumen estimado

- Estimar el número de filas en las tablas involucradas.
- Estimar el número de filas devueltas por la consulta.
- Verificar si hay filtrado temprano o si se cargan datos innecesarios antes de filtrar.

---

## Revisar

### 1. Consultas EF Core

- **Verificar `AsNoTracking()`**: toda consulta de solo lectura debe usar `AsNoTracking()`. Si el resultado no se modifica ni se persiste, no hay razón para que el Change Tracker lo siga.
  ```csharp
  // Bien: consultas de solo lectura
  await dbContext.ExternalUserSiteRoles.AsNoTracking().ToListAsync(cancellationToken);

  // Mal: sin AsNoTracking en consulta de solo lectura
  await dbContext.ExternalUserSiteRoles.ToListAsync(cancellationToken);
  ```

- **Verificar proyección**: si solo se necesitan algunas columnas, usar `Select()` en lugar de cargar la entidad completa.
  ```csharp
  // Bien: proyección cuando no se necesita la entidad completa
  await dbContext.Users.AsNoTracking()
      .Where(u => u.SiteId == siteId)
      .Select(u => new UserSummary(u.Id, u.Name, u.Email))
      .ToListAsync(cancellationToken);

  // Mal: cargar la entidad completa cuando solo se necesitan algunos campos
  await dbContext.Users.AsNoTracking()
      .Where(u => u.SiteId == siteId)
      .ToListAsync(cancellationToken);
  ```

- **Verificar filtrado en la base de datos**: el `Where` debe ejecutarse en SQL, no en memoria después de `ToListAsync()`.
  ```csharp
  // Bien: filtrado en la base de datos
  await dbContext.Users.AsNoTracking()
      .Where(u => u.Active && u.SiteId == siteId)
      .ToListAsync(cancellationToken);

  // Mal: filtrado en memoria
  var users = await dbContext.Users.AsNoTracking().ToListAsync(cancellationToken);
  var active = users.Where(u => u.Active && u.SiteId == siteId).ToList();
  ```

### 2. Índices

- Toda columna usada en `WHERE`, `JOIN` o `ORDER BY` frecuente debe tener índice.
- Los índices se definen en `EntityConfiguration`, no manualmente en SQL:
  ```csharp
  builder.HasIndex(x => x.Email).IsUnique();
  builder.HasIndex(x => new { x.SiteId, x.UserId }, "IX_Name_Descriptive");
  ```
- Verificar índices existentes en `src/services/infrastructure/CVL.SmartLocks.Infrastructure.Data.SqlServer/EntitiesConfiguration/`.
- Considerar índices compuestos cuando se filtra por múltiples columnas juntas frecuentemente.
- Considerar índices incluidos (`Include`) cuando la consulta solo necesita columnas adicionales en el SELECT.

### 3. N+1 Queries

- **Detectar**: si dentro de un bucle se hace una consulta por cada iteración, hay un problema N+1.
- **Solucionar con `Include`/`ThenInclude`**: cuando se necesitan las navegaciones, cargarlas en la consulta inicial.
  ```csharp
  // Bien: cargar navegaciones en una sola consulta
  await dbContext.ExternalUsers.AsNoTracking()
      .Include(u => u.SmartLockUser)
      .ThenInclude(s => s.SiteUsers)
      .Where(u => u.Id == userId)
      .FirstOrDefaultAsync(cancellationToken);

  // Mal: N+1 por navegar bajo demanda en un bucle
  var users = await dbContext.ExternalUsers.AsNoTracking().ToListAsync(cancellationToken);
  foreach (var user in users)
  {
      var smartLockUser = await dbContext.SmartLockUsers.AsNoTracking()
          .FirstOrDefaultAsync(s => s.ExternalUserId == user.Id, cancellationToken);
  }
  ```
- **Solucionar con `Select`**: cuando no se necesitan las entidades completas de navegación, proyectar directamente.
- **Evitar carga diferida (lazy loading)**: no usar navegaciones virtuales con proxies. Todas las navegaciones deben ser explícitas con `Include` o proyección.

### 4. Carga innecesaria

- **No llamar a `ToListAsync()` si se usa `FirstOrDefaultAsync()` o `SingleOrDefaultAsync()`**:
  ```csharp
  // Bien: traer solo el primer resultado
  await dbContext.Users.AsNoTracking()
      .Where(u => u.Email == email)
      .FirstOrDefaultAsync(cancellationToken);

  // Mal: traer todos y luego filtrar en memoria
  var users = await dbContext.Users.AsNoTracking()
      .Where(u => u.Email == email)
      .ToListAsync(cancellationToken);
  var user = users.FirstOrDefault();
  ```

- **No cargar navegaciones que no se usan**: revisar si todos los `Include` son necesarios para el response.
- **Paginación obligatoria en listados**: todo endpoint que devuelve colecciones debe paginar por defecto. No cargar miles de registros sin límite.
  ```csharp
  // Bien: paginación en la base de datos
  await dbContext.Users.AsNoTracking()
      .Where(u => u.SiteId == siteId)
      .OrderBy(u => u.Name)
      .Skip((page - 1) * pageSize)
      .Take(pageSize)
      .ToListAsync(cancellationToken);
  ```

- **Verificar `Select` vs entidad completa**: en handlers de búsqueda/listado, si el response solo mapea unos campos, usar proyección en lugar de cargar la entidad completa.

### 5. Caché

- El proyecto usa `ICacheService` (implementación con `IDistributedCache` y soporte para Redis). Ubicación: `src/services/shared/CVL.SmartLocks.Shared/Infrastructure/Cache/`.
- **Cuándo cachear**: datos de referencia que cambian infrecuentemente (catálogos, permisos, configuración de sitio).
- **Cuándo NO cachear**: datos por usuario que cambian frecuentemente, resultados de búsqueda paginada, datos transaccionales.
- **Invalidación**: al modificar datos cacheados, invalidar la clave correspondiente.
- **Claves descriptivas**: `{Entidad}:{Id}:{Contexto}` (ej: `SitePermissions:{siteId}`).
- **TTL apropiado**: datos de referencia → minutos/horas; datos de sesión → segundos/minutos.

---

## Patrones de Optimización

### Listado paginado eficiente

```csharp
var query = dbContext.Entities.AsNoTracking()
    .Where(filter)
    .OrderBy(sorting);

var totalCount = await query.CountAsync(cancellationToken);
var items = await query
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .Select(e => new EntitySummary(e.Id, e.Name))
    .ToListAsync(cancellationToken);

return new PagedResult<EntitySummary>(items, totalCount, page, pageSize);
```

### Búsqueda con proyección

```csharp
var results = await dbContext.Users.AsNoTracking()
    .Where(u => u.Name.Contains(searchTerm) || u.Email.Contains(searchTerm))
    .Select(u => new UserSearchItem(u.Id, u.Name, u.Email))
    .OrderBy(u => u.Name)
    .Take(50)
    .ToListAsync(cancellationToken);
```

### Caché con invalidación

```csharp
var cacheKey = $"SitePermissions:{siteId}";
var cached = await cacheService.GetAsync<SitePermissionsResponse>(cacheKey, cancellationToken);
if (cached is not null) return cached;

var result = await dbContext.Permissions.AsNoTracking()
    .Where(p => p.SiteId == siteId)
    .Select(p => new SitePermissionsResponse(p.Id, p.Name))
    .ToListAsync(cancellationToken);

await cacheService.SetAsync(cacheKey, result, ttl: TimeSpan.FromMinutes(10), cancellationToken);
return result;
```

### Proceso batch eficiente

```csharp
// Bien: procesar en lotes para reducir memoria
const int batchSize = 500;
var processed = 0;
while (true)
{
    var batch = await dbContext.Entities.AsNoTracking()
        .OrderBy(e => e.Id)
        .Skip(processed)
        .Take(batchSize)
        .ToListAsync(cancellationToken);

    if (batch.Count == 0) break;

    foreach (var entity in batch) { /* process */ }

    processed += batchSize;
}
```

---

## Después del Cambio

### Verificar SQL generada

- Habilitar logging temporal y confirmar que la SQL generada es la esperada.
- Confirmar que no hay consultas adicionales inesperadas (N+1).
- Verificar que el `WHERE` se traduce a SQL y no se evalúa en memoria.

### Verificar índices

- Si se añadió un índice, generar la migración correspondiente.
- Confirmar que el plan de ejecución usa el índice (seek, no scan).
- Verificar que no hay índices duplicados o redundantes.

### Verificar `AsNoTracking()`

- Toda consulta de solo lectura en handlers usa `AsNoTracking()`.
- Las consultas que modifican entidades NO usan `AsNoTracking()` (necesitan Change Tracker para `SaveChanges` automático).

### Verificar compilación

```
dotnet build src/services/mcp/CVL.SmartLocks.MCP.Api/
```

### Medir impacto

- Comparar el tiempo de respuesta antes y después del cambio.
- Verificar el número de queries ejecutadas antes y después.
- Confirmar que el consumo de memoria no se ha incrementado.

---

## Evitar

### ❌ Cargar todo y filtrar en memoria

```csharp
var all = await dbContext.Users.AsNoTracking().ToListAsync(cancellationToken);
var filtered = all.Where(u => u.SiteId == siteId).ToList();
```

### ❌ N+1 en bucles

```csharp
foreach (var siteId in siteIds)
{
    var site = await dbContext.Sites.FindAsync(siteId); // N+1
}
```

### ❌ Include innecesario

```csharp
// Si solo se usa el Id del sitio, no cargar toda la navegación
await dbContext.Users.AsNoTracking()
    .Include(u => u.Site)           // Innecesario si solo se necesita SiteId
    .Include(u => u.Site.Company)   // Innecesario
    .ToListAsync(cancellationToken);
```

### ❌ Ausencia de paginación

```csharp
// Mal: sin límite puede devolver miles de registros
await dbContext.Users.AsNoTracking().ToListAsync(cancellationToken);
```

### ❌ Caché sin invalidación

```csharp
// Mal: nunca se invalida, datos_obsoletos
await cacheService.SetAsync("AllUsers", users, ttl: TimeSpan.FromDays(30));
```

---

## Checklist Rápido

- [ ] Identifiqué el cuello de botella y la consulta específica.
- [ ] Las consultas de solo lectura usan `AsNoTracking()`.
- [ ] No hay N+1 queries (navegaciones cargadas con `Include` o proyección).
- [ ] No se cargan datos innecesarios (proyección con `Select` cuando aplica).
- [ ] El filtrado y ordenación se ejecutan en la base de datos, no en memoria.
- [ ] Los listados están paginados.
- [ ] Las columnas de `WHERE`/`JOIN`/`ORDER BY` frecuentes tienen índice.
- [ ] El caché se usa solo para datos apropiados con invalidación correcta.
- [ ] La SQL generada es la esperada (verificada con logging).
- [ ] El rendimiento mejoró mediblemente tras el cambio.
- [ ] La solución compila correctamente.
