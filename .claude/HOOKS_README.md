# FutbolBase Hooks Configuration

Configuración completa de hooks automáticos para Claude Code, integrando:
- ✅ Tests automáticos (Vitest + xUnit)
- ✅ Validación de cobertura
- ✅ Compilación de ambas plataformas
- ✅ Revisión de código (agentes especializados)
- ✅ Conventional Commits
- ✅ Git integration

---

## 📋 Estructura de Hooks

### 1. **SessionStart** - Inicialización
Cuando inicia una sesión de Claude Code, muestra estado de la configuración:
- 🎮 FutbolBase cargado
- ✅ TDD Methodology activo
- 🧪 Test automation habilitado
- 📝 Conventional Commits enforcement

### 2. **UserPromptSubmit** - Recordatorio TDD
Cuando el usuario solicita implementar/arreglar/refactorizar:
- 🔴 Recuerda: Tests primero (RED phase)
- 🟢 Luego: Implementación mínima (GREEN phase)
- 🔵 Finalmente: Refactor (REFACTOR phase)
- Targets de cobertura: 75% frontend, 80% backend handlers, 85% domain logic

### 3. **PreToolUse** - Validaciones Pre-Commit
Antes de hacer `git commit`, `git push`, `npm run build`, o `dotnet build`:
- 🧪 Ejecuta tests y valida cobertura
- 🔨 Compila frontend y backend

Scripts utilizados:
- `.claude/hooks/test-coverage.ps1` - Ejecuta tests con validación de cobertura
- `.claude/hooks/build-all.ps1` - Compila ambas plataformas

### 4. **PostToolUse** - Revisión de Código
Después de `git commit`:
- ✅ Ofrece revisión automática de código
- 🔍 Agentes especializados analizan cambios:
  - **Front**: React, TypeScript, MUI, CSS Modules, tests (Vitest + Testing Library)
  - **Back**: ASP.NET Core, CQRS, validation, tests (xUnit + Moq)
- 🔴 Reporta issues CRITICAL (seguridad, test failures)
- 🟠 Reporta issues MAJOR (type safety, coverage)
- 🟡 Reporta issues MINOR (style, docs)

---

## 📁 Scripts de Hooks

### `test-coverage.ps1`
Ejecuta tests y valida cobertura:
```powershell
# Frontend: Vitest + Testing Library
# Backend: xUnit + Moq

# Targets:
# - Frontend: ≥75% coverage
# - Backend: ≥80% handlers, ≥85% domain logic
```

**Uso:**
```bash
powershell -File .claude\hooks\test-coverage.ps1 -Layer all
powershell -File .claude\hooks\test-coverage.ps1 -Layer front
powershell -File .claude\hooks\test-coverage.ps1 -Layer back
```

### `build-all.ps1`
Compila frontend y backend:
```powershell
# Frontend: npm run build (Vite)
# Backend: dotnet build --configuration Release
```

**Uso:**
```bash
powershell -File .claude\hooks\build-all.ps1 -Layer all
powershell -File .claude\hooks\build-all.ps1 -Layer front
powershell -File .claude\hooks\build-all.ps1 -Layer back
```

### `conventional-commit.ps1`
Valida formato de commits según Conventional Commits:

**Formato válido:**
```
type(scope)?: description

Valid types:
  feat     - Nueva funcionalidad
  fix      - Bug fix
  docs     - Cambios en documentación
  style    - Cambios de formato (sin afectar código)
  refactor - Refactorización
  perf     - Mejoras de performance
  test     - Tests
  chore    - Cambios en build/deps
  ci       - Cambios en CI
  build    - Cambios en sistema de build
  revert   - Revert de commit anterior
```

**Ejemplos:**
```
feat(auth): agregar JWT token refresh
fix(database): corregir N+1 query en equipos
docs(readme): actualizar instrucciones de setup
refactor(api): simplificar validación de requests
perf(cache): optimizar invalidación de caché
test(components): agregar tests para LoginForm
```

### `git-commit-conventional.ps1`
Helper interactivo para construir commits convencionales:

**Uso:**
```bash
powershell -File .claude\hooks\git-commit-conventional.ps1
```

---

## 🤖 Agentes Especializados de Revisión

### Front Code Reviewer (`.claude/agents/code-reviewer-front.md`)
Revisa cambios en React/TypeScript/MUI:
- ✅ TypeScript strict mode (sin `any`)
- ✅ Component patterns (React 19, hooks)
- ✅ MUI theme consistency
- ✅ CSS Modules co-location
- ✅ Vitest + Testing Library tests
- ✅ Auth flow (HS256 + JWT)
- ✅ Axios singleton usage
- ✅ Performance (lazy loading, memoization)

Severity levels:
- 🔴 CRITICAL: Security, auth leaks, breaking changes
- 🟠 MAJOR: Type safety, test failures, coverage
- 🟡 MINOR: Code style, simple refactors
- 🟢 SUGGESTION: Non-blocking improvements

### Back Code Reviewer (`.claude/agents/code-reviewer-back.md`)
Revisa cambios en ASP.NET Core/CQRS:
- ✅ Vertical slice structure
- ✅ CQRS pattern (ICommand, IQueryApp)
- ✅ FluentValidation en cada command
- ✅ EF Core usage (3 DbContexts)
- ✅ xUnit tests + coverage
- ✅ ProblemDetails error handling
- ✅ Domain-Driven Design
- ✅ Security (auth, validation, no secrets)

Severity levels:
- 🔴 CRITICAL: SQL injection, unvalidated input, auth issues
- 🟠 MAJOR: Missing validator, wrong DbContext, test failures
- 🟡 MINOR: Code style, naming
- 🟢 SUGGESTION: Non-blocking improvements

---

## ⚙️ Configuración en settings.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "powershell -Command \"...\"",
        "statusMessage": "Loading FutbolBase configuration..."
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "implement|feature|fix|refactor|bug",
        "type": "prompt",
        "prompt": "🔴 TDD REMINDER: ..."
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash(git commit|git push|...",
        "type": "command",
        "command": "powershell -File .claude\\hooks\\test-coverage.ps1"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash(git commit",
        "type": "prompt",
        "prompt": "✅ POST-COMMIT REVIEW AVAILABLE..."
      }
    ]
  }
}
```

---

## 🔄 Workflow Típico

### 1. Crear Feature
```bash
claude
# SessionStart hook muestra estado ✅

# Escribir test primero (RED)
# Implementar mínimamente (GREEN)
# Refactorizar (REFACTOR)
```

### 2. Commit con Conventional Commits
```bash
# Cuando intenta hacer git commit:
# - PreToolUse hook: Ejecuta tests y build
# - Si pasan: Procede con commit
# - Debe usar formato: feat(scope): description
```

### 3. Revisión Automática
```bash
# Después de git commit:
# - PostToolUse hook: Ofrece revisión de código
# - Si acepta 'yes': Ejecutan agentes especializados
# - Reportan issues por severidad
# - Opcionalmente: Corrigen issues críticos y hacen push
```

### 4. Push
```bash
# PreToolUse hook: Valida tests y build nuevamente
# Git push: Envía a remote
```

---

## 📊 Cobertura Targets

| Layer | Coverage | Herramienta |
|-------|----------|-------------|
| **Frontend - Components** | ≥75% | Vitest + Coverage |
| **Frontend - Hooks/Utils** | ≥80% | Vitest + Coverage |
| **Backend - Domain Logic** | ≥85% | xUnit + Coverage |
| **Backend - Command Handlers** | ≥80% | xUnit + Coverage |
| **Backend - API Endpoints** | ≥70% | E2E + Playwright |

---

## 🛠️ Troubleshooting

### Tests fallan
```bash
cd Front && npm run test --watch
# o
cd Back/ExtractionApi && dotnet test --watch
```

### Build falla
```bash
cd Front && npm run build
# o
cd Back/ExtractionApi && dotnet build
```

### Hooks no se ejecutan
1. Verificar que `.claude/settings.json` es válido
2. Verificar permisos en `.claude/hooks/*.ps1`
3. Ejecutar manualmente:
   ```bash
   powershell -File .claude\hooks\test-coverage.ps1
   powershell -File .claude\hooks\build-all.ps1
   ```

### Commit message inválido
- Usar helper: `powershell -File .claude\hooks\git-commit-conventional.ps1`
- O seguir formato: `type(scope)?: description`
- Valid types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

---

## 📚 Referencias

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Claude Code Hooks Documentation](https://claude.ai/code/docs/hooks)
- [CLAUDE.md](../CLAUDE.md) - Project instructions
- [Back Specialist Agent](./agents/code-reviewer-back.md)
- [Front Specialist Agent](./agents/code-reviewer-front.md)
