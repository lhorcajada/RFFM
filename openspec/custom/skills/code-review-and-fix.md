# Code Review & Fix Skill

Realizar una revisión de código completa contra los guardrails del proyecto y generar un artefacto estructurado que permita corregir los hallazgos en una sesión posterior.

---

## Propósito

Este skill cubre dos fases:

1. **Revisión**: analizar el código contra los guardrails y producir un informe de hallazgos persistente.
2. **Corrección**: consumir ese informe en una sesión nueva y corregir cada hallazgo de forma sistemática.

---

## Fase 1 — Revisión (Code Review)

### Paso 1: Identificar el alcance

- Preguntar al usuario qué change o feature se quiere revisar.
- Si hay un change activo en `openspec/changes/`, usar ese como alcance.
- Alternativamente, aceptar una lista de archivos o un rango de commits.

### Paso 2: Ejecutar la revisión contra los guardrails

Leer y aplicar cada guardrail como checklist:

| # | Guardrail | Archivo |
|---|-----------|---------|
| 1 | Cumplimiento de reglas | `guardrails/code-review.md` §1 |
| 2 | Complejidad innecesaria | `guardrails/code-review.md` §2 |
| 3 | Duplicación de código | `guardrails/code-review.md` §3 |
| 4 | Manejo de errores | `guardrails/code-review.md` §4 |
| 5 | Código muerto e imports | `guardrails/code-review.md` §5 |
| 6 | Impactos secundarios | `guardrails/code-review.md` §6 |
| 7 | Protección de arquitectura | `guardrails/architecture-protection.md` |
| 8 | Integridad de datos | `guardrails/data-integrity.md` |
| 9 | Seguridad | `guardrails/security.md` |
| 10 | Calidad de tests | `guardrails/testing-quality.md` |

### Paso 3: Generar el informe de hallazgos

Crear un archivo en `docs/code-reviews/` con el siguiente formato:

```markdown
# Code Review — {Change/Feature Name}

**Fecha**: {fecha}
**Alcance**: {archivos o change revisado}
**Reviewer**: Copilot

---

## Resumen

- Total hallazgos: {n}
- 🔴 Critical: {n}
- 🟠 High: {n}
- 🟡 Medium: {n}
- 🟢 Low: {n}

---

## Hallazgos

### CR-001: {título descriptivo}

- **Severidad**: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low
- **Guardrail**: §X — {nombre del guardrail}
- **Archivo**: `{ruta:línea}`
- **Problema**: {descripción clara del problema}
- **Corrección sugerida**:
  ```
  {código o pasos sugeridos}
  ```

### CR-002: ...

---

## Sin hallazgos

(Los archivos que no tienen hallazgos se listan aquí para confirmar que fueron revisados.)

- `{archivo1}` ✅
- `{archivo2}` ✅
```

### Criterios de severidad

| Severidad | Criterio |
|-----------|----------|
| 🔴 Critical | Bug funcional, pérdida de datos, vulnerabilidad de seguridad |
| 🟠 High | Violación de patrón arquitectónico (CQRS, Result, error codes), manejo de errores incompleto |
| 🟡 Medium | Duplicación de código, complejidad innecesaria, null-forgiving sin garantía |
| 🟢 Low | `using` sin usar, líneas en blanco sobrantes, código muerto cosmético |

---

## Fase 2 — Corrección (Fix Session)

### Cómo iniciar una sesión de corrección

En una nueva sesión de Copilot, usar el prompt `/Code Review Fix` o:

```
Corrige los hallazgos del code review en docs/code-reviews/{nombre-del-archivo}.md.
```

### Paso 1: Leer el informe y presentar selección al usuario

- Abrir el archivo `docs/code-reviews/{nombre}.md`.
- Extraer todos los hallazgos pendientes (no marcados como `[✅ CORREGIDO]` ni `[⏭️ OMITIDO]`).
- Presentar al usuario un checklist interactivo usando `vscode_askQuestions` con `multiSelect: true` para que marque cuáles quiere corregir.
- Cada opción debe incluir el ID (CR-NNN), severidad y título corto.
- Pre-seleccionar (recommended) todos los 🔴 Critical y 🟠 High.
- **No empezar a corregir hasta que el usuario confirme su selección.**

Ejemplo de presentación:

```
Hallazgos pendientes:

☑ CR-001: [🔴 Critical] NullReference en DeleteSiteHandler
☑ CR-002: [🟠 High] Handler no devuelve Result<T>
☑ CR-003: [🟡 Medium] Duplicación de lógica de email
☑ CR-004: [🟢 Low] using sin usar en UserValidator

Marca los que quieras corregir. Los no marcados se quedarán pendientes.
```

### Paso 2: Crear un change en OpenSpec

Antes de escribir cualquier código, crear un change en OpenSpec para trackear las correcciones:

1. Derivar un nombre kebab-case a partir del informe (ej: `code-review-fix-unify-domain-events`).
2. Ejecutar `/opsx:propose` con el contexto de los hallazgos seleccionados:

```
Corregir los hallazgos del code review en {reviewFilePath}:
{lista de hallazgos seleccionados con ID, severidad, archivo y descripción}

Problema: {resumen de los hallazgos seleccionados}
Solución: Corregir cada hallazgo según la corrección sugerida en el informe.
```

3. Esto genera el change con `proposal.md`, `design.md` y `tasks.md`.
4. Una vez generado, proceder al Paso 3.

### Paso 3: Implementar las correcciones con /opsx:apply

1. Ejecutar `/opsx:apply` con el change creado en el Paso 2.
2. Seguir las instrucciones del skill para implementar tarea a tarea.

Para cada hallazgo seleccionado:

1. Leer el archivo referenciado y el contexto circundante.
2. Aplicar la corrección sugerida, o una mejor si el contexto lo requiere.
3. Verificar que la corrección no introduce nuevos problemas (re-aplicar los guardrails mentalmente).
4. Actualizar el informe:
   - Añadir `[✅ CORREGIDO]` al título del hallazgo.
   - Añadir línea `**Corregido en**: {fecha}` debajo del título.

Para cada hallazgo NO seleccionado:

- No tocar. Queda pendiente en el informe sin marca.
- No añadir `[⏭️ OMITIDO]` automáticamente; la decisión de omitir la toma el usuario en otra sesión.

### Paso 4: Verificación final

- Ejecutar `dotnet build` para confirmar que no hay errores de compilación.
- Ejecutar `openspec validate --change <name>` para verificar el estado del change.
- Actualizar el resumen del informe con los totales actualizados.
- Informar al usuario: total corregidos, total pendientes, nombre del change de OpenSpec, si hubo bloqueos.

---

## Prompt templates

### Para solicitar una revisión

```
Revisa el código del change "{nombre-del-change}" contra los guardrails del proyecto.
Genera el informe de hallazgos en docs/code-reviews/ con el formato del skill code-review-and-fix.
```

### Para corregir hallazgos en otra sesión

```
Corrige los hallazgos del code review en docs/code-reviews/{nombre-del-archivo}.md.
```

El prompt `Code Review Fix` se encarga de:
1. Presentar un checklist al usuario para que seleccione qué hallazgos corregir.
2. Crear un change en OpenSpec con `/opsx:propose` para trackear las correcciones.
3. Implementar las correcciones con `/opsx:apply`, tarea a tarea.
4. Marcar cada hallazgo corregido como [✅ CORREGIDO] en el informe.
5. Dejar los no seleccionados como pendientes para futuras sesiones.
6. Validar el change con `openspec validate` al finalizar.
```
