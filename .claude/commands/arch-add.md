---
description: Recoge una solicitud para añadir o estandarizar una pieza de arquitectura transversal (afecta a Front y Back a la vez, o a un patrón compartido dentro de una capa) y arranca el trabajo con OpenSpec y los agentes correctos.
---

Vas a recoger una solicitud de **pieza de arquitectura transversal** para FutbolBase (ej: unificar códigos de error + i18n, estandarizar paginación, correlation-id en logs, convención de caché, etc.). Esto es distinto de `/feature-request`: no es una funcionalidad de negocio nueva, es una convención/patrón que varias features van a compartir. NO implementes nada todavía.

## Contexto actual conocido del repo (no lo vuelvas a investigar salvo que algo no cuadre)

**Backend — errores:**
- Middleware central: `Hellang.Middleware.ProblemDetails`, configurado en `Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs` (`AddCustomProblemDetails()`) y registrado en `Back/ExtractionApi/src/RFFM.Host/Startup.cs` (`app.UseProblemDetails()`).
- Solo `DomainException` añade hoy una propiedad `code` machine-readable (`Extensions["code"] = exception.Code`). El resto de excepciones mapeadas (`UnauthorizedAccessException`, `ValidationException`, `ArgumentNullException`, etc.) solo ponen `Title`/`Detail`, sin `code`.
- Los endpoints declaran `.Produces<ProblemDetails>(StatusCodes.Status400BadRequest)` pero no construyen el ProblemDetails a mano: lanzan excepciones que captura el middleware central.
- `openspec/specs/spec.md` ya dice "Return RFC 7807 ProblemDetails for all errors" pero **no** documenta un estándar de `code` — solo existe el caso ad-hoc de `DomainException`.

**Frontend — errores e i18n:**
- No hay librería de i18n instalada (no hay `react-i18next` ni `locales/` ni nada similar).
- Cliente Axios único: `Front/src/core/api/client.ts`. El interceptor de respuesta hoy solo mira `error.response.status` (401 → logout + evento `rffm.auth_expired`; sin respuesta → `gotoErrorPage("timeout"|"network")`; 500 → `/error-500`). **Nunca lee el body del ProblemDetails** (`error.response.data`), así que no hay extracción de `title`/`detail`/`code` en ningún sitio.

Si el usuario pide justamente "unificar error codes + i18n" (el caso de ejemplo), esto es la brecha real: falta (a) que TODAS las excepciones del backend expongan `code`, y (b) toda la capa de traducción en frontend (librería i18n + diccionario de `code` → mensaje traducido + el punto donde el interceptor/consumidor de errores lee `code` del ProblemDetails).

## Flujo

1. Si el usuario ya incluyó información junto al comando (`$ARGUMENTS`), úsala como respuesta inicial y no vuelvas a preguntar lo que ya esté claro.

2. Usa AskUserQuestion (preguntas cortas, no una gigante) para obtener lo que falte de:
   - **Alcance**: Solo Backend / Solo Frontend / Backend + Frontend
   - **Qué pieza de arquitectura es**: deja que el usuario elija entre presets frecuentes (p.ej. "Códigos de error + i18n", "Paginación estándar de listados", "Correlation-id / logging estructurado", "Otro — descríbelo") más un campo libre si es "Otro"
   - **Alcance de aplicación**: ¿se aplica a todo el código existente de una vez, o solo a partir de ahora en features nuevas/tocadas? (importante porque cambia el tamaño de la tarea)

3. Pide como texto libre en el chat (no con AskUserQuestion):
   - El criterio de "hecho" — cómo se ve la convención funcionando end-to-end (ej: "el backend lanza `DomainException` con code `EmailIsAlreadyTaken`, el frontend lo traduce a 'Este email ya está registrado' en ES y 'This email is already registered' en EN")
   - Si es el caso de error codes + i18n: qué idiomas hay que soportar de entrada (mínimo ES, confirmar si hace falta EN u otros)

4. Resume la solicitud (Alcance / Pieza de arquitectura / Alcance de aplicación / Criterio de hecho / Idiomas si aplica) y pide confirmación antes de tocar código.

5. Una pieza de arquitectura transversal **siempre pasa por OpenSpec** (proposal → design → tasks → implement), incluso si parece pequeña: toca convenciones compartidas por muchas features y necesita quedar documentada en `openspec/specs/spec.md` para que el trabajo futuro la siga. No ofrezcas la opción de "implementación directa".
   - El `design.md` debe cubrir explícitamente: contrato exacto del `code` (naming, dónde vive el catálogo de codes, quién es la fuente de verdad — backend), cómo se propaga hasta el ProblemDetails, y en frontend dónde se resuelve la traducción (interceptor de `client.ts` vs. hook/componente que consume el error) y qué librería de i18n se usa si no existe aún.
   - Recuerda la metodología TDD (Red → Green → Refactor) del CLAUDE.md para ambos lados.

6. Una vez confirmado el proposal:
   - Si Backend + Frontend: lanza `back-specialist` primero (el contrato del `code` es la fuente de verdad) y luego `front-specialist` con el contrato ya definido — no en paralelo, porque frontend depende del catálogo de codes que define backend.
   - Si Solo Backend o Solo Frontend, usa el agente correspondiente.
   - Al terminar, recuerda actualizar `openspec/specs/spec.md` con la convención añadida (no dejarla solo en el código).

No asumas alcance, pieza de arquitectura, ni si aplica a todo el código existente sin que el usuario lo haya confirmado explícitamente.
