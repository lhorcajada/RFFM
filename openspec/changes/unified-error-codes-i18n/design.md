## Context

- Middleware central: `Hellang.Middleware.ProblemDetails`, configurado en `ServiceCollectionExtensions.AddCustomProblemDetails()` y registrado en `RFFM.Host/Startup.cs`.
- `DomainException` (`Domain/DomainException.cs`) ya tiene `Code` (string libre) y el mapping a 400 ya hace `Extensions["code"] = exception.Code`. El problema es de **disciplina de llamada**, no de la forma del contrato: 44 usos en 26 archivos, muchos con `code: ""` y al menos dos (`ToggleSkillMastered.cs`, `GetSubSubPrinciple.cs`, `UploadExerciseMedia.cs`) pasan `request.Id`/`request.SkillId` (un GUID) como `code`.
- **Bug descubierto durante el diseño**: `ValidationBehavior.cs` lanza `System.ComponentModel.DataAnnotations.ValidationException` (alias explícito en el `using` del archivo), pero `ServiceCollectionExtensions.cs` mapea `FluentValidation.ValidationException` (por el `using FluentValidation;` del archivo) a 400. Son dos tipos distintos con el mismo nombre corto: hoy **los errores de validación de FluentValidation no caen en el mapping de 400**, caen en el catch-all `Exception` → 500. Esto hay que arreglarlo para que el `code` de validación tenga sentido.
- `ArgumentNullException` está mapeada a 400 sin `code`.
- Registro (`CreateUser.cs`): valida alias duplicado a mano (409, sin `code`), pero el email duplicado no se comprueba antes de `_userManager.CreateAsync`; si Identity lo rechaza (`IdentityError.Code == "DuplicateEmail"`), hoy se aplana a un string en `Detail` sin `code` estructurado.
- Frontend ya tiene un mapeo manual código→mensaje: `Front/src/apps/coach/utils/errorMessages.ts` (`errorMessagesEs` + `mapApiErrorToMessage`), consumido por `CoachAuthContext`, `Register`, `ForgotPassword`, `ResetPassword`. Solo español, sin librería i18n, ubicado bajo `apps/coach` aunque las páginas que lo usan viven en `shared/pages/auth`.
- Presentación de errores hoy es por componente: `Register` pinta un `Alert` MUI encima del formulario con `formError`; otras pantallas usan el snackbar global (`window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }))`, montado en `App.tsx` vía `GlobalSnackbar.tsx`).

## Goals / Non-Goals

**Goals:**
- Todo error backend con status 400 expone `Extensions["code"]` no vacío, con un catálogo central como fuente de verdad (evita duplicados/typos y valores accidentales tipo GUID).
- Arreglar el mismatch de tipos que hace que las validaciones de FluentValidation caigan en 500 en vez de 400.
- `POST /api/register` devuelve `code: "EmailIsAlreadyTaken"` cuando el email ya existe.
- Frontend con `react-i18next` (ES/EN) sustituyendo el mapeo manual actual, expuesto como utilidad/hook reusable sin imponer una única forma de presentación (cada componente decide Alert vs. toast).

**Non-Goals:**
- Status 401/403/409/500 quedan fuera de este cambio (el usuario pidió expresamente status 400). El 409 de alias duplicado en `CreateUser` se queda como está; se documenta como candidato para una extensión futura.
- No se unifica la presentación de errores (Alert vs. toast) — sigue siendo decisión de cada pantalla.
- No se traducen mensajes de éxito ni el resto de textos de la UI (i18n de toda la app) — solo el catálogo de errores.
- No se re-arquitecturan `FeaturePermissionBehavior`/`CachingBehavior` ni otros pipeline behaviors.

## Decisions

### 1. Catálogo central de códigos en backend: `Domain/ErrorCodes.cs`
Clase estática con constantes `string` en PascalCase estilo evento (`EmailIsAlreadyTaken`, `ValidationFailed`, `AccessDenied`, `ResourceNotFound`, ...), agrupadas por comentario de feature. `DomainException` sigue aceptando `string code` (no se cambia su forma), pero todos los call sites pasan `ErrorCodes.X` en vez de literales. **Por qué:** `Code` ya es `string` por diseño (ver `DomainException.cs`); un enum obligaría a un cast/`.ToString()` en cada excepción y no aporta frente a constantes + un único archivo que documenta todos los codes existentes. **Alternativa:** enum `ErrorCode` — descartada porque el constructor de `DomainException` ya está fijado a `string` y cambiarlo es un breaking change innecesario para este alcance.

### 2. Auditoría de los 44 usos existentes de `DomainException`
Cada uso con `code: ""` recibe un `ErrorCodes.X` específico a su mensaje (ej. `"No tienes acceso a este equipo."` → `ErrorCodes.TeamAccessDenied`); los que reciben un GUID por error (`ToggleSkillMastered.cs`, `GetSubSubPrinciple.cs`, `UploadExerciseMedia.cs`) se corrigen a un `code` real (el GUID se queda solo en `Detail`/mensaje si es útil para debug). Se reutiliza el mismo `code` cuando el mensaje es conceptualmente el mismo error repetido en varios features (ej. "No tienes acceso a este X" → un único `ErrorCodes.ResourceAccessDenied` genérico en vez de 10 variantes), salvo que el frontend necesite distinguirlos para un mensaje distinto.

### 3. Arreglar el mismatch de `ValidationException` y unificar su `code`
`ValidationBehavior.cs` sigue lanzando el mismo tipo (`System.ComponentModel.DataAnnotations.ValidationException`) pero ahora se mapea ESE tipo en `ServiceCollectionExtensions.cs` (quitar el `using FluentValidation;` ambiguo del mapping o calificar completamente `System.ComponentModel.DataAnnotations.ValidationException` en el `setup.Map<>`). El `code` para toda validación fallida es `ErrorCodes.ValidationFailed` (código único), y el detalle por campo (`PropertyName: ErrorMessage` ya concatenado hoy) se mantiene en `Detail` más un nuevo `Extensions["errors"]` con la lista estructurada `[{ field, message }]` para que el frontend pueda, si quiere, resaltar el campo concreto (sin necesidad de un `code` por regla de validación — no está en el alcance dar granularidad campo-a-campo del catálogo). **Por qué no un `code` por regla:** habría que auditar y traducir cientos de reglas `RuleFor(...)` de FluentValidation en todo el repo; desproporcionado para este cambio, y el mensaje real de validación (obligatorio, formato, longitud) no necesita traducción código-a-código como los errores de negocio.

### 4. `ArgumentNullException` → `ErrorCodes.MissingRequiredArgument`
Un único `code` genérico (no es un error de negocio, es un guard de programación defensiva que no debería llegar a producción con frecuencia).

### 5. Email duplicado en registro
`CreateUser.Handler` comprueba `_userManager.FindByEmailAsync(request.Email)` **antes** de `CreateAsync` (igual que ya hace con el alias), y devuelve `400` con `ProblemDetails { Title = "Email ya registrado", Detail = "...", Extensions["code"] = ErrorCodes.EmailIsAlreadyTaken }`. Se mantiene el `Results.BadRequest(new ProblemDetails{...})` manual (no se convierte a `DomainException`) porque este endpoint ya construye sus `ProblemDetails` a mano para varios casos (accountType inválido, alias duplicado); por consistencia con el propio archivo, se añade `Extensions` a esos `ProblemDetails` manuales también (`AccountTypeRequired`, `AliasIsAlreadyTaken`) aunque el alcance pedido es solo 400 — el de alias es 409 y se deja para el futuro (Non-Goal), pero `accountType inválido` sí es 400 y entra en este cambio.

### 6. Frontend: `react-i18next` + catálogo ES/EN de errores
Nueva dependencia `react-i18next` + `i18next`, inicializada en `Front/src/shared/i18n/i18n.ts` con namespace `errors` y dos locales: `Front/src/shared/i18n/locales/es/errors.json`, `Front/src/shared/i18n/locales/en/errors.json`. Las claves son exactamente los `code` del backend (`EmailIsAlreadyTaken`, `ValidationFailed`, etc.) más las claves genéricas ya existentes en `errorMessagesEs` (`BadRequest`, `ServerError`, `NetworkError`, `TimeoutError`, ...) para no perder cobertura. **Por qué react-i18next y no una tabla propia:** es el estándar de facto en React, soporta interpolación/pluralización si hace falta más adelante, y evita reinventar detección de idioma; el proyecto no tenía ninguna dependencia i18n previa así que no hay conflicto de migración.

### 7. Relocalizar y generalizar `errorMessages.ts`
Se mueve `Front/src/apps/coach/utils/errorMessages.ts` a `Front/src/shared/utils/errorMessages.ts` (los 4 consumidores actuales viven en `shared/pages/auth/*` o cruzan apps, así que pertenece a `shared`, no a `coach`). Se sustituye el objeto `errorMessagesEs` por `t(\`errors:${code}\`)` de i18next, manteniendo la misma firma pública `mapApiErrorToMessage(error): string` para minimizar el diff en los 4 consumidores (Register, ForgotPassword, ResetPassword, CoachAuthContext). Se añade `useApiErrorMessage()` (hook) como alias fino sobre `mapApiErrorToMessage` para componentes que prefieran el patrón hook.

### 8. El interceptor de Axios (`client.ts`) no cambia su comportamiento de 401/500
Sigue gestionando `401`→logout+evento y `500`→`/error-500` igual que hoy. La lectura de `code`/`detail` del body para 400 se hace en el punto de consumo (`mapApiErrorToMessage(error)` llamado en el `catch` de cada página/hook), no en el interceptor global, porque el interceptor no sabe si el componente quiere mostrar un `Alert` o un toast — decisión ya tomada como Non-Goal (no unificar presentación).

## Risks / Trade-offs

- [Arreglo del mismatch `ValidationException`] → hoy las validaciones de FluentValidation devuelven 500; al arreglarlo pasarán a devolver 400 correctamente. Esto es un fix de bug, pero cualquier código de frontend que dependiera (incluso accidentalmente) del 500 actual para validaciones se verá afectado. Mitigación: revisar tests de integración existentes que ejerciten validadores antes de mergear.
- [Migración de 44 call sites] → riesgo de introducir un typo nuevo al asignar codes; mitigación: `ErrorCodes.cs` como única fuente (constantes, no strings sueltos) y `dotnet build` falla si se referencia un nombre que no existe.
- [Reducir 10+ variantes de "No tienes acceso a X" a codes genéricos compartidos] → el frontend pierde granularidad para distinguir "no tienes acceso a este ejercicio" vs. "a este club"; mitigación: el `Detail`/`Title` (ya traducidos en español desde el backend) siguen siendo específicos, el `code` compartido solo determina la clave de traducción base, se puede usar `Detail` como fallback si `code` no está en el catálogo frontend.
- [`react-i18next` nueva dependencia] → aumenta bundle size; mitigación: solo se usa para el namespace `errors` inicialmente (no se traduce el resto de la UI), impacto de bundle pequeño (~15-20kb gzip de i18next core).

## Migration Plan

1. **Back**: crear `ErrorCodes.cs`; arreglar el mapping de `ValidationException` (bug); migrar los 44 usos de `DomainException` a `ErrorCodes.X`; añadir `code` a `ArgumentNullException`; añadir detección de email duplicado en `CreateUser.cs`. Deploy trasero — cambio de contrato aditivo (`code` es un campo nuevo en `Extensions`, nadie lo consumía antes salvo el frontend hand-rolled que ya esperaba `error.response.data.code`).
2. **Front**: instalar `react-i18next`; crear `shared/i18n/` con locales ES/EN; mover y adaptar `errorMessages.ts` a `shared/utils/`; actualizar los 4 imports; poblar el diccionario con los `code` reales que ya emite el backend tras el paso 1.
3. **Sincronización**: como el frontend ya leía `error.response.data.code` de forma ad-hoc, el `code` nuevo del backend no rompe nada aunque se despliegue antes que el frontend — simplemente los codes nuevos caerán en el fallback (`Detail`) hasta que el frontend los añada al diccionario.
4. **Rollback**: revertir front (vuelve a `errorMessagesEs` hardcodeado) y/o back (revertir `ErrorCodes.cs` y el fix de `ValidationException` restaura el comportamiento actual, incluido el bug de 500). Sin migraciones de esquema.

## Open Questions

- ¿Se deja algún test de regresión explícito para el bug de `ValidationException` (hoy 500, pasa a 400)? Tentativo: sí, un test de integración en `back-specialist` que valide que un comando con validator falla con 400 y `code=ValidationFailed`.
- ¿El detalle de la nomenclatura para los ~10 "No tienes acceso a X" — un único `ErrorCodes.ResourceAccessDenied` o varios (`TeamAccessDenied`, `ExerciseAccessDenied`, etc.)? Tentativo: agrupar por tipo de recurso (varios codes, no uno genérico) porque el frontend probablemente quiera mensajes distintos ("no tienes acceso a este equipo" vs. "a este ejercicio"), a resolver en la tarea de auditoría del backend.
