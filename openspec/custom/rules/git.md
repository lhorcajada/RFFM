# Reglas Git — CVL.SmartLocks

Reglas obligatorias para toda operación con Git durante el trabajo del agente.
Basadas en las convenciones existentes del proyecto y el flujo de Azure DevOps.

---

## 1. Ramas

### 1.1 Nomenclatura
- Formato: `{tipo}/{issueId}_{descripción_breve}`.
- Tipos permitidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
- El `issueId` es el número de work item de Azure DevOps.
- Descripción en snake_case, sin acentos, concisa.
- Ejemplos válidos:
  - `feat/8979_change_email`
  - `fix/8932_error_update_standar_self`
  - `chore/8646_notif_base`
  - `refactor/9100_improve_query_performance`

### 1.2 Rama base
- Las ramas de feature se crean siempre desde `main`.
- Antes de crear una rama, actualizar `main`: `git pull origin main`.
- Crear la rama: `git checkout -b {tipo}/{issueId}_{descripción} origin/main`.

### 1.3 Mantener la rama actualizada
- Hacer rebase sobre `main` regularmente:
  ```
  git fetch origin main
  git rebase origin/main
  ```
- Si hay conflictos, resolverlos localmente y continuar el rebase.

### 1.4 No trabajar directement en `main`
- Nunca hacer commits directos sobre `main`.
- Todo cambio pasa por una rama de feature y un Pull Request.

---

## 2. Commits

### 2.1 Conventional Commits
- Formato: `{tipo}({ámbito}): {mensaje}` o `{tipo}: {mensaje}`.
- Tipos permitidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `ci`, `perf`.
- Ámbitos habituales: `mcp-api`, `sql`, `openspec`, `scripts`, `docs`.
- El ámbito es opcional pero recomendado cuando aplica.

### 2.2 Mensajes
- En inglés, minúscula, sin punto final, imperativo.
- Describir **qué** hace el cambio, no cómo.
- Ejemplos válidos:
  - `feat(mcp-api): add change own email endpoint for external users`
  - `fix(mcp-api): correct role escalation guard for standard users`
  - `chore: remove old migration files`
  - `refactor(mcp-api): extract user validation to feature service`
  - `feat: add change own email feature for external users`

### 2.3 Granularidad
- Un commit por unidad lógica de cambio.
- No mezclar features, fixes y refactors en un mismo commit.
- No hacer commits con cambios rotos (la build debe pasar).
- Migrations en commit separado del código de aplicación.
- **Todo commit requiere validación de specs + confirmación explícita del usuario** (ver §7.3).

### 2.4 No hacer amend ni rebase interactivo
- No usar `git commit --amend` salvo que el commit no haya sido pusheado.
- No usar `git rebase -i` para squashing una vez pusheado.

---

## 3. Push

### 3.1 Force push
- Usar **siempre** `--force-with-lease`, nunca `--force` ni `-f`.
  ```
  git push --force-with-lease origin {rama}
  ```
- `--force-with-lease` es seguro: falla si alguien más pusheó cambios.
- Usar force push solo después de rebase sobre `main`.

### 3.2 Push normal
- Primer push de una rama nueva:
  ```
  git push -u origin {rama}
  ```
- Pushes subsiguientes:
  ```
  git push origin {rama}
  ```

### 3.3 No pushear a `main`
- Nunca pushear directamente a `main`.
- Los cambios llegan a `main` exclusivamente vía Pull Request mergeado en Azure DevOps.

---

## 4. Pull Requests

### 4.1 Flujo
1. Crear la rama desde `main`.
2. Desarrollar y hacer commits **solo tras validación de specs y confirmación explícita del usuario** (ver §7.3).
3. Pushear la rama a `origin` (también requiere confirmación explícita).
4. Crear PR en Azure DevOps hacia `main`.
5. El CI (build + tests) debe pasar.
6. Al menos una aprobación de revisión.
7. Squash merge a `main` (política del repositorio).

### 4.2 Título del PR
- Seguir el mismo formato que los commits: `feat(mcp-api): descripción del cambio`.


### 4.3 Relación con work items
- El ID del work item debe aparecer en el nombre de la rama.
- Vincular el PR al work item en Azure DevOps para rastreo.

---

## 5. Migraciones (Entity Framework)

### 5.1 Crear migraciones
- Siempre desde el proyecto de Infrastructure:
  ```
  dotnet ef migrations add {NombreMigration} --startup-project {ruta-al-Host}
  ```
- Nombres descriptivos en PascalCase: `AddNewEmailToExternalUserOtpRequest`, `AddValidityWindowToTempUser`.

### 5.2 Commit de migraciones
- Las migraciones van en un commit separado del código de aplicación.
- Si se generan migraciones obsoletas en un rebase, eliminarlas y regenerarlas.

### 5.3 No modificar migraciones ya pusheadas
- Si una migración ya está en `main`, crear una nueva para corregirla.
- Nunca editar una migración que ya se ha aplicado en algún entorno.

---

## 6. Operaciones prohibidas

### 6.1 Nunca
- Pushear directamente a `main`.
- Usar `git push --force` (solo `--force-with-lease`).
- Hacer `git reset --hard` en ramas compartidas.
- Borrar ramas remotas sin confirmación del equipo.
- Incluir secrets, tokens o contraseñas en commits.
- Hacer commits con credenciales o archivos `.env`.

### 6.2 Evitar
- Commits muy grandes que mezclan múltiples concerns.
- Mensajes de commit vagos como "fix", "update", "changes".
- Dejar ramas remotas abandonadas; eliminar tras merge.

---

## 7. Flujo del agente

### 7.1 Antes de empezar un cambio
1. Verificar la rama actual: `git branch --show-current`.
2. Si no está en la rama correcta, crearla o cambiarse a ella.
3. Asegurar que la rama está actualizada respecto a `main`.

### 7.2 Durante el desarrollo
1. Implementar en pasos granulares por unidad lógica, pero **SIN commitear automáticamente** — los commits los gestiona el usuario ver §7.3.
2. Verificar que la build pasa: `dotnet build`.
3. Ejecutar tests afectados después de cada unidad lógica.

### 7.3 Condición obligatoria para commitear — validación de specs y confirmación del usuario

> **Regla de oro:** el agente **NO DEBE ejecutar `git commit`** hasta que se cumplan **ambas** condiciones:
>
> 1. **Validación de specs**: todas las specs afectadas del cambio OpenSpec deben estar validadas. Concretamente:
>    - `openspec validate --change <name>` debe pasar sin errores.
>    - Todos los escenarios SHALL/SHOULD/MUST especificados que tengan un test asociado deben estar en verde.
>    - Si una spec no tiene test, su implementación debe estar revisada manualmente y marcada como verificada en `implementation.md`.
> 2. **Confirmación explícita del usuario**: antes de cualquier `git commit`, el agente **debe preguntar** al usuario y esperar respuesta afirmativa. Formato sugerido:
>    > "Listo para commitear `<scope>` con mensaje `<tipo>(<ámbito>): <mensaje>`. ¿Procedo?"
>
> El agente **nunca** debe asumir consentimiento implícito. Aunque la build pase y los tests estén en verde, si las specs no están validadas o el usuario no ha confirmado, **no commitear**.

### 7.4 Al finalizar (post-confirmación)
1. Verificar estado: `git status` y `git diff --stat` — mostrar al usuario.
2. Ejecutar el/los commit únicamente tras confirmación del usuario (ver §7.3).
3. Pushear la rama: `git push -u origin {rama}` o `git push --force-with-lease origin {rama}` (si hubo rebase) — también requiere confirmación explícita.
4. Indicar al usuario que debe crear el PR en Azure DevOps.

### 7.5 Resolución de conflictos
1. `git fetch origin main`
2. `git rebase origin/main`
3. Resolver conflictos archivo por archivo.
4. `git rebase --continue` tras cada resolución.
5. `git push --force-with-lease origin {rama}` al finalizar.
