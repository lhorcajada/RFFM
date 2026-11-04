# Reglas de Testing — CVL.SmartLocks

Reglas obligatorias para la creación y modificación de tests.
Basadas en TDD (Test-Driven Development) y los patrones existentes del proyecto.

---

## 1. Filosofía TDD

### 1.1 Ciclo Red-Green-Refactor
- **Red**: escribe el test que define el comportamiento deseado. El test debe fallar.
- **Green**: escribe el código mínimo de producción que hace pasar el test.
- **Refactor**: mejora el código manteniendo los tests en verde.
- **Nunca** escribir código de producción sin un test que lo justifique.
- **Nunca** saltar el paso Red. Si el test no falla primero, no es TDD.

### 1.2 Orden de trabajo
1. Escribir el test (o los tests de caso fallido) para la nueva funcionalidad.
2. Verificar que el test falla (Red).
3. Implementar el código de producción mínimo para que pase (Green).
4. Ejecutar los tests y verificar que pasan.
5. Refactorizar si es necesario, manteniendo todos los tests en verde.
6. Añadir tests adicionales para edge cases y casos límite.

### 1.3 Qué testear primero
- Empezar por los casos fallidos de validación (input inválido, reglas de negocio violadas).
- Luego escribir el caso de éxito (happy path).
- Finalmente añadir edge cases y escenarios de borde.

---

## 2. Estructura de proyectos de test

### 2.1 Proyectos
| Proyecto | Ámbito | Tipo |
|---|---|---|
| `CVL.SmartLocks.Domain.Tests` | Lógica de dominio (entidades, VOs, reglas) | Unit |
| `CVL.SmartLocks.FunctionalTests` | Endpoints API, integración completa | Integration |

### 2.2 Ubicación de tests
- Un archivo de test por entidad/feature:
  - Dominio: `tests/CVL.SmartLocks.Domain.Tests/{Agregado}/{Entidad}Tests.cs`
  - Funcional: `tests/CVL.SmartLocks.FunctionalTests/Features/{Feature}/{CasoDeUso}Tests.cs`
- Los tests siguen la misma estructura de carpetas que el código de producción.

---

## 3. Tests de Dominio (Unit Tests)

### 3.1 Base class
- Heredar de `TestBase` (`CVL.SmartLocks.Domain.Tests.Infrastructure.TestBase`).
- `TestBase` expone `Given` para construir datos de prueba.

### 3.2 Given (Arrange)
- Usar la clase `Given` y sus extensiones para construir datos de prueba:
  - `Given.AValidUser()` → entidad válida lista para usar.
  - `Given.UserWithName(invalidName)` → caso fallido para nombre.
  - `Given.UserWithEmail(invalidEmail)` → caso fallido para email.
- Crear nuevas extensiones en `Infrastructure/Givens/Given*.cs` cuando se añadan nuevas entidades.
- Las extensiones `Given` encapsulan la construcción de datos, evitando duplicación.

### 3.3 Nomenclatura
- **Método de test**: `{Entidad}_{Operación}_Should_{Resultado}_When_{Condición}`
- Ejemplos:
  - `User_Create_Should_Failed_When_Name_Is_Not_Valid`
  - `User_Create_Should_Be_Successful`
  - `ValidityWindow_Create_with_inverted_range_should_fail`
- Los nombres deben ser descriptivos y leerse como una frase completa.

### 3.4 Patrón de casos fallidos con Theory
- Usar `[Theory]` + `[MemberData]` para probar múltiples casos de error del mismo tipo:
  ```
  [Theory]
  [MemberData(nameof(UserCreateWithEmailFailedCases))]
  public async Task User_Create_Should_Failed_When_Email_Is_Not_Valid(
      Func<Given, UserCreateCaseFailedResult> caseFunc)
  ```
- Definir un `record` para encapsular el resultado esperado:
  ```
  public record UserCreateCaseFailedResult(
      DomainCreateOutcome<ExternalUser> User,
      DomainOutcomeReason ReasonExpected);
  ```
- Los datos de prueba usan `Func<Given, T>` para permitir lazy evaluation y reutilización del `Given`.

### 3.5 Patrón de casos de éxito con Fact
- Usar `[Fact]` para el happy path y escenarios únicos.
- Verificar que `CouldBeCreated` / `IsSuccess` es `true`.
- Verificar los valores de las propiedades resultantes:
  ```
  scheduleGeneral.CouldBeCreated.Should().BeTrue();
  scheduleGeneral.Data.AllDay.Should().Be(true);
  ```

### 3.6 Aserciones
- Usar `Dorlet.FluentAssertion.Extensions` (extiende FluentAssertions).
- Para resultados fallidos: verificar `CouldNotBeCreated.Should().BeTrue()` y `Reason.Info.Key.Should().Be(expectedKey)`.
- Para resultados de éxito: verificar `CouldBeCreated.Should().BeTrue()` y las propiedades del resultado.
- Nunca usar `Assert.True` / `Assert.Equal` directamente; preferir FluentAssertions.

### 3.7 Qué testear en dominio
- Creación de entidades (`Create()`) con datos válidos e inválidos.
- Modificaciones a través de métodos de intención (`UpdateEmail`, `Cancel`, `Lock`).
- Value Objects: validación de `Create()`, comportamiento de métodos (`Contains`, `Overlaps`).
- Reglas de negocio encapsuladas en la entidad.
- **No** testear setters privados, constructores sin parámetros ni infraestructura.

---

## 4. Tests Funcionales (Integration Tests)

### 4.1 Base class
- Heredar de `TestsBase` (`CVL.SmartLocks.FunctionalTests.Infrastructure.TestsBase`).
- Constructor primario con `ApiFixture fixture`.
- `TestsBase` expone `Server`, `Services`, `SendResponseAsync<TController>()`.

### 4.2 Given (Arrange)
- Usar `Server.Given()` y sus extensiones para sembrar datos en la BD:
  - `await Server.Given().AUser()` → crea y persiste un usuario.
  - `await Server.Given().ASite()` → crea y persiste un sitio.
- Los métodos `Given` funcionales son asíncronos porque escriben en la BD real.
- Crear nuevas extensiones en `Infrastructure/Givens/Given*.cs` del proyecto funcional.

### 4.3 Permisos
- Cada test funcional que prueba autorización debe definir `protected override string? Permission`.
- Usar `TestRequestOptions` para configurar la petición:
  - `WithIdentity = true/false` → simular usuario autenticado.
  - `WithPermissions = true/false` → simular permisos.
  - `CheckResponseCode = false` → cuando se espera un error HTTP.

### 4.4 Nomenclatura
- **Método de test**: `{Operación}_{Recurso}_should_{comportamiento}`
- Ejemplos:
  - `Update_user_should_not_allow_anonymous_users`
  - `Unassign_returns_success_when_target_user_is_already_unassigned`
  - `NewOtp_ShouldReturnSuccess_WhenExternalUserExists_AndOtpNotUsed`
- En minúscula o PascalCase, consistente con el archivo.

### 4.5 Patrón de envío de peticiones
- Definir un helper privado que construye y envía la petición HTTP:
  ```
  private Task<HttpResponseMessage> UpdateResponseAsync(
      Guid id, UpdateUserCommand request, TestRequestOptions? options = null)
      => SendResponseAsync<UsersController>(
          controller => controller.Update(id, request),
          options: options ?? new() { CheckResponseCode = true, WithIdentity = true });
  ```
- Siempre usar `SendResponseAsync<TController>()` para invocar el controlador.

### 4.6 Qué testear en funcional
- Autorización: usuarios anónimos → `401 Unauthorized`; sin permisos → `403 Forbidden`.
- Validación de entrada: datos inválidos → `400 BadRequest` con mensaje de error.
- Happy path: código de estado correcto, datos de respuesta esperados.
- Efectos laterales: cambios en la BD, emails enviados, notificaciones.
- Reglas de negocio completas: flujos que cruzan dominio + infraestructura.
- **No** testear lógica pura de dominio en tests funcionales (va en Domain.Tests).

### 4.7 Verificación de estado en BD
- Para verificar cambios persistidos, usar `Server.Given().DbContextExecuteAsync()`:
  ```
  var stored = await Server.Given().DbContextExecuteAsync(
      db => db.ExternalUserOtpRequests,
      requests => requests.SingleAsync(r => r.Id == id));
  ```
- No asumir estado; siempre consultar la BD real del test.

### 4.8 Mocks
- Usar los mocks disponibles en `Shared/Infrastructure/Mocks/` (e.g., `GetEmailSenderMock()`).
- Limpiar mocks entre tests: `emailSender.Clear()`.
- No crear mocks manuales con `Moq`; usar la infraestructura existente.

---

## 5. Reglas generales

### 5.1 Evitar tests triviales
- No testear getters/setters simples, constructores vacíos, o mapeos directos.
- No testear Framework (EF Core, ASP.NET Core) a menos que se pruebe comportamiento propio.

### 5.2 Un test, un comportamiento
- Cada test verifica un único comportamiento o regla de negocio.
- Si un test necesita múltiples aserciones, deben estar relacionadas con el mismo comportamiento.
- No usar aserciones irrelevantes que no aportan valor al caso probado.

### 5.3 Determinismo
- Los tests deben ser deterministas: mismas entradas → mismo resultado.
- No depender de `DateTime.Now`; usar fechas fijas o `DateTime.UtcNow` con tolerancia.
- No depender del orden de ejecución de los tests.

### 5.4 Independencia
- Cada test debe ser independiente; no asumir el estado dejado por otro test.
- El fixture (`ApiFixture`) gestiona el ciclo de vida de la BD para tests funcionales.
- En Domain.Tests, crear datos frescos con `Given` en cada test.

### 5.5 No testear implementación
- Testear comportamiento observable, no detalles internos.
- Si se cambia la implementación, los tests no deberían romperse (a menos que cambie el comportamiento).
- No hacer `Verify` sobre llamadas internas del handler; verificar el resultado final.

### 5.6 Tests y refactorización
- Al refactorizar, los tests existentes deben seguir pasando sin cambios.
- Si un test necesita cambiar por un refactor, probablemente estaba testeando implementación.
- Añadir tests nuevos solo si el refactor introduce nuevo comportamiento.

---

## 6. Flujo TDD por tipo de cambio

### 6.1 Nueva feature (vertical slice completo)
1. Escribir tests de dominio para la nueva entidad/VO.
2. Escribir tests funcionales para el nuevo endpoint (autorización + validación + happy path).
3. Implementar Command/Query, Handler, Validator, Resources.
4. Verificar que todos los tests pasan.
5. Añadir tests de edge cases.

### 6.2 Modificación de regla de negocio existente
1. Escribir un test que capture el nuevo comportamiento esperado.
2. Verificar que el test falla con el código actual (Red).
3. Modificar la lógica de dominio para que el test pase (Green).
4. Verificar que los tests existentes siguen pasando (regresión).
5. Refactorizar si es necesario.

### 6.3 Bug fix
1. Escribir un test que reproduzca el bug (debe fallar).
2. Corregir el código de producción.
3. Verificar que el test pasa (Green).
4. Verificar que no hay regresiones.

---

## 7. Ejecución de tests

### 7.1 Comandos
- Todos los tests: `dotnet test`
- Con verbose: `dotnet test --logger "console;verbosity=minimal"`
- Solo Domain.Tests: `dotnet test tests/CVL.SmartLocks.Domain.Tests`
- Solo FunctionalTests: `dotnet test tests/CVL.SmartLocks.FunctionalTests`
- Un test específico: `dotnet test --filter "{NombreCompletoDelTest}"`

### 7.2 Ejecutar antes de commit
- Ejecutar siempre los tests del área afectada antes de hacer commit.
- Si se modifica dominio: ejecutar Domain.Tests.
- Si se modifica un handler/controller: ejecutar FunctionalTests del feature afectado.
- Si se modifica infraestructura compartida: ejecutar todos los tests.

### 7.3 Tests ignorados
- Si un test se marca como `[Fact(Skip = "...")]`, el motivo debe ser claro y temporal.
- Revisar periódicamente los tests saltados y reactivarlos o eliminarlos.
