## ADDED Requirements

### Requirement: Contrato `code` en errores 400

El backend SHALL exponer un campo `code` no vacío en `ProblemDetails.Extensions["code"]` para toda respuesta de error con status `400`, tomado de un catálogo central (`RFFM.Api.Domain.ErrorCodes`) que es la única fuente de verdad de nombres de código válidos. Ningún `code` SHALL ser una cadena vacía ni un identificador (GUID) de entidad.

#### Scenario: DomainException expone un code del catálogo
- **WHEN** cualquier handler lanza `DomainException` con un `code` de `ErrorCodes`
- **THEN** el middleware de `ProblemDetails` responde `400` con `Extensions["code"]` igual a ese valor, no vacío y no un GUID

#### Scenario: Validación de FluentValidation expone code=ValidationFailed
- **WHEN** un `ICommand`/`IQueryApp` con un `Validator` (FluentValidation) falla su validación en `ValidationBehavior`
- **THEN** el pipeline lanza `System.ComponentModel.DataAnnotations.ValidationException` y el middleware de `ProblemDetails` responde `400` con `Extensions["code"] = "ValidationFailed"` (no `500`)
- **AND** `Extensions["errors"]` contiene una lista `[{ field, message }]` con un elemento por regla de validación fallida

#### Scenario: ArgumentNullException expone code=MissingRequiredArgument
- **WHEN** cualquier código lanza `ArgumentNullException` (guard de programación defensiva)
- **THEN** el middleware de `ProblemDetails` responde `400` con `Extensions["code"] = "MissingRequiredArgument"`

#### Scenario: Catálogo central sin duplicados accidentales
- **WHEN** se añade un nuevo `code` a un `DomainException`
- **THEN** el código SHALL referenciar una constante de `RFFM.Api.Domain.ErrorCodes` (no un literal string suelto), de forma que un typo o nombre inexistente falle en `dotnet build`

### Requirement: Email duplicado en registro

`POST /api/register` SHALL detectar que el email ya está registrado **antes** de invocar `UserManager.CreateAsync`, devolviendo `400` con un `code` estructurado en vez de aplanar el `IdentityError` a texto libre.

#### Scenario: Registro con email ya existente
- **WHEN** un usuario envía `POST /api/register` con un `Email` que ya pertenece a un `IdentityUser` existente
- **THEN** el sistema responde `400` con `ProblemDetails { Title = "Email ya registrado", Extensions["code"] = "EmailIsAlreadyTaken" }`
- **AND** NO se crea ningún `IdentityUser` nuevo (`UserManager.CreateAsync` no se invoca)

#### Scenario: Registro sin accountType válido
- **WHEN** un usuario envía `POST /api/register` sin `accountType` o con un valor distinto de `Coach`/`Directive`
- **THEN** el sistema responde `400` con `ProblemDetails { Title = "Tipo de cuenta requerido", Extensions["code"] = "AccountTypeRequired" }`

#### Scenario: Registro válido no afectado
- **WHEN** un usuario envía `POST /api/register` con `accountType` válido, `Alias` y `Email` no usados previamente
- **THEN** el sistema crea el usuario normalmente (sin cambios de comportamiento respecto al flujo existente de creación de suscripción free-trial y envío de email de confirmación)
