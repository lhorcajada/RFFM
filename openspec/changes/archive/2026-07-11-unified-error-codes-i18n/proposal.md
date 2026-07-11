## Why

Hoy el backend no tiene un contrato de error consistente para status 400. Solo `DomainException` añade una propiedad `code` (vía `Extensions["code"]`), pero de forma ad-hoc: hay 44 usos de `new DomainException(...)` en 26 archivos y muchos pasan `code: ""` (cadena vacía) o incluso un GUID (`request.Id`) como código. `ValidationException` y `ArgumentNullException`, ambas mapeadas a 400, no exponen ningún `code`. El caso más visible es el registro (`POST /api/register`): si el email ya existe, `UserManager.CreateAsync` devuelve un `IdentityError` (`DuplicateEmail`) que hoy se aplana a texto libre (`string.Join("; ", result.Errors...)`) sin `code` estructurado.

En frontend ya existe un mapeo manual código→mensaje en español (`Front/src/apps/coach/utils/errorMessages.ts`, usado en Login/Register/ForgotPassword/ResetPassword) pero: (a) vive bajo `apps/coach` aunque lo consumen páginas de `shared/pages/auth`, (b) solo soporta español, (c) no usa ninguna librería i18n, y (d) el interceptor de Axios (`Front/src/core/api/client.ts`) nunca lee `error.response.data` — cada página parsea el error por su cuenta.

## What Changes

- Backend: todo `DomainException`/`ValidationException`/`ArgumentNullException` mapeado a 400 expone un `code` no vacío en el `ProblemDetails.Extensions["code"]`, con un catálogo central de codes como fuente de verdad (evita duplicados/typos). Se audita y corrige los 44 usos existentes de `DomainException` con code vacío o incorrecto (`request.Id` usado como code).
- Backend: `CreateUser` (registro) devuelve `code: "EmailIsAlreadyTaken"` cuando el email ya existe (hoy solo valida alias duplicado; el duplicado de email no se detecta antes de `CreateAsync` y se pierde en el mensaje aplanado de Identity).
- Frontend: se instala `react-i18next` con catálogo ES/EN de `code → mensaje traducido`, sustituyendo `errorMessagesEs`/`mapApiErrorToMessage` (movidos de `apps/coach/utils` a `shared/`) por una utilidad/hook reusable que cualquier componente puede consumir.
- Frontend: el mecanismo de traducción es agnóstico de presentación — `Register` sigue mostrando el mensaje como `Alert` encima del formulario; el resto de pantallas lo siguen mostrando vía el snackbar global existente (`rffm.show_snackbar`). No se unifica la presentación, solo la traducción.

## Capabilities

### New Capabilities
- `unified-error-codes-i18n`: contrato de `code` para errores 400 (backend) + capa de traducción i18n ES/EN (frontend), reusable por cualquier feature futura.

### Modified Capabilities
<!-- No existen specs previas sobre error handling en openspec/specs/spec.md más allá de "usar ProblemDetails para todos los errores". -->

## Impact

- **Back**: `ServiceCollectionExtensions.AddCustomProblemDetails()`, `DomainException` (sin cambio de forma, ya tiene `Code`), los 26 archivos con `new DomainException(...)` con code vacío/incorrecto, `ValidationException`/`ArgumentNullException` mappings, y `CreateUser.cs` (detección de email duplicado).
- **Front**: nueva dependencia `react-i18next`, `Front/src/core/api/client.ts` (interceptor no cambia su comportamiento actual de 401/500, pero se añade una utilidad para leer `code` del body en cualquier punto de consumo), `Front/src/shared/utils/errorMessages.ts` (nueva ubicación), actualizar imports en `CoachAuthContext`, `Register`, `ForgotPassword`, `ResetPassword`.
- **Sin migraciones de esquema**: cambio de contrato de respuesta, no de modelo de datos.
