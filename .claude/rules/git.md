# Reglas Git — FutbolBase (Trunk-Based Development)

Reglas obligatorias para toda operación con Git durante el trabajo del agente.
Metodología: **Trunk-Based Development**. No se usan Pull Requests como requisito
para integrar cambios — la integración es directa y frecuente sobre las ramas
tronco (`main`, `dev`).

---

## 1. Ramas

### 1.1 Ramas tronco
- `main` y `dev` son ramas tronco (trunk). Se permite commitear y pushear
  directamente sobre ellas.
- `dev` es el tronco de integración diario; `main` es el tronco estable/release.
- Los cambios pasan de `dev` a `main` por merge directo (sin PR obligatorio),
  siempre que la build y los tests pasen.

### 1.2 Ramas de corta duración (opcional)
- Para cambios que conviene aislar temporalmente (features grandes, cambios
  arriesgados, o cuando el usuario lo pida explícitamente), se puede crear una
  rama de corta duración con formato: `{tipo}/{descripción_breve}`.
- Tipos permitidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
- Descripción en snake_case, sin acentos, concisa. Ejemplos:
  - `feat/mobile_friendlies_tournaments_tab`
  - `fix/update_team_league_not_persisted`
- Estas ramas se fusionan de vuelta al tronco (`dev` o `main`) tan pronto como
  el cambio esté completo y verificado — nunca deben vivir más de uno o dos días.
  Trunk-Based Development favorece integrar directo sobre el tronco salvo que
  el usuario prefiera aislar el trabajo primero.
- Tras el merge, la rama se puede eliminar del remoto.

### 1.3 Mantener la rama actualizada
- Si se trabaja en una rama de corta duración, actualizarla frecuentemente
  contra el tronco:
  ```
  git fetch origin dev
  git rebase origin/dev
  ```
- Si hay conflictos, resolverlos localmente y continuar el rebase.

---

## 2. Commits

### 2.1 Conventional Commits
- Formato: `{tipo}({ámbito}): {mensaje}` o `{tipo}: {mensaje}`.
- Tipos permitidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `ci`, `perf`.
- Ámbitos habituales: `mcp-api`, `front`, `mobile`, `openspec`, `scripts`, `docs`.
- El ámbito es opcional pero recomendado cuando aplica.

### 2.2 Mensajes
- En inglés, minúscula, sin punto final, imperativo.
- Describir **qué** hace el cambio, no cómo.
- Ejemplos válidos:
  - `feat(mobile): add friendlies/tournaments tab`
  - `fix(mcp-api): correct role escalation guard for standard users`
  - `chore: remove old migration files`
  - `refactor(mcp-api): extract user validation to feature service`

### 2.3 Granularidad
- Un commit por unidad lógica de cambio.
- No mezclar features, fixes y refactors en un mismo commit.
- No hacer commits con cambios rotos (la build y los tests deben pasar).
- Migrations en commit separado del código de aplicación.
- **Todo commit requiere validación de specs + confirmación explícita del usuario** (ver §6.3).

### 2.4 No hacer amend ni rebase interactivo
- No usar `git commit --amend` salvo que el commit no haya sido pusheado.
- No usar `git rebase -i` para squashing una vez pusheado.

---

## 3. Push y merge a tronco

### 3.1 Force push
- Usar **siempre** `--force-with-lease`, nunca `--force` ni `-f`.
  ```
  git push --force-with-lease origin {rama}
  ```
- `--force-with-lease` es seguro: falla si alguien más pusheó cambios.
- Nunca usar force push sobre `main` o `dev`.

### 3.2 Push normal
- Primer push de una rama nueva: `git push -u origin {rama}`.
- Pushes subsiguientes: `git push origin {rama}`.
- Push directo a `main`/`dev`: `git push origin {rama-tronco}` — permitido en
  Trunk-Based Development, siempre tras confirmación explícita del usuario
  (ver §6.3) y con la build/tests en verde.

### 3.3 Merge de tronco a tronco (`dev` → `main`)
- Antes de fusionar, verificar que la build y toda la suite de tests afectada
  pasan en la rama origen.
- Merge directo, sin PR obligatorio:
  ```
  git checkout main
  git pull origin main
  git merge --no-ff dev
  git push origin main
  ```
- Requiere confirmación explícita del usuario antes del push (ver §6.3),
  igual que cualquier otro push a rama compartida.

---

## 4. Migraciones (Entity Framework)

### 4.1 Crear migraciones
- Siempre desde el proyecto de Infrastructure:
  ```
  dotnet ef migrations add {NombreMigration} --startup-project {ruta-al-Host}
  ```
- Nombres descriptivos en PascalCase: `AddNewEmailToExternalUserOtpRequest`, `AddValidityWindowToTempUser`.

### 4.2 Commit de migraciones
- Las migraciones van en un commit separado del código de aplicación.
- Si se generan migraciones obsoletas en un rebase, eliminarlas y regenerarlas.

### 4.3 No modificar migraciones ya pusheadas
- Si una migración ya está en `main`/`dev`, crear una nueva para corregirla.
- Nunca editar una migración que ya se ha aplicado en algún entorno.

---

## 5. Operaciones prohibidas

### 5.1 Nunca
- Usar `git push --force` (solo `--force-with-lease`, y nunca sobre `main`/`dev`).
- Hacer `git reset --hard` en ramas compartidas.
- Borrar ramas remotas sin confirmación del usuario.
- Incluir secrets, tokens o contraseñas en commits.
- Hacer commits con credenciales o archivos `.env`.
- Pushear o mergear a tronco sin que la build/tests pasen.

### 5.2 Evitar
- Commits muy grandes que mezclan múltiples concerns.
- Mensajes de commit vagos como "fix", "update", "changes".
- Dejar ramas de corta duración abandonadas tras el merge; eliminarlas.
- Vivir en una rama de feature más de uno o dos días — Trunk-Based Development
  favorece integrar pronto y seguido.

---

## 6. Flujo del agente

### 6.1 Antes de empezar un cambio
1. Verificar la rama actual: `git branch --show-current`.
2. Si el cambio es pequeño/rápido, trabajar directo sobre el tronco (`dev`).
   Si conviene aislarlo (cambio grande, arriesgado, o el usuario lo pide),
   crear una rama de corta duración desde el tronco actualizado.
3. Asegurar que la base está actualizada: `git pull origin {tronco}`.

### 6.2 Durante el desarrollo
1. Implementar en pasos granulares por unidad lógica, pero **SIN commitear
   automáticamente** — los commits los gestiona el usuario (ver §6.3).
2. Verificar que la build pasa (`dotnet build`, `npm run build`, etc.).
3. Ejecutar tests afectados después de cada unidad lógica.

### 6.3 Condición obligatoria para commitear/pushear — validación y confirmación del usuario

> **Regla de oro:** el agente **NO DEBE ejecutar `git commit`, `git push` ni
> `git merge` hacia una rama compartida** hasta que se cumplan **ambas** condiciones:
>
> 1. **Validación**: la build pasa y los tests afectados están en verde. Si el
>    cambio es un cambio OpenSpec, sus specs deben estar validadas
>    (`openspec validate <change> --strict` sin errores) y sus escenarios
>    cubiertos por test deben estar en verde.
> 2. **Confirmación explícita del usuario**: antes de cualquier `git commit`,
>    `git push` a rama compartida, o `git merge` hacia tronco, el agente
>    **debe preguntar** al usuario y esperar respuesta afirmativa.
>
> El agente **nunca** debe asumir consentimiento implícito. Una confirmación
> cubre la acción solicitada, no acciones futuras similares.

### 6.4 Al finalizar (post-confirmación)
1. Verificar estado: `git status` y `git diff --stat` — mostrar al usuario.
2. Ejecutar el/los commit únicamente tras confirmación del usuario (ver §6.3).
3. Pushear/mergear únicamente tras confirmación explícita (ver §6.3).
4. Si se creó una rama de corta duración y ya se fusionó, ofrecer eliminarla.

### 6.5 Resolución de conflictos
1. `git fetch origin {tronco}`
2. `git rebase origin/{tronco}` (en rama de corta duración) o resolver el
   merge directamente si se está integrando sobre el tronco.
3. Resolver conflictos archivo por archivo.
4. `git rebase --continue` (o completar el merge) tras cada resolución.
5. Volver a ejecutar la suite de tests antes de pushear.
