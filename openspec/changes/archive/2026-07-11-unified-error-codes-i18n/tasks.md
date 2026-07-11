## 1. Backend — catálogo de codes + fix del mismatch de ValidationException

- [x] 1.1 Crear `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs` con constantes `string` PascalCase agrupadas por feature (Auth, Users/Register, GameModels, Trainings, Teams, Seasons, Scopes, Validation genérico). Incluir al menos: `ValidationFailed`, `MissingRequiredArgument`, `EmailIsAlreadyTaken`, `AccountTypeRequired`.
- [x] 1.2 En `ServiceCollectionExtensions.AddCustomProblemDetails()`: corregir el mapping de `ValidationException` para que apunte al tipo realmente lanzado por `ValidationBehavior.cs` (`System.ComponentModel.DataAnnotations.ValidationException`, no `FluentValidation.ValidationException`). Añadir `Extensions["code"] = ErrorCodes.ValidationFailed` y `Extensions["errors"]` con la lista `[{ field, message }]` construida desde el mensaje/errores de validación.
- [x] 1.3 Añadir `Extensions["code"] = ErrorCodes.MissingRequiredArgument` al mapping de `ArgumentNullException`.
- **Verify**: `dotnet build`. Test xUnit nuevo (Red→Green) en `RFFM.Api.Tests` que ejecute un `ICommand` con un validator que falle y assert `response.StatusCode == 400` y `problemDetails.Extensions["code"] == "ValidationFailed"` (cubre el bug fix).

## 2. Backend — auditoría de los 44 usos de `DomainException`

- [x] 2.1 Listar los 26 archivos con `new DomainException(...)` (`grep -rn "new DomainException(" Back/ExtractionApi/src/`) y agruparlos por mensaje/intención repetida (ej. "No tienes acceso a este X").
- [x] 2.2 Sustituir cada literal de `code` (incluidos los `""` y los que reciben `request.Id`/`request.SkillId` por error) por una constante de `ErrorCodes.cs`, creando codes nuevos donde falten y reutilizando uno existente cuando el mensaje sea conceptualmente el mismo error en distinto feature.
- [x] 2.3 Corregir específicamente los 3 casos que pasan un GUID como `code` (`ToggleSkillMastered.cs`, `GetSubSubPrinciple.cs`, `UploadExerciseMedia.cs`) — el id se queda solo en `Detail`, no en `code`.
- **Verify**: `dotnet build`; `grep -rn 'new DomainException(""' Back/ExtractionApi/src/` debe devolver 0 resultados.

## 3. Backend — email duplicado en registro

- [x] 3.1 Test xUnit (Red) en `CreateUser.Tests.cs`: `Handle` con un email ya existente debe devolver 400 con `code=EmailIsAlreadyTaken` y NO crear el usuario.
- [x] 3.2 En `CreateUser.Handler.Handle`: comprobar `_userManager.FindByEmailAsync(request.Email)` antes de `CreateAsync` (igual patrón que la comprobación de alias ya existente); devolver `Results.BadRequest(new ProblemDetails { Title = "Email ya registrado", Detail = $"Ya existe una cuenta con el email: {request.Email}", Extensions = { ["code"] = ErrorCodes.EmailIsAlreadyTaken } })`.
- [x] 3.3 Añadir `Extensions["code"] = ErrorCodes.AccountTypeRequired` al `ProblemDetails` manual de "Tipo de cuenta requerido" (ya es 400, entra en el alcance).
- **Verify**: `dotnet test --filter CreateUser` verde; `dotnet build`.

## 4. Backend — spec delta

- [x] 4.1 Escribir `openspec/changes/unified-error-codes-i18n/specs/unified-error-codes-i18n/spec.md` con los escenarios Gherkin-like (ADDED Requirements) para: contrato `code` en 400, `EmailIsAlreadyTaken`, `ValidationFailed`.
- **Verify**: revisión manual, no requiere build.

## 5. Frontend — instalar y configurar react-i18next

- [x] 5.1 `npm install react-i18next i18next` en `Front/`.
- [x] 5.2 Crear `Front/src/shared/i18n/i18n.ts` (init de i18next, namespace `errors`, idioma por defecto ES, detección simple por `navigator.language` con fallback ES) y `Front/src/shared/i18n/locales/{es,en}/errors.json` con TODAS las claves ya presentes en `errorMessagesEs` (`LoginUserNotRegistered`, `LoginInvalidPassword`, `LoginInvalidCredentials`, `InvalidToken`, `TokenExpired`, `UserAlreadyExists`, `EmailAlreadyExists`, `InvalidEmail`, `PasswordTooWeak`, `UserNotFound`, `InvalidResetToken`, `PasswordResetExpired`, `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `ServerError`, `ServiceUnavailable`, `NetworkError`, `TimeoutError`) más las nuevas del backend (`EmailIsAlreadyTaken`, `ValidationFailed`, `MissingRequiredArgument`, `AccountTypeRequired`, y los codes resultantes de la tarea 2 que el frontend necesite mostrar).
- [x] 5.3 Importar la inicialización de i18n en `Front/src/main.tsx` (o donde arranque la app), una sola vez.
- **Verify**: `npm run build`.

## 6. Frontend — relocalizar y adaptar `errorMessages.ts`

- [x] 6.1 Test Vitest (Red) `Front/src/shared/utils/__tests__/errorMessages.test.ts`: `mapApiErrorToMessage({ response: { data: { code: "EmailIsAlreadyTaken" } } })` devuelve el texto ES por defecto; cambiar idioma i18next a `en` y repetir → texto EN.
- [x] 6.2 Mover `Front/src/apps/coach/utils/errorMessages.ts` → `Front/src/shared/utils/errorMessages.ts`, sustituyendo el objeto `errorMessagesEs` por `i18next.t(\`errors:${code}\`, { defaultValue: detail || fallback })`, manteniendo la firma pública `mapApiErrorToMessage(error): string` y `getErrorMessage(code?, detail?): string`.
- [x] 6.3 Añadir `useApiErrorMessage()` (hook fino) en el mismo archivo o adyacente, para componentes que prefieran el patrón hook sobre la función pura.
- [x] 6.4 Actualizar los 4 imports (`CoachAuthContext.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`) a la nueva ruta `shared/utils/errorMessages`.
- **Verify**: `npm run test` (los 4 archivos que consumen el util) + `npm run build`.

## 7. Frontend — verificación manual end-to-end

- [x] 7.1 Con backend corriendo (`dotnet run --project src/RFFM.Host`) y frontend (`npm run dev`), registrar un usuario con un email ya existente en `/register` y confirmar que el `Alert` sobre el formulario muestra el mensaje traducido de `EmailIsAlreadyTaken` (no el `Detail` crudo del backend).
- [x] 7.2 Cambiar el idioma (mecanismo definido en 5.2) y repetir 7.1, confirmar el mensaje en inglés.
- [x] 7.3 Verificar que una pantalla que usa el snackbar global (no `Register`) sigue mostrando su error como toast, sin cambios de presentación.
- **Verify**: verificación manual, capturar resultado en el mensaje de cierre de la tarea (no hay test automatizado de UI end-to-end para esto en el alcance).

## 8. Cierre

- [x] 8.1 Actualizar `openspec/specs/spec.md`: añadir la convención de `code` en errores 400 y referenciar `unified-error-codes-i18n` como capability.
- [x] 8.2 `dotnet build && dotnet test` (backend) y `npm run build && npm run test` (frontend) en verde antes de mover el change a `archive/`.
