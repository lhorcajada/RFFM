# Database Evolution Skill

Aplicar cuando una feature modifica la capa de persistencia: nuevas entidades, columnas, relaciones, índices, o cambios en el esquema existente.

---

## Propósito

Guiar la evolución controlada del esquema de base de datos, asegurando que los cambios sean seguros, reversibles y consistentes con los datos existentes.

Use this skill whenever:

- Se añade, modifica o elimina una entidad del DbContext.
- Se crean o alteran relaciones entre entidades.
- Se añaden, modifican o eliminan columnas.
- Se crean o modifican índices.
- Se requiere una migración de datos dentro de una migración EF Core.
- Se cambia el tipo de una columna existente.
- Se introduce un nuevo Value Object que requiere conversión en base de datos.

---

## Antes del Cambio

Analizar antes de tocar cualquier archivo:

### 1. Modelo actual

- Identificar la entidad o entidades afectadas en `src/services/shared/CVL.SmartLocks.Domain/`.
- Revisar la configuración actual en `src/services/infrastructure/CVL.SmartLocks.Infrastructure.Data.SqlServer/EntitiesConfiguration/`.
- Verificar el mapeo en `SmartLocksDbContext.cs` (DbSet y cualquier configuración inline).

### 2. Relaciones existentes

- Identificar claves foráneas y navegaciones afectadas.
- Verificar si la relación es obligatoria u opcional.
- Comprobar si existen cascadas configuradas.
- Revisar si hay índices compuestos o únicos dependientes de las columnas involucradas.

### 3. Datos históricos

- Si la tabla ya existe en producción, asumir que tiene datos.
- Verificar si hay datos que puedan violar la nueva restricción (nulos en columna que será obligatoria, duplicados en columna que será única, valores fuera de rango en cambio de tipo).

### 4. Impacto en migraciones

- Nombre descriptivo para la migración: `{Accion}{Entidad}{Detalle}` (ej: `AddNewEmailToExternalUserOtpRequest`).
- Determinar si se necesita migración de datos además de cambio de esquema.
- Verificar si la migración es compatible con la versión anterior del código (despliegue sin downtime).

---

## Implementación

### 1. Crear la migración EF Core

Ejecutar desde `src/services/infrastructure/CVL.SmartLocks.Infrastructure.Data.SqlServer/`:

```
dotnet ef migrations add {MigrationName} --startup-project src/services/mcp/CVL.SmartLocks.MCP.Host
```

### 2. Revisar la migración generada

Verificar que la migración generada automáticamente:

- No contiene operaciones destructivas no intencionadas.
- No elimina columnas o tablas que contengan datos necesarios.
- No modifica tipos de columna sin considerar truncamiento de datos.
- Incluye protección para datos existentes cuando aplique.

Si la migración generada no es correcta, ajustarla manualmente antes de aplicarla.

### 3. Revisar y crear índices

- Toda columna usada en `WHERE`, `JOIN` o `ORDER BY` frecuente debe tener índice.
- Los índices únicos deben crearse en la configuración de la entidad, no manualmente en SQL.
- Si se añade una restricción única sobre datos existentes, verificar que no hay duplicados antes de crear el índice.

```csharp
// En EntityConfiguration
builder.HasIndex(e => e.Email).IsUnique();
```

### 4. Evitar operaciones destructivas

- No eliminar columnas con datos en un solo paso. Primero dejar de usarla, luego eliminar en migración posterior.
- No cambiar `nullable: false` a `nullable: true` (o viceversa) sin verificar datos existentes.
- No cambiar tipos de columna sin análisis de impacto.
- Toda migración debe implementar `Down` de forma funcional para poder revertir.

### 5. Migración de datos cuando sea necesario

Cuando el cambio de esquema requiere transformar datos existentes:

- Realizar la migración de datos dentro de la misma migración, después del cambio de esquema.
- Usar `migrationBuilder.Sql()` con sentencias parametrizadas cuando sea posible.
- Proteger contra datos inesperados (valores nulos, fuera de rango).

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>("NewEmail", "ExternalUserOtpRequests", nullable: true);

    // Migrar datos de la columna anterior si aplica
    migrationBuilder.Sql("UPDATE ExternalUserOtpRequests SET NewEmail = Email WHERE NewEmail IS NULL");
}
```

---

## Después del Cambio

### Verificar configuración de entidad

- La nueva propiedad está mapeada en `EntityConfiguration`.
- Los Value Objects usan convertidores registrados en `ValueObjectConverters.cs` si aplica.
- Las relaciones tienen configuración explícita de cascade behavior.
- Los enums nuevos están registrados en la carpeta `EnumsConfiguration/`.

### Verificar DbContext

- El DbSet está declarado si se añadió una nueva entidad.
- No hay DbSets huérfanos o duplicados.

### Verificar compilación

```
dotnet build src/services/infrastructure/CVL.SmartLocks.Infrastructure.Data.SqlServer/
```

### Verificar la migración

```
dotnet ef migrations list --startup-project src/services/mcp/CVL.SmartLocks.MCP.Host
  --project src/services/infrastructure/CVL.SmartLocks.Infrastructure.Data.SqlServer/
```

Confirmar que la nueva migración aparece como pendiente y las anteriores están aplicadas.

---

## Patrones Comunes

### Añadir nueva entidad

1. Crear la clase de dominio en `Domain/{Aggregate}/`.
2. Crear `EntityConfiguration` en `EntitiesConfiguration/{Aggregate}/`.
3. Añadir `DbSet<>` en `SmartLocksDbContext.cs`.
4. Generar la migración.
5. Verificar que se crea la tabla con las columnas, claves e índices esperados.

### Añadir columna a entidad existente

1. Añadir la propiedad en la entidad de dominio.
2. Actualizar la configuración en `EntityConfiguration` si la columna requiere restricciones (longitud, obligatoriedad, índice).
3. Generar la migración.
4. Verificar que la operación es `AddColumn` con los parámetros correctos.

### Añadir relación

1. Añadir la navegación y la FK en las entidades de dominio.
2. Configurar la relación en `EntityConfiguration` (cascade, required/optional).
3. Generar la migración.
4. Verificar que se crea la FK y los índices correspondientes.

### Cambiar tipo de columna

1. Analizar datos existentes que puedan no ser compatibles.
2. Si hay riesgo de pérdida de datos, crear migración previa de transformación.
3. Realizar el cambio en la entidad y configuración.
4. Generar la migración.
5. Verificar que `AlterColumn` tiene los parámetros correctos y no hay truncamiento silencioso.

### Eliminar columna

1. Dejar de referenciar la columna en todo el código.
2. Desplegar y verificar que nada la usa.
3. Crear migración que elimine la columna.
4. Documentar la decisión en el commit.

---

## Checklist Rápido

- [ ] Analicé el modelo actual y las relaciones afectadas.
- [ ] Consideré el impacto en datos existentes.
- [ ] El nombre de la migración es descriptivo.
- [ ] La migración no contiene operaciones destructivas no intencionadas.
- [ ] Los índices necesarios están creados en EntityConfiguration.
- [ ] La migración implementa `Down` de forma funcional.
- [ ] Si hay migración de datos, está protegida contra valores inesperados.
- [ ] La configuración de entidad y DbContext están actualizadas.
- [ ] La solución compila correctamente.
