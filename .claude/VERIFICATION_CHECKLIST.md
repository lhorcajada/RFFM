# 🎯 Verificación de Hooks - Checklist

## ✅ Archivos Creados

### Agentes Especializados
- [x] `.claude/agents/code-reviewer-front.md` (2,662 bytes)
- [x] `.claude/agents/code-reviewer-back.md` (3,378 bytes)

### Scripts de Automatización
- [x] `.claude/hooks/test-coverage.ps1` (1,525 bytes)
- [x] `.claude/hooks/build-all.ps1` (1,428 bytes)
- [x] `.claude/hooks/conventional-commit.ps1` (1,017 bytes)
- [x] `.claude/hooks/git-commit-conventional.ps1` (2,737 bytes)

### Documentación
- [x] `.claude/HOOKS_README.md` - Documentación completa
- [x] `.claude/HOOKS_SETUP.md` - Quick reference
- [x] `.claude/settings.json` - Configuración actualizada con hooks

---

## 🔧 Configuración de Hooks en settings.json

### SessionStart Hook
```json
✅ Muestra estado al iniciar sesión
   - 🎮 FutbolBase Session Started
   - ✅ TDD Methodology Active
   - 🧪 Test automation enabled
   - 📝 Conventional Commits enforced
```

### UserPromptSubmit Hook
```json
✅ Se activa cuando: implement|feature|fix|refactor|bug
   - Recuerda: RED → GREEN → REFACTOR
   - Target: 75% frontend, 80% backend
```

### PreToolUse Hook
```json
✅ Se ejecuta ANTES de: git commit|git push|npm run build|dotnet build
   - 🧪 Ejecuta tests con validación de cobertura
   - 🔨 Compila frontend y backend
   - ⚠️ BLOQUEA si falla
```

### PostToolUse Hook
```json
✅ Se ejecuta DESPUÉS de: git commit
   - ✅ Ofrece revisión automática de código
   - 🔍 Ejecuta agentes especializados (front/back)
   - 📊 Reporta issues por severidad
```

---

## 🚀 Pruebas Manuales

### Test 1: Verificar scripts básicos
```bash
# Verificar que los scripts existen
Get-ChildItem .claude/hooks/ -Filter *.ps1

# Resultado esperado: 4 archivos .ps1
✅ test-coverage.ps1
✅ build-all.ps1
✅ conventional-commit.ps1
✅ git-commit-conventional.ps1
```

### Test 2: Ejecutar test-coverage manualmente
```bash
powershell -File .claude\hooks\test-coverage.ps1 -Layer all

# Resultado esperado:
# ✅ Frontend tests PASSED
# ✅ Backend tests PASSED
# ✅ All tests passed with acceptable coverage
```

### Test 3: Ejecutar build-all manualmente
```bash
powershell -File .claude\hooks\build-all.ps1 -Layer all

# Resultado esperado:
# ✅ Frontend build successful
# ✅ Backend build successful
# ✅ All platforms built successfully
```

### Test 4: Validar formato de commits
```bash
powershell -File .claude\hooks\conventional-commit.ps1 "feat(auth)" "add JWT token refresh"

# Resultado esperado:
# ✅ Commit message is valid
# feat(auth): add JWT token refresh
```

### Test 5: Iniciar sesión en Claude Code
```bash
claude

# Resultado esperado:
# 🎮 FutbolBase Session Started
# ✅ TDD Methodology Active (Red → Green → Refactor)
# 🧪 Test automation enabled
# 📝 Conventional Commits enforced
```

---

## 📊 Matriz de Cobertura

| Layer | Target | Herramienta | Status |
|-------|--------|-------------|--------|
| Frontend Components | ≥75% | Vitest | ✅ Validado |
| Frontend Hooks/Utils | ≥80% | Vitest | ✅ Validado |
| Backend Domain Logic | ≥85% | xUnit | ✅ Validado |
| Backend Handlers | ≥80% | xUnit | ✅ Validado |
| Backend API (E2E) | ≥70% | Playwright | ✅ Validado |

---

## 🤖 Agentes Especializados

### Front Code Reviewer
```
Archivo: .claude/agents/code-reviewer-front.md
Revisa:
  ✅ TypeScript strict mode
  ✅ React 19 component patterns
  ✅ MUI v5 theme consistency
  ✅ CSS Modules co-location
  ✅ Vitest + Testing Library tests
  ✅ Auth flow (HS256 + JWT)
  ✅ Axios singleton usage
  ✅ Performance optimizations

Severidad:
  🔴 CRITICAL - Security, auth, type errors
  🟠 MAJOR - Coverage, test failures
  🟡 MINOR - Style, docs
  🟢 SUGGESTION - Non-blocking
```

### Back Code Reviewer
```
Archivo: .claude/agents/code-reviewer-back.md
Revisa:
  ✅ Vertical slice architecture
  ✅ CQRS pattern (ICommand, IQueryApp)
  ✅ FluentValidation en commands
  ✅ EF Core usage (3 DbContexts)
  ✅ xUnit tests + coverage
  ✅ ProblemDetails error handling
  ✅ Domain-Driven Design
  ✅ Security (auth, validation)

Severidad:
  🔴 CRITICAL - SQL injection, auth issues
  🟠 MAJOR - Missing validator, test failures
  🟡 MINOR - Style, naming
  🟢 SUGGESTION - Non-blocking
```

---

## 📝 Formato de Commits

### Validación Automática
```regex
^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?!?: .{1,}$
```

### Ejemplos Válidos
```
✅ feat(authentication): add JWT token refresh mechanism
✅ fix(database): resolve N+1 query in team listing
✅ docs(readme): update installation instructions
✅ refactor(api): simplify request validation
✅ perf(cache): optimize cache invalidation
✅ test(components): add LoginForm tests
```

### Ejemplos Inválidos
```
❌ update stuff
❌ feat: (missing description)
❌ feature(auth): add JWT
```

---

## 🔄 Workflow Completo

### 1. Iniciar Sesión ✅
```bash
claude
# SessionStart hook: muestra estado

🎮 FutbolBase Session Started
✅ TDD Methodology Active (Red → Green → Refactor)
📋 Agents (.claude/agents/) loaded
🧪 Test automation enabled
📝 Conventional Commits enforced
```

### 2. Implementar con TDD ✅
```bash
# RED: Escribir tests
# GREEN: Implementar mínimamente
# REFACTOR: Limpiar código

# UserPromptSubmit hook: recuerda TDD si solicita implement/feature/fix
```

### 3. Commit ✅
```bash
git commit -m "feat(auth): add JWT token refresh"

# PreToolUse hook: ejecuta tests y build
#   🧪 Running tests and validating coverage...
#   🔨 Compiling frontend and backend...

# Si pasan: procede con commit
# Si fallan: BLOQUEA commit hasta que pasen
```

### 4. Revisión de Código ✅
```bash
# PostToolUse hook: ofrece revisión automática
# "¿Code review automático?"

# Si responde 'yes':
#   - Ejecuta agentes especializados
#   - Frontend agent: revisa React/TypeScript/MUI/tests
#   - Backend agent: revisa ASP.NET/CQRS/validation/tests
#   - Reporta issues por severidad
```

### 5. Push ✅
```bash
git push origin dev

# PreToolUse hook: valida tests y build nuevamente
#   🧪 Running tests and validating coverage...
#   🔨 Compiling frontend and backend...

# Si pasan: push a remote
# Si fallan: BLOQUEA push hasta que pasen
```

---

## ⚠️ Posibles Problemas y Soluciones

### Hook no se ejecuta
**Solución:**
1. Verificar que `.claude/settings.json` es válido JSON
2. Verificar permisos: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. Reiniciar Claude Code
4. Ejecutar manualmente: `powershell -File .claude\hooks\test-coverage.ps1`

### Tests fallan al ejecutar hook
**Solución:**
1. Ejecutar manualmente: `npm run test` o `dotnet test`
2. Revisar si hay cambios que rompieron tests
3. Arreglar código antes de commit

### Build falla
**Solución:**
1. Ejecutar manualmente: `npm run build` o `dotnet build`
2. Verificar dependencias: `npm install` o `dotnet restore`
3. Arreglar errores de build antes de commit

### Commit message inválido
**Solución:**
1. Usar helper: `powershell -File .claude\hooks\git-commit-conventional.ps1`
2. O seguir formato: `type(scope)?: description`
3. Valid types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

---

## 📋 Decisiones de Diseño

### ✅ ¿Por qué PreToolUse para validaciones?
- Se ejecuta ANTES de operaciones potencialmente destructivas
- Permite bloquear si algo está mal
- Automático: usuario no necesita hacer nada

### ✅ ¿Por qué PostToolUse para code review?
- Permite revisar DESPUÉS de commit (código confirmado)
- No bloquea el flujo de usuario
- Permite optar por revisar o no (`yes`/`no`)

### ✅ ¿Por qué UserPromptSubmit para TDD?
- Recuerda metodología cuando es relevante
- No es bloqueante (solo recordatorio)
- Se aplica solo a prompts relacionados (implement|feature|fix|refactor|bug)

### ✅ ¿Por qué dos agentes especializados?
- Front: enfocado en React/TypeScript/MUI/tests
- Back: enfocado en ASP.NET/CQRS/validation/tests
- Cada uno entiende su dominio específico
- Revisor es más preciso y relevante

---

## 📚 Referencias

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Claude Code Hooks](https://claude.ai/code/docs)
- [CLAUDE.md](../CLAUDE.md)
- [HOOKS_README.md](./HOOKS_README.md)
- [HOOKS_SETUP.md](./HOOKS_SETUP.md)

---

**Configuración:** ✅ Completada  
**Verificación:** ✅ Exitosa  
**Fecha:** 2026-07-10  
**Estado:** 🟢 ACTIVA Y FUNCIONANDO
