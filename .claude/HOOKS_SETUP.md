# 🎯 FutbolBase Hooks Setup - Quick Reference

## ✅ Configuración Completada

### 1. Agentes Especializados de Code Review
- ✅ `code-reviewer-front.md` - Frontend (React, TypeScript, MUI, tests)
- ✅ `code-reviewer-back.md` - Backend (ASP.NET, CQRS, validation, tests)

### 2. Scripts de Automatización
- ✅ `hooks/test-coverage.ps1` - Ejecuta tests con validación de cobertura
- ✅ `hooks/build-all.ps1` - Compila frontend y backend
- ✅ `hooks/conventional-commit.ps1` - Valida formato de commits
- ✅ `hooks/git-commit-conventional.ps1` - Helper interactivo para commits

### 3. Hooks Activos en settings.json
- ✅ **SessionStart** - Muestra estado de configuración
- ✅ **UserPromptSubmit** - Recordatorio TDD (implement|feature|fix|refactor|bug)
- ✅ **PreToolUse** - Valida tests y build antes de commit/push
- ✅ **PostToolUse** - Ofrece revisión automática después de commit

---

## 🚀 Cómo Usar

### Opción 1: Flujo Automático (Recomendado)
```bash
# 1. Iniciar sesión
claude

# 2. Implementar con TDD
# - Escribir tests primero ✅
# - Implementar mínimamente ✅
# - Refactorizar ✅

# 3. Commit (automático: tests → build → code review)
git commit -m "feat(auth): add JWT token refresh"
# PreToolUse hook: ejecuta tests y build
# PostToolUse hook: ofrece revisión de código

# 4. Push (automático: valida nuevamente)
git push origin dev
# PreToolUse hook: ejecuta tests y build finales
```

### Opción 2: Validación Manual
```bash
# Tests
powershell -File .claude\hooks\test-coverage.ps1 -Layer all

# Build
powershell -File .claude\hooks\build-all.ps1 -Layer all

# Helper para commit convencional
powershell -File .claude\hooks\git-commit-conventional.ps1
```

---

## 📊 Workflow Automático

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SessionStart Hook                                            │
│    └─ Muestra: 🎮 FutbolBase Session Started                   │
│       ✅ TDD Methodology Active                                 │
│       🧪 Test automation enabled                                │
│       📝 Conventional Commits enforced                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. UserPromptSubmit Hook (implement|feature|fix|refactor|bug)   │
│    └─ Recordatorio: RED → GREEN → REFACTOR                     │
│       Target: 75% frontend, 80% backend                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. PreToolUse Hook (antes de git commit/push/build)             │
│    ├─ Ejecuta: npm run test + dotnet test                       │
│    ├─ Valida: coverage targets                                  │
│    └─ Compila: npm run build + dotnet build                     │
│                                                                  │
│    ⚠️ Si falla: BLOQUEA commit/push                             │
│    ✅ Si pasa: Procede                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Git Commit (usuario proporciona mensaje)                     │
│    └─ Debe seguir: type(scope)?: description                    │
│       Ejemplos: feat(auth), fix(api), docs(readme)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. PostToolUse Hook (después de git commit)                     │
│    └─ Pregunta: "¿Code review automático?"                      │
│       Si SÍ: Ejecuta agentes especializados                     │
│       ├─ Front-specialist: Revisa React/TypeScript/MUI/tests    │
│       ├─ Back-specialist: Revisa ASP.NET/CQRS/validation/tests  │
│       └─ Reporta: 🔴 CRITICAL, 🟠 MAJOR, 🟡 MINOR              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Git Push (usuario ejecuta)                                   │
│    └─ PreToolUse Hook: Valida tests y build nuevamente          │
│       ⚠️ Si falla: BLOQUEA push                                 │
│       ✅ Si pasa: Push a remote (origin/dev o main)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Severidad de Issues (Code Review)

### 🔴 CRITICAL (Debe corregirse)
- Security vulnerabilities (SQL injection, XSS, auth leaks)
- Test failures
- Type errors (TypeScript any, type mismatches)
- Missing required validators (backend)
- Secrets en código

### 🟠 MAJOR (Debería corregirse)
- Coverage below targets (75% frontend, 80% backend)
- Missing or inadequate tests
- Wrong DbContext usage
- Validation gaps
- Performance issues

### 🟡 MINOR (Opcional)
- Code style
- Naming conventions
- Documentation
- Simple refactors

### 🟢 SUGGESTION
- Non-blocking improvements
- Future optimizations
- Nice-to-haves

---

## 📝 Formato de Commits (Conventional Commits)

**Estructura:**
```
type(scope)?: description

[optional body]

[optional footer]
```

**Valid Types:**
- `feat` - Nueva funcionalidad
- `fix` - Bug fix
- `docs` - Cambios en documentación
- `style` - Cambios de formato (sin afectar código)
- `refactor` - Refactorización
- `perf` - Mejoras de performance
- `test` - Agregar o corregir tests
- `chore` - Cambios en build/deps/otros
- `ci` - Cambios en CI/CD
- `build` - Cambios en sistema de build
- `revert` - Revert de commit anterior

**Ejemplos Válidos:**
```
feat(authentication): add JWT token refresh mechanism
fix(database): resolve N+1 query in team listing
docs(readme): update installation instructions
refactor(api): simplify request validation
perf(cache): optimize cache invalidation strategy
test(components): add comprehensive LoginForm tests
chore(deps): upgrade MUI to v5.14
ci(github): add E2E test workflow
build(dotnet): upgrade .NET to 9.0.1
```

**Ejemplos Inválidos:**
```
❌ update stuff
❌ feat: (missing description)
❌ feature(auth): add JWT
❌ FIX(database): N+1 query
```

---

## 🔧 Verificación de Setup

```bash
# 1. Verificar agentes
ls .claude/agents/
# Debe mostrar: code-reviewer-front.md, code-reviewer-back.md

# 2. Verificar scripts
ls .claude/hooks/
# Debe mostrar: test-coverage.ps1, build-all.ps1, conventional-commit.ps1

# 3. Verificar settings
cat .claude/settings.json
# Debe tener hooks: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse

# 4. Ejecutar test manual
powershell -File .claude\hooks\test-coverage.ps1 -Layer all

# 5. Ejecutar build manual
powershell -File .claude\hooks\build-all.ps1 -Layer all
```

---

## ⚠️ Importante

### Para que funcione:
1. ✅ `.claude/settings.json` debe ser válido JSON
2. ✅ Scripts `.ps1` deben estar en `.claude/hooks/`
3. ✅ Agentes `.md` deben estar en `.claude/agents/`
4. ✅ Frontend debe estar en `Front/` con `npm run test` y `npm run build`
5. ✅ Backend debe estar en `Back/ExtractionApi/` con `dotnet test` y `dotnet build`

### Si los hooks no se ejecutan:
1. Verificar permisos de PowerShell: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
2. Verificar que Claude Code tiene permisos en `.claude/settings.json`
3. Ejecutar manualmente para debug: `powershell -File .claude\hooks\test-coverage.ps1`

---

## 📚 Documentación Completa

Ver: `.claude/HOOKS_README.md`

---

**Configuración completada:** 2026-07-10  
**Última actualización:** 2026-07-10  
**Estado:** ✅ Activa
