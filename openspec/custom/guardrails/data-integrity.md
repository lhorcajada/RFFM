# Integridad de Datos — Guardrails

Reglas inviolables para preservar la integridad de los datos en el proyecto CVL.SmartLocks.
Cada regla describe **lo que NO debe hacerse** para no comprometer los datos existentes.

---

## Migraciones

### ❌ No eliminar columnas sin migración controlada

Toda columna que contenga datos en producción debe ser eliminada en pasos: primero marcarla como obsoleta, luego eliminarla en una migración posterior una vez verificado que ningún código ni proceso la referencia. Una eliminación directa destruye información irreversiblemente.

**Incorrecto:**
```csharp
// En una sola migración: se elimina la columna directamente ❌
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropColumn("PhoneNumber", "Users");
}
```

**Correcto:**
```csharp
// Migración 1: marcar como obsoleta, dejar de usarla en código
protected override void Up(MigrationBuilder migrationBuilder)
{
    // No tocar la columna. Actualizar código para ignorarla.
    // Desplegar y verificar que nada la referencia.
}

// Migración 2 (despliegue posterior): eliminar la columna
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropColumn("PhoneNumber", "Users");
}
```

### ❌ No crear migraciones no reversibles cuando sea posible evitarlo

Toda migración debe implementar `Down` de forma funcional. Si la operación es destructiva (eliminación de datos), el `Down` debe al menos documentar que la pérdida es irreversible y el revisor debe aprobarlo explícitamente.

**Incorrecto:**
```csharp
protected override void Down(MigrationBuilder migrationBuilder)
{
    // No se puede revertir ❌
    throw new NotSupportedException("No se puede revertir esta migración");
}
```

**Correcto:**
```csharp
protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>("PhoneNumber", "Users", nullable: true);
}
```

### ❌ No modificar el tipo de una columna sin analizar impacto en datos existentes

Cambiar un `int` a `string`, un `decimal` a `float`, o reducir la longitud de un `nvarchar` puede truncar o corromper datos existentes. Siempre verificar si hay datos que no quepan en el nuevo tipo y migrarlos antes del cambio de esquema.

**Incorrecto:**
```csharp
// Cambiar NVARCHAR(500) a NVARCHAR(50) sin verificar ❌
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AlterColumn<string>("Description", "Products", maxLength: 50, nullable: true);
}
```

**Correcto:**
```csharp
// 1. Verificar si hay datos que excedan la nueva longitud
// SELECT COUNT(*) FROM Products WHERE LEN(Description) > 50
// 2. Si los hay: truncar o migrar antes de alterar la columna
// 3. Aplicar la migración
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql("UPDATE Products SET Description = LEFT(Description, 50) WHERE LEN(Description) > 50");
    migrationBuilder.AlterColumn<string>("Description", "Products", maxLength: 50, nullable: true);
}
```

---

## Relaciones y Claves Foráneas

### ❌ No cambiar relaciones sin revisar datos actuales

Antes de añadir una restricción de clave foránea, convertir una relación opcional en obligatoria, o eliminar una relación, verificar que los datos existentes cumplen la nueva restricción. Datos huérfanos provocan errores en producción.

**Incorrecto:**
```csharp
// Añadir FK obligatoria sin verificar si hay filas sin el valor ❌
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AlterColumn<int>("LocationId", "Users", nullable: false);
    migrationBuilder.AddForeignKey("FK_Users_Locations", "Users", "LocationId", "Locations");
}
```

**Correcto:**
```csharp
// 1. Verificar si hay filas con LocationId nulo
// SELECT COUNT(*) FROM Users WHERE LocationId IS NULL
// 2. Asignar un valor por defecto o eliminar los huérfanos
// 3. Aplicar la restricción
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql("UPDATE Users SET LocationId = @defaultLocationId WHERE LocationId IS NULL");
    migrationBuilder.AlterColumn<int>("LocationId", "Users", nullable: false);
    migrationBuilder.AddForeignKey("FK_Users_Locations", "Users", "LocationId", "Locations");
}
```

### ❌ No eliminar tablas con datos sin respaldo ni migración

Si una tabla contiene datos que aún se necesitan, trasladar los datos a su nueva ubicación antes de eliminarla. Si los datos ya no son necesarios, documentar la decisión.

**Incorrecto:**
```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropTable("OldUserSessions"); // ❌ ¿Y los datos?
}
```

**Correcto:**
```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    // Migrar datos a la nueva tabla antes de eliminar
    migrationBuilder.Sql("""
        INSERT INTO UserSessions (UserId, Token, ExpiresAt)
        SELECT UserId, Token, ExpiresAt FROM OldUserSessions
    """);
    migrationBuilder.DropTable("OldUserSessions");
}
```

---

## Operaciones Masivas

### ❌ No ejecutar operaciones masivas sin protección

Toda operación que afecte a múltiples filas (updates, deletes, inserts masivos) debe incluir cláusulas de protección: `WHERE` restrictivo, límites de filas afectadas, o ejecución en lotes. Un `UPDATE` o `DELETE` sin `WHERE` afecta a toda la tabla.

**Incorrecto:**
```csharp
public async Task<Result> Execute(DeactivateAllUsersCommand request, CancellationToken ct)
{
    await _dbContext.Users.ExecuteUpdateAsync(
        u => u.SetProperty(p => p.Status, UserStatus.Inactive), ct); // ❌ Sin filtro
    return Result.Success();
}
```

**Correcto:**
```csharp
public async Task<Result> Execute(DeactivateCompanyUsersCommand request, CancellationToken ct)
{
    var affected = await _dbContext.Users
        .Where(u => u.CompanyId == request.CompanyId)
        .ExecuteUpdateAsync(u => u.SetProperty(p => p.Status, UserStatus.Inactive), ct);

    if (affected == 0)
        return Result.Failure(CompanyErrors.NoUsersFound, CompanyErrorCodes.NoUsersFound);

    return Result.Success();
}
```

### ❌ No procesar conjuntos grandes de datos sin paginación

Cuando se leen o procesan miles de filas, usar paginación o enumeración por lotes para evitar consumir toda la memoria y.timeout del servidor.

**Incorrecto:**
```csharp
public async Task<Result> Execute(GenerateReportCommand request, CancellationToken ct)
{
    var allUsers = await _dbContext.Users.ToListAsync(ct); // ❌ Carga todo en memoria
    foreach (var user in allUsers)
    {
        // procesar...
    }
    return Result.Success();
}
```

**Correcto:**
```csharp
public async Task<Result> Execute(GenerateReportCommand request, CancellationToken ct)
{
    var pageSize = 500;
    var page = 0;
    var hasMore = true;

    while (hasMore)
    {
        var batch = await _dbContext.Users
            .OrderBy(u => u.Id)
            .Skip(page * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        foreach (var user in batch)
        {
            // procesar...
        }

        hasMore = batch.Count == pageSize;
        page++;
    }

    return Result.Success();
}
```

---

## Datos Sensibles y Consistencia

### ❌ No modificar datos sensibles (email, roles, permisos) sin auditoría

Todo cambio en datos sensibles debe quedar registrado. Si la tabla no tiene auditoría nativa, registrar el cambio manualmente con quién, cuándo, valor anterior y valor nuevo.

**Incorrecto:**
```csharp
public async Task<Result> Execute(ChangeUserEmailCommand request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.UserId, ct);
    user!.Email = request.NewEmail; // ❌ Sin rastro del cambio
    return Result.Success();
}
```

**Correcto:**
```csharp
public async Task<Result> Execute(ChangeUserEmailCommand request, CancellationToken ct)
{
    var user = await _dbContext.Users.FindAsync(request.UserId, ct);
    var previousEmail = user!.Email;
    user.ChangeEmail(request.NewEmail);

    _dbContext.UserEmailChanges.Add(new UserEmailChange(
        user.Id, previousEmail, request.NewEmail, request.ChangedBy));

    return Result.Success();
}
```

### ❌ No romper la consistencia entre entidades relacionadas

Si dos entidades deben mantenerse sincronizadas (por ejemplo, un contador en una tabla padre y sus detalles en una tabla hija), actualizar ambas dentro de la misma unidad de trabajo. No delegar la consistencia a procesos separados.

**Incorrecto:**
```csharp
public async Task<Result> Execute(AddLockCommand request, CancellationToken ct)
{
    var location = await _dbContext.Locations.FindAsync(request.LocationId, ct);
    var lock_ = Lock.Create(request.Name, request.LocationId);
    _dbContext.Locks.Add(lock_);
    // ❌ No se actualiza el contador de locks en Location
    return Result.Success();
}
```

**Correcto:**
```csharp
public async Task<Result> Execute(AddLockCommand request, CancellationToken ct)
{
    var location = await _dbContext.Locations.FindAsync(request.LocationId, ct);
    var lock_ = Lock.Create(request.Name, request.LocationId);
    _dbContext.Locks.Add(lock_);
    location!.IncrementLockCount(); // ✅ Consistencia dentro de la misma UoW
    return Result.Success();
}
```

### ❌ No asumir que una columna tiene valores únicos sin restricción

Si una columna debe contener valores únicos (email, código de locking, etc.), la base de datos debe tener un índice único. La validación en el handler no basta: dos requests concurrentes pueden pasar la validación e insertar duplicados.

**Incorrecto:**
```csharp
// Solo validación en el handler ❌
public async Task<Result> Execute(CreateUserCommand request, CancellationToken ct)
{
    var exists = await _dbContext.Users.AnyAsync(u => u.Email == request.Email, ct);
    if (exists)
        return Result.Failure(UserErrors.AlreadyExists, UserErrorCodes.UserAlreadyExists);

    var user = User.Create(request.Email, request.Name);
    _dbContext.Users.Add(user);
    return Result.Success();
}
```

**Correcto:**
```csharp
// Validación en handler + índice único en base de datos ✅
// En la configuración de la entidad:
// builder.HasIndex(u => u.Email).IsUnique();

// En el handler: manejar la violación de unicidad de forma elegante
public async Task<Result> Execute(CreateUserCommand request, CancellationToken ct)
{
    var exists = await _dbContext.Users.AnyAsync(u => u.Email == request.Email, ct);
    if (exists)
        return Result.Failure(UserErrors.AlreadyExists, UserErrorCodes.UserAlreadyExists);

    var user = User.Create(request.Email, request.Name);
    _dbContext.Users.Add(user);
    return Result.Success();
}
```

---

## Valores por Defecto y Nulabilidad

### ❌ No hacer obligatoria una columna existente sin valor por defecto

Si una columna permite nulos y se hace obligatoria, los registros existentes con valor nulo rompen la restricción. Proporcionar un valor por defecto o actualizar los registros antes del cambio.

**Incorrecto:**
```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    // Hay filas con Status = NULL ❌
    migrationBuilder.AlterColumn<int>("Status", "Users", nullable: false);
}
```

**Correcto:**
```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql("UPDATE Users SET Status = 1 WHERE Status IS NULL");
    migrationBuilder.AlterColumn<int>("Status", "Users", nullable: false, defaultValue: 1);
}
```

### ❌ No usar `string` anulable para representar la ausencia de valor cuando el dominio exige un valor explícito

Si el dominio distingue entre "no tiene valor" y "tiene valor vacío", usar un tipo explícito (enum, value object) en lugar de confundir `null` con `""`. La ambigüedad genera bugs difíciles de rastrear.

**Incorrecto:**
```csharp
public class ExternalUser
{
    public string? PhoneNumber { get; set; } // ❌ ¿null = no tiene teléfono o no se proporcionó?
}
```

**Correcto:**
```csharp
public class ExternalUser
{
    public PhoneNumber? PhoneNumber { get; private set; } // Value object explícito
}

public record PhoneNumber(string Value, PhoneType Type);
public enum PhoneType { Mobile, Landline }
```
