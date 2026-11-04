# Calidad de Testing — Guardrails

Reglas inviolables para preservar la calidad y fiabilidad de los tests en el proyecto CVL.SmartLocks.
Cada regla describe **lo que NO debe hacerse** para no degradar la cobertura ni la confianza en los tests.

---

## Regresiones

### ❌ No corregir un bug sin añadir un test de regresión

Todo bug corregido debe ir acompañado de un test que reproduzca el fallo original y verifique que la corrección lo resuelve. Sin un test de regresión, el bug puede reaparecer sin que nadie lo detecte.

**Incorrecto:**
```csharp
// Bug: el handler permite asignar un rol inexistente al usuario
// Se corrige el handler añadiendo la validación...
// ...pero no se añade ningún test que lo cubra ❌
```

**Correcto:**
```csharp
// 1. Escribir el test que reproduce el bug
[Fact]
public async Task AssignRole_WhenRoleDoesNotExist_ReturnsFailure()
{
    // Arrange
    var command = new AssignRoleCommand(UserId: validUserId, RoleId: nonExistentRoleId);

    // Act
    var result = await _mediator.Send(command);

    // Assert
    result.IsFailure.Should().BeTrue();
    result.Error.Code.Should().Be(RoleErrorCodes.RoleNotFound);
}

// 2. Verificar que el test falla antes de la corrección
// 3. Aplicar la corrección en el handler
// 4. Verificar que el test pasa tras la corrección
```

### ❌ No marcar un bug como resuelto si su test de regresión no pasa

El test de regresión es la prueba objetiva de que el bug está corregido. Si el test no pasa de forma consistente, el bug no está resuelto.

---

## Eliminación de Tests

### ❌ No eliminar tests existentes para conseguir compilación correcta

Si un test falla tras un cambio, la respuesta correcta es corregir el código productivo o actualizar el test para reflejar el comportamiento intencionado, no eliminarlo. Un test que falla es una señal de que algo ha cambiado de forma no prevista y debe investigarse.

**Incorrecto:**
```csharp
// Tras renombrar una propiedad, varios tests dejan de compilar
// Se eliminan los tests para que el proyecto compile ❌
```

**Correcto:**
```csharp
// Tras renombrar una propiedad, varios tests dejan de compilar
// Se actualizan los tests para usar el nuevo nombre y verificar
// que el comportamiento sigue siendo el correcto ✅
```

### ❌ No comentar tests fallidos en lugar de corregirlos

Comentar un test (`// [Fact]`, `skip: true`, `[Ignore]`) oculta el problema sin resolverlo. Si un test es flaky, corregir la fuente del determinismo; si el comportamiento cambió intencionadamente, actualizar el test.

**Incorrecto:**
```csharp
[Fact(Skip = "Falla intermitentemente")] // ❌ Oculta el problema
public async Task GetUsers_ReturnsPagedResult()
```

**Correcto:**
```csharp
// Investigar la causa del fallo intermitente:
// - Asegurar que el seed de datos es determinista
// - Evitar dependencias en fechas/horas del sistema
// - Usar datos fijos en los assertions
// Una vez corregido, el test debe pasar siempre ✅
[Fact]
public async Task GetUsers_ReturnsPagedResult()
```

### ❌ No eliminar tests para incrementar el porcentaje de cobertura

La cobertura mide qué porcentaje del código está ejercitado. Si se eliminan tests, el porcentaje puede subir porque el denominador cambia, pero la protección real disminuye. La cobertura nunca debe mejorar empeorando la calidad.

---

## Cobertura

### ❌ No reducir la cobertura sin justificación documentada

Si un cambio hace que la cobertura disminuya, debe estar explícitamente justificado. Las justificaciones aceptables son limitadas: eliminación de código muerto confirmado, refactorización que consolida tests equivalentes, o脱水 de features eliminadas del producto.

**Incorrecto:**
```csharp
// Se elimina un test de integración porque "tarda mucho"
// Sin documentar la razón ni crear un alternativa ❌
```

**Correcto:**
```csharp
// El test de integración lento se reemplaza por un test unitario
// que cubre la misma lógica de negocio. Se documenta el motivo:

// Reemplazado Test_Integracion_Completa_Flux por
// Test_Handler_CreateCompany_ValidData por rendimiento.
// La lógica de negocio está cubierta por el test unitario.
```

### ❌ No ignorar ramas o métodos para forzar un porcentaje de cobertura

Excluir código de la medición de cobertura (`[ExcludeFromCodeCoverage]`) solo está permitido en código de infraestructura pura (mappers auto-generados, configuración de DI, seeders). Nunca se debe excluir lógica de negocio o handlers.

**Incorrecto:**
```csharp
[ExcludeFromCodeCoverage] // ❌ Handler con lógica de negocio
public class CreateCompanyHandler : ICommandHandler<CreateCompanyCommand, Result<CreateCommandResponse>>
```

**Correcto:**
```csharp
[ExcludeFromCodeCoverage] // ✅ Auto-generated mapper
public class MappingProfile : Profile
```

---

## Calidad de los Tests

### ❌ No escribir tests triviales que no verifican comportamiento

Un test que solo verifica que el código no lanza una excepción, sin assertions sobre el resultado, no aporta valor. Cada test debe verificar al menos un comportamiento observable.

**Incorrecto:**
```csharp
[Fact]
public async Task CreateCompany_DoesNotThrow()
{
    var command = new CreateCompanyCommand(...);
    await _mediator.Send(command); // ❌ Sin assertions
}
```

**Correcto:**
```csharp
[Fact]
public async Task CreateCompany_WithValidData_ReturnsSuccess()
{
    var command = new CreateCompanyCommand(...);

    var result = await _mediator.Send(command);

    result.IsSuccess.Should().BeTrue();
    result.Value.Id.Should().NotBeEmpty();
}
```

### ❌ No acoplar tests a la implementación interna

Los tests deben verificar el comportamiento observable (salida, estado, efectos), no los detalles internos (nombre de campos privados, orden de llamadas internas). Esto permite refactorizar sin romper tests.

**Incorrecto:**
```csharp
// Verificar cuántas veces se llama a un método interno ❌
mockService.Verify(x => x.InternalMethod(), Times.Exactly(2));
```

**Correcto:**
```csharp
// Verificar el resultado observable del comportamiento ✅
result.IsSuccess.Should().BeTrue();
result.Value.Status.Should().Be(CompanyStatus.Active);
```

### ❌ No compartir estado mutado entre tests

Cada test debe ser independiente. Si un test modifica datos que otro test necesita, el orden de ejecución afecta el resultado. Usar fixtures de reseteo o datos aislados por test.

**Incorrecto:**
```csharp
private static readonly Company _sharedCompany = Company.Create(...).Data; // ❌ Estado compartido mutado

[Fact]
public void Test1() => _sharedCompany.Deactivate();

[Fact]
public void Test2() => _sharedCompany.IsActive.Should().BeTrue(); // ❌ Depende del orden de ejecución
```

**Correcto:**
```csharp
[Fact]
public void Deactivate_SetsIsActiveToFalse()
{
    var company = Company.Create(...).Data; // ✅ Instancia fresca por test

    company.Deactivate();

    company.IsActive.Should().BeFalse();
}
```

---

## Tests y Refactorización

### ❌ No refactorizar código productivo sin verificar que los tests existentes pasan

Antes de refactorizar, ejecutar los tests para confirmar que pasan. Tras cada paso de la refactorización, volver a ejecutarlos. Si un test falla tras un paso, deshacer inmediatamente. Los tests son la red de seguridad de la refactorización.

### ❌ No modificar el comportamiento del código productivo y de los tests en el mismo commit

Si se cambia el comportamiento intencionado, primero actualizar los tests para reflejar el nuevo comportamiento esperado (deben fallar), luego modificar el código productivo (deben pasar). Esto sigue el ciclo Red-Green-Refactor.

---

## Código Productivo y Tests

Cuando un test falla o no compila tras un cambio OpenSpec, clasificar la causa antes de tocar nada. El código productivo es la fuente de verdad del comportamiento; los tests lo verifican, no lo dictan.

### ❌ No adaptar el código productivo para que los tests pasen

Si un test falla por un cambio **intencionado** (refactor, renombrado, nueva firma, eliminación de código obsoleto), la respuesta correcta es actualizar o eliminar el test para reflejar el nuevo contrato. No debilitar, rodear o falsear el código productivo para complacer al test heredado.

**Incorrecto:**
```csharp
// Tras unificar el pipeline de eventos, un test viejo sigue llamando a NotificationDispatcher (eliminado).
// Se reconstruye NotificationDispatcher o se reactiva código muerto solo para que compile el test ❌
```

**Correcto:**
```csharp
// El test referenciaba un colaborador eliminado por diseño (sección BREAKING del cambio).
// Se elimina el test obsoleto y se crea uno nuevo que verifique el nuevo flujo (handler del
// ITransactionalDomainEvent) ✅
```

### ❌ No restaurar código eliminado intencionalmente solo para satisfacer tests heredados

Si un test tira de tipos, métodos o servicios que el cambio OpenSpec eliminó (sección "Deleted" del `proposal.md`, archivos marcados con `(DELETE)` en `tasks.md`, o `implementation.md`), dar por hecho que esa eliminación es **intencional**. Reescribir o eliminar el test según el nuevo contrato; NUNCA revivir el código eliminado.

**Señal de alarma**: un test no compila porque referencia `X`, `X` está marcado como DELETED en el cambio, y la "solución" consiste en restaurar `X`. Eso es una violación del contrato del cambio.

### ✅ Sí corregir el código productivo cuando el test revela un bug real

No confundir "no degradar el código" con "no tocar el código". Si un test falla porque expone un defecto real (lógica incorrecta, edge case no cubierto, error code erróneo, off-by-one, ruta de retorno equivocada), la corrección va en el código productivo y se mantiene/añade la aserción que lo documenta como test de regresión.

**Distinción obligatoria antes de editar:**

| Causa del fallo | Dónde corregir |
|---|---|
| Cambio INTENCIONADO por el cambio OpenSpec (refactor, breaking change, API renombrada, código eliminado) | El **test**: reescribir o eliminar, y crear el test del nuevo contrato si procede |
| Bug INTRODUCIDO o PREEXISTENTE expuesto por el test | El **código productivo**: corregir + añadir/conservar test de regresión |
| Test obsoleto (feature eliminada del producto) | El **test**: eliminar; crear sustituto solo si la feature fue reemplazada por otra |
| Setup del test desactualizado (factorías, builders, datos seed) | El **test**: actualizar el setup, preservando las aserciones originales |

### ❌ No neutralizar aserciones para falsear el éxito

Actualizar el setup (nombres, factories, dependencias inyectadas) está permitido. Debilitar la aserción (esperar lo que sea que devuelva el código) está prohibido. Si la aserción original ya no describe el comportamiento correcto, reescribir el test completo para describir el comportamiento esperado actual; no neutralizar la aserción para "salir del paso".

**Incorrecto:**
```csharp
result.Should().BeAssignableTo<Result>(); // ❌ Aserción trivial para que pase siempre
```

**Correcto:**
```csharp
result.IsSuccess.Should().BeTrue();
result.Value.Notifications.Should().ContainSingle(n => n.Type == UserChangeTemporaryNotification.Code);
```

---

## Nombres y Organización

### ❌ No usar nombres ambiguos en los tests

El nombre del test debe describir el escenario, la acción y el resultado esperado. Nombres como `Test1`, `Handle_Valid`, o `CreateTest` no comunican la intención.

**Incorrecto:**
```csharp
[Fact]
public void Handle_Valid() { } // ❌ ¿Qué hace? ¿Qué espera?
```

**Correcto:**
```csharp
[Fact]
public void CreateCompany_WithDuplicateCif_ReturnsDuplicateFailure() { } // ✅ Escenario, acción, resultado
```

### ❌ No duplicar lógica de setup compleja en cada test

Si varios tests comparten preparación de datos compleja, extraerla a un builder, factory o fixture. La repetición de setup complejo dificulta el mantenimiento y oculta lo que realmente se está testeando.

**Incorrecto:**
```csharp
[Fact]
public void Test1()
{
    var company = Company.Create("Name", "B12345678", Address.Create("Calle", "1", "Madrid", "28001").Data).Data;
    var user = ExternalUser.Create("John", "Doe", null, "john@doe.com", "Pass1!", company).Data;
    // ... test ...
}

[Fact]
public void Test2()
{
    var company = Company.Create("Name", "B12345678", Address.Create("Calle", "1", "Madrid", "28001").Data).Data;
    var user = ExternalUser.Create("John", "Doe", null, "john@doe.com", "Pass1!", company).Data;
    // ... mismo setup repetido ❌
}
```

**Correcto:**
```csharp
private static ExternalUser CreateTestUser(string? email = null)
{
    var company = Company.Create("Name", "B12345678", Address.Create("Calle", "1", "Madrid", "28001").Data).Data;
    return ExternalUser.Create("John", "Doe", null, email ?? "john@doe.com", "Pass1!", company).Data;
}

[Fact]
public void Test1()
{
    var user = CreateTestUser();
    // ... test ...
}

[Fact]
public void Test2()
{
    var user = CreateTestUser(email: "other@doe.com"); // ✅ Solo varía lo relevante
    // ... test ...
}
```
