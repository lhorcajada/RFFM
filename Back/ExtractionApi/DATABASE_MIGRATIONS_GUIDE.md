# ??? Database Migrations - Guía Completa

## ?? Resumen

Las migraciones de Entity Framework Core permiten gestionar cambios en el schema de la base de datos de forma controlada y versionada.

---

## ? Migraciones Automáticas

### En Desarrollo Local

Las migraciones se aplican **automáticamente** al iniciar la aplicación gracias a estas líneas en `Program.cs`:

```csharp
await app.MigrateDbContext<AppDbContext>();
await app.MigrateDbContext<IdentityDbContext>();
```

### En Docker

Las migraciones también se aplican automáticamente cuando inicias el container:

```bash
docker-compose up
```

### En Azure

Cuando se despliega a Azure Web App, las migraciones se ejecutan en el primer arranque del contenedor.

---

## ??? Gestión Manual de Migraciones

### Script de PowerShell (Recomendado)

#### Crear nueva migración

```powershell
.\manage-migrations.ps1 -Action create -MigrationName "AddPlayerStatistics"
```

Esto crea:
- Archivo de migración en `src/RFFM.Api/Infrastructure/Migrations/`
- Clase `{Timestamp}_AddPlayerStatistics.cs` con métodos `Up()` y `Down()`
- Actualiza el `ModelSnapshot.cs`

#### Aplicar migraciones

```powershell
.\manage-migrations.ps1 -Action apply
```

Aplica todas las migraciones pendientes a la base de datos.

#### Listar migraciones

```powershell
.\manage-migrations.ps1 -Action list
```

Muestra:
- ? Migraciones aplicadas
- ? Migraciones pendientes

#### Generar script SQL

```powershell
.\manage-migrations.ps1 -Action script -OutputScript "update-prod.sql"
```

Genera un script SQL idempotente que puedes ejecutar manualmente en producción.

#### Eliminar última migración

```powershell
.\manage-migrations.ps1 -Action remove
```

?? Solo funciona si la migración NO ha sido aplicada a la base de datos.

#### Reset completo

```powershell
.\manage-migrations.ps1 -Action reset
```

?? **PELIGRO**: Elimina y recrea la base de datos completa.

---

## ?? Workflow Recomendado

### 1. Cambiar el Modelo

Edita tus entidades en `src/RFFM.Api/Domain/`:

```csharp
public class Player
{
    public string Id { get; set; }
    public string Name { get; set; }
    // Nuevo campo
    public int JerseyNumber { get; set; }
}
```

### 2. Crear Migración

```powershell
.\manage-migrations.ps1 -Action create -MigrationName "AddJerseyNumberToPlayer"
```

### 3. Revisar Migración Generada

Abre el archivo en `src/RFFM.Api/Infrastructure/Migrations/`:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<int>(
        name: "JerseyNumber",
        schema: "app",
        table: "Players",
        type: "int",
        nullable: false,
        defaultValue: 0);
}
```

### 4. Probar Localmente

```powershell
# Aplicar migración
.\manage-migrations.ps1 -Action apply

# O simplemente ejecutar la app (aplica automáticamente)
dotnet run --project src/RFFM.Host
```

### 5. Commit y Push

```bash
git add .
git commit -m "feat: add JerseyNumber to Player model"
git push origin main
```

### 6. Deploy Automático

GitHub Actions automáticamente:
1. ? Compila el proyecto
2. ? Ejecuta tests
3. ? Construye imagen Docker
4. ? Sube a Azure Container Registry
5. ? Azure Web App pull la imagen
6. ? Las migraciones se aplican al iniciar

---

## ?? Comandos EF Core Directos

Si prefieres no usar el script de PowerShell:

### Crear migración

```bash
dotnet ef migrations add MigrationName \
  --project src/RFFM.Api \
  --startup-project src/RFFM.Host \
  --context RFFM.Api.Infrastructure.Persistence.AppDbContext \
  --output-dir Infrastructure/Migrations
```

### Aplicar migraciones

```bash
dotnet ef database update \
  --project src/RFFM.Api \
  --startup-project src/RFFM.Host \
  --context RFFM.Api.Infrastructure.Persistence.AppDbContext
```

### Listar migraciones

```bash
dotnet ef migrations list \
  --project src/RFFM.Api \
  --startup-project src/RFFM.Host \
  --context RFFM.Api.Infrastructure.Persistence.AppDbContext
```

### Generar script SQL

```bash
dotnet ef migrations script \
  --project src/RFFM.Api \
  --startup-project src/RFFM.Host \
  --context RFFM.Api.Infrastructure.Persistence.AppDbContext \
  --output migration.sql \
  --idempotent
```

### Rollback a migración específica

```bash
dotnet ef database update MigrationName \
  --project src/RFFM.Api \
  --startup-project src/RFFM.Host \
  --context RFFM.Api.Infrastructure.Persistence.AppDbContext
```

### Eliminar base de datos

```bash
dotnet ef database drop \
  --project src/RFFM.Api \
  --startup-project src/RFFM.Host \
  --context RFFM.Api.Infrastructure.Persistence.AppDbContext \
  --force
```

---

## ?? Múltiples DbContexts

Este proyecto tiene dos DbContexts:

### 1. AppDbContext
- Schema: `app`
- Contiene: Clubs, Teams, Players, Seasons, etc.

```powershell
.\manage-migrations.ps1 -Action create -MigrationName "AddNewTable" -Context AppDbContext
```

### 2. IdentityDbContext
- Schema: `dbo` (default)
- Contiene: AspNetUsers, AspNetRoles, etc.

```powershell
.\manage-migrations.ps1 -Action create -MigrationName "CustomizeIdentity" -Context IdentityDbContext
```

---

## ?? Troubleshooting

### Error: "There is already an object named..."

La migración intenta crear algo que ya existe.

**Solución**:
```powershell
# Eliminar última migración
.\manage-migrations.ps1 -Action remove

# Recrear con cambios
.\manage-migrations.ps1 -Action create -MigrationName "CorrectMigration"
```

### Error: "Cannot drop the table... because it is being referenced by a FOREIGN KEY"

El orden de eliminación de tablas en `Down()` es incorrecto.

**Solución**: Editar manualmente el archivo de migración para cambiar el orden.

### Error: "No migrations configuration type was found"

El proyecto API no está configurado correctamente.

**Solución**: Verificar que `src/RFFM.Api/RFFM.Api.csproj` tenga:
```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="9.0.x" />
```

### Migraciones no se aplican en Azure

**Verificar**:
1. Los logs de la aplicación:
   ```bash
   az webapp log tail --name rffmapi --resource-group rffm-resources
   ```

2. Connection string configurada:
   ```bash
   az webapp config connection-string list --name rffmapi --resource-group rffm-resources
   ```

3. Firewall de SQL Server permite conexiones de Azure:
   ```bash
   az sql server firewall-rule list --server [tu-server] --resource-group rffm-resources
   ```

---

## ?? Best Practices

### ? DO

- **Crear migraciones descriptivas**: `AddPlayerStatisticsTable` en lugar de `Update1`
- **Revisar antes de commit**: Verifica que la migración hace lo que esperas
- **Probar rollback**: Asegúrate de que `Down()` funciona correctamente
- **Usar transacciones**: Las migraciones automáticamente usan transacciones
- **Generar scripts para producción**: Úsalos para deploys críticos

### ? DON'T

- **No editar migraciones aplicadas**: Crea una nueva migración en su lugar
- **No hacer cambios destructivos sin plan**: Backup antes de eliminar columnas
- **No commitear sin probar**: Aplica la migración localmente primero
- **No hacer migraciones gigantes**: Divide en migraciones más pequeñas
- **No ignorar warnings**: EF Core te advierte sobre pérdida de datos

---

## ?? Ejemplo Completo

### Escenario: Agregar campo Email a Player

#### 1. Modificar modelo

```csharp
// src/RFFM.Api/Domain/Entities/Players/Player.cs
public class Player
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string? Email { get; set; } // Nuevo campo
}
```

#### 2. Crear migración

```powershell
.\manage-migrations.ps1 -Action create -MigrationName "AddEmailToPlayer"
```

#### 3. Revisar archivo generado

```csharp
// src/RFFM.Api/Infrastructure/Migrations/{timestamp}_AddEmailToPlayer.cs
public partial class AddEmailToPlayer : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Email",
            schema: "app",
            table: "Players",
            type: "nvarchar(255)",
            maxLength: 255,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Email",
            schema: "app",
            table: "Players");
    }
}
```

#### 4. Aplicar localmente

```powershell
dotnet run --project src/RFFM.Host
# Migraciones se aplican automáticamente al iniciar
```

#### 5. Verificar en base de datos

```sql
SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'app' 
  AND TABLE_NAME = 'Players' 
  AND COLUMN_NAME = 'Email';
```

#### 6. Commit y deploy

```bash
git add .
git commit -m "feat: add Email field to Player model"
git push origin main
```

---

## ?? Referencias

- [Entity Framework Core Migrations](https://learn.microsoft.com/ef/core/managing-schemas/migrations/)
- [EF Core CLI Reference](https://learn.microsoft.com/ef/core/cli/dotnet)
- [Migration History Table](https://learn.microsoft.com/ef/core/managing-schemas/migrations/history-table)
