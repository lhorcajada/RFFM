# Troubleshooting Skill

Aplicar cuando se corrige un bug o se investiga una incidencia en producción o desarrollo.

---

## Propósito

Guiar la resolución sistemática de incidencias, asegurando que cada bug se corrija de forma mínima, verificable y sin introducir regresiones.

Usar este skill cuando:

- Se reporta un bug en producción o staging.
- Se detecta un comportamiento inesperado en desarrollo.
- Una prueba existente falla sin motivo aparente.
- Un endpoint devuelve un código o mensaje de error incorrecto.
- Un proceso batch o tarea en segundo plano no completa correctamente.
- Hay datos inconsistentes en la base de datos.
- Se necesita investigar un problema de rendimiento que no es de consultas lentas (ver *Performance Analysis Skill* para eso).

---

## Antes del Cambio

Analizar antes de tocar cualquier archivo:

### 1. Reproducir el problema

- Obtener los pasos exactos para reproducir el bug: endpoint, payload, usuario, entorno.
- Verificar si es reproducible en local, staging o solo en producción.
- Identificar si depende de datos específicos (un usuario concreto, un sitio concreto, un rol concreto).
- Si no se puede reproducir, recopilar logs, trazas y contexto del error.

### 2. Recopilar evidencia

- Revisar logs de la aplicación (APM, Application Insights, seq, etc.).
- Revisar la respuesta HTTP completa: status code, body, headers.
- Revisar la SQL generada por EF Core si el problema involucra datos.
- Revisar el stack trace completo, no solo el mensaje de la excepción.
- Verificar si hay excepciones silenciadas (catch vacíos, `Result.Failure` ignorado).

### 3. Comprender el comportamiento esperado

- Identificar qué debería ocurrir según las reglas de negocio.
- Revisar la documentación del endpoint o feature en `openspec/specs/`.
- Revisar las pruebas existentes del feature afectado.
- Confirmar con el usuario o product owner si hay ambigüedad en el comportamiento esperado.

---

## Investigación

### 1. Identificar causa raíz

- Seguir el flujo desde el endpoint hasta el handler y el dominio.
- Verificar cada paso: ¿el request llega bien al handler? ¿el handler recibe los datos correctos? ¿la consulta devuelve lo esperado? ¿la lógica de negocio condiciona correctamente?
- Si el problema es de datos, ejecutar la consulta SQL directamente contra la base de datos.
- Si el problema es de autorización, verificar los claims del token y las validaciones en el handler.
- Si el problema es de validación, revisar el `FluentValidation` del feature.

### 2. Crear hipótesis

- Formular la causa más probable antes de implementar nada.
- Priorizar la hipótesis más simple (Occam's razor).
- Si hay múltiples hipótesis, verificar primero la más fácil de confirmar o descartar.
- Documentar la hipótesis aunque resulte incorrecta; ayuda a futuras investigaciones.

### 3. Aislar el fallo

- Determinar la capa donde ocurre el error: endpoint, handler, dominio, infraestructura, base de datos.
- Determinar si es un error de lógica, de datos, de configuración o de integración.
- Verificar si el error fue introducido por un cambio reciente (buscar en el historial de commits del feature).

---

## Implementación

### 1. Solución mínima

- Corregir solo lo necesario para resolver el bug. No refactorizar código adyacente.
- Si el fix requiere un cambio de diseño más amplio, crear una tarea separada y aplicar un workaround mínimo ahora.
- El fix debe respetar los patrones existentes: CQRS, `Result<T>`, FluentValidation, error codes.

### 2. Corregir en la capa correcta

| Causa                          | Dónde corregir                                        |
|--------------------------------|-------------------------------------------------------|
| Validación incorrecta o ausente| `{Feature}Validator.cs`                               |
| Lógica de negocio errónea      | `{Feature}Handler.cs` o `Domain/`                     |
| Autorización incorrecta        | Handler + `[Authorize]` en endpoint                   |
| Datos inconsistentes           | Migración de corrección + lógica de prevención        |
| Mapeo incorrecto en response   | `{Feature}Response.cs` o mapeo en handler             |
| Error code faltante            | `*ErrorCodes` + `Result.Failure` con code             |
| Consulta incorrecta            | Handler: `AsNoTracking()`, proyección, filtros         |

### 3. Incluir error code

- Si el bug es que falta un error code o el mensaje es incorrecto, corregirlo:
  ```csharp
  // Bien: con error code y tipo de failure
  return Result.Failure(
      UsersResources.NotPermissions,
      UserErrorCodes.NotPermissions,
      ResultFailureType.Forbidden);

  // Mal: sin error code
  return Result.Failure("Not authorized");
  ```

### 4. No llamar a `SaveChangesAsync`

- La persistencia es automática. Si el bug involucra datos que no se guardan, verificar que la entidad se está modificando correctamente y que el handler devuelve `Result` de éxito.

---

## Después del Cambio

### 1. Añadir prueba de regresión

- Escribir una prueba que falle sin el fix y pase con él.
- La prueba debe cubrir el caso exacto del bug reportado.
- Ubicar la prueba junto a las existentes del feature.
- Seguir el patrón de pruebas del proyecto (builder, fixtures, etc.).
- Etiquetar o nombrar la prueba de forma que se identifique como regresión del bug.

### 2. Verificar que el fix no rompe otros casos

- Ejecutar las pruebas del feature afectado.
- Verificar que los casos de éxito y los otros errores siguen funcionando.
- Si el fix cambia una validación o un error code, verificar que los consumidores del API lo esperan.

### 3. Verificar impacto en producción

- Si el bug afectó datos en producción, determinar si se necesita una migración de corrección o un script de limpieza.
- Si el bug expuso datos sensibles, evaluar la severidad y Notificar al equipo.
- Si el bug eludió autorización, auditar otros endpoints con la misma pattern.

### 4. Verificar compilación

```
dotnet build src/services/mcp/CVL.SmartLocks.MCP.Api/
```

### 5. Ejecutar pruebas

```
dotnet test --logger "console;verbosity=minimal"
```

---

## Evitar

### ❌ Corregir sin reproducir

```text
Mal: "Creo que el problema es X, así que lo cambio"
Bien: Reproducir el bug con pasos concretos, luego corregir la causa verificada
```

### ❌ Refactorizar mientras se corrige un bug

```text
Mal: Corregir el bug y de paso reorganizar el handler, renombrar variables, extraer métodos
Bien: Corregir solo el bug. Si hay refactor pendiente, crear una tarea separada
```

### ❌ Ignorar pruebas de regresión

```text
Mal: Corregir el bug, verificar manualmente, seguir adelante
Bien: Corregir el bug y añadir una prueba automática que prevenga la recurrencia
```

### ❌ Silenciar errores en lugar de corregirlos

```csharp
// Mal: capturar y olvidar
try { await handler.Execute(request, cancellationToken); }
catch { /* ignorado */ }

// Bien: devolver el resultado o propagar el error
var result = await handler.Execute(request, cancellationToken);
if (result.IsFailure)
    return Result.Failure(result.Reason);
```

### ❌ Añadir lógica defensiva en lugar de corregir la causa

```csharp
// Mal: null check para ocultar el bug
var user = await dbContext.Users.FindAsync(userId);
if (user is null) return Result.Success(); // oculta que el usuario debería existir

// Bien: devolver error claro si no se encuentra lo esperado
var user = await dbContext.Users.FindAsync(userId);
if (user is null)
    return Result.Failure(UsersResources.UserNotFound, UserErrorCodes.UserNotFound);
```

---

## Patrones Comunes

### Bug en validación: campos permitidos

```csharp
// Bug: no se validan los campos de ordenación, permitiendo SQL injection o errores
// Fix: añadir validación en el Validator
public class ListUsersValidator : AbstractValidator<ListUsersRequest>
{
    private static readonly string[] AllowedSortFields = ["name", "email", "createdAt"];
    private static readonly string[] AllowedSearchFields = ["name", "email"];

    public ListUsersValidator()
    {
        RuleFor(x => x.SortBy)
            .Must(f => f is null || AllowedSortFields.Contains(f, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Sort field not allowed");
    }
}
```

### Bug en autorización: endpoint sin protección

```csharp
// Bug: endpoint modifica datos pero no tiene [Authorize]
// Fix: añadir el atributo de autorización con el permiso correcto
app.MapPatch("/api/users/{userId:guid}/email", async (...) => { ... })
   .RequireAuthorization(Permissions.ManageUsers);
```

### Bug en datos: inconsistencia por lógica ausente

```csharp
// Bug: se asigna un rol pero no se valida que el solicitante puede otorgarlo
// Fix: añadir validación en el handler
var canGrant = requesterAuthorization.CanGrantRole(request.SiteId, request.RoleId);
if (!canGrant)
    return Result.Failure(RolesResources.CannotGrantRole, RoleErrorCodes.CannotGrantRole, ResultFailureType.Forbidden);
```

---

## Checklist Rápido

- [ ] Reproduje el bug con pasos concretos.
- [ ] Identifiqué la causa raíz, no solo el síntoma.
- [ ] Formulé una hipótesis antes de implementar.
- [ ] La corrección es mínima y respeta los patrones existentes.
- [ ] Añadí una prueba de regresión que falla sin el fix.
- [ ] Las pruebas existentes del feature siguen pasando.
- [ ] `Result.Failure` incluye el error code correspondiente.
- [ ] Evalué si el bug requiere corrección de datos en producción.
- [ ] La solución compila correctamente.
