# 🚀 FutbolBase Hooks - Quick Start

## ✅ Lo Que Se Configuró

```
✅ Agentes de Code Review especializados (front + back)
✅ Tests automáticos (Vitest + xUnit)
✅ Validación de cobertura (75% frontend, 80% backend)
✅ Compilación automática (npm + dotnet)
✅ Conventional Commits enforcement
✅ Hooks integrados en Claude Code
```

---

## 🎯 Usar la Configuración

### Opción 1: Automático (Recomendado)
```bash
# 1. Iniciar sesión
claude

# 2. Trabajar con TDD
# Escribir tests → Implementar → Refactorizar

# 3. Commit (automático: tests → build → review)
git commit -m "feat(scope): descripción"

# 4. Push (automático: valida tests y build)
git push origin dev
```

**Qué ocurre automáticamente:**
- ✅ SessionStart: Muestra estado
- ✅ UserPromptSubmit: Recuerda TDD si implementas
- ✅ PreToolUse: Ejecuta tests y build antes de commit/push
- ✅ PostToolUse: Ofrece code review después de commit

### Opción 2: Manual (Para Debug)
```bash
# Tests y cobertura
powershell -File .claude\hooks\test-coverage.ps1 -Layer all

# Compilación
powershell -File .claude\hooks\build-all.ps1 -Layer all

# Helper de commits
powershell -File .claude\hooks\git-commit-conventional.ps1
```

---

## 📝 Formato de Commits

### Válido ✅
```
feat(auth): add JWT token refresh
fix(api): resolve N+1 query
docs(readme): update instructions
refactor(cache): simplify invalidation
test(login): add comprehensive tests
```

### Inválido ❌
```
update stuff
feat: (sin descripción)
feature(auth): add JWT
```

---

## 📊 Targets de Cobertura

| Capa | Target | Tool |
|------|--------|------|
| Frontend | ≥75% | Vitest |
| Backend | ≥80% | xUnit |
| Domain | ≥85% | xUnit |

---

## 🔍 Agentes de Code Review

Después de commit, se ofrece revisión automática:

**Frontend Reviewer:**
- TypeScript strict, React patterns, MUI, CSS Modules, tests

**Backend Reviewer:**
- Vertical slice, CQRS, validation, EF Core, security

**Severidades:**
- 🔴 CRITICAL: Security, type errors, test failures
- 🟠 MAJOR: Coverage, validation gaps
- 🟡 MINOR: Style, docs
- 🟢 SUGGESTION: Non-blocking

---

## 📚 Documentación

### Completa
`📖 .claude/HOOKS_README.md` - Guía exhaustiva

### Quick Reference
`⚡ .claude/HOOKS_SETUP.md` - Referencia rápida

### Verificación
`✅ .claude/VERIFICATION_CHECKLIST.md` - Checklist de validación

---

## ⚙️ Archivos de Configuración

```
.claude/
├── agents/
│   ├── code-reviewer-front.md      ← Frontend review
│   └── code-reviewer-back.md       ← Backend review
├── hooks/
│   ├── test-coverage.ps1           ← Tests + coverage
│   ├── build-all.ps1               ← Compilación
│   ├── conventional-commit.ps1     ← Validación de formato
│   └── git-commit-conventional.ps1 ← Helper interactivo
├── settings.json                   ← Hooks activos (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse)
├── HOOKS_README.md                 ← Documentación completa
├── HOOKS_SETUP.md                  ← Quick reference
├── VERIFICATION_CHECKLIST.md       ← Checklist
└── QUICKSTART.md                   ← Este archivo
```

---

## 🆘 Troubleshooting

### Hook no se ejecuta
```bash
# Verificar permisos
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Reiniciar Claude Code
claude
```

### Tests fallan
```bash
# Ejecutar manualmente
npm run test
# o
dotnet test
```

### Build falla
```bash
# Ejecutar manualmente
npm run build
# o
dotnet build
```

### Commit message inválido
```bash
# Usar helper
powershell -File .claude\hooks\git-commit-conventional.ps1

# O seguir: type(scope)?: description
```

---

## 💡 Tips

✅ **Tests primero** - RED → GREEN → REFACTOR  
✅ **Commit frecuente** - Cambios pequeños y enfocados  
✅ **Coverage matters** - Mantén los targets (75% frontend, 80% backend)  
✅ **Conventional commits** - Facilita git history y changelogs  
✅ **Code review** - Aprende de los agentes especializados  

---

## 🎓 Siguiente Paso

1. **Leer**: `HOOKS_README.md` para entender el sistema completo
2. **Practicar**: Hacer un pequeño commit con los hooks activos
3. **Explorar**: Revisar los agentes en `.claude/agents/`
4. **Customizar**: Ajustar scripts según tus necesidades

---

**Status:** ✅ Completado  
**Fecha:** 2026-07-10  
**Listo para usar:** Sí 🚀
