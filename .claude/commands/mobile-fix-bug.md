---
description: Recoge el reporte de un bug específico de Mobile (Expo/React Native), lo reproduce/localiza antes de tocar código, y lo corrige siguiendo TDD con un test de regresión que primero falla.
---

Vas a gestionar el reporte de un bug en la app **Mobile** de FutbolBase (Expo / React Native). NO toques código de producción antes de tener localizada la causa raíz y, si aplica TDD, antes de tener un test que reproduzca el fallo.

1. Si el usuario ya incluyó información junto al comando (en `$ARGUMENTS`), úsala como respuesta inicial a las preguntas de abajo y no vuelvas a preguntar lo que ya esté claro.

2. Usa AskUserQuestion (preguntas cortas, no una gigante) para obtener lo que falte de:
   - **Dónde ocurre**: Pantalla concreta (`screens/`) / Navegación (tabs, stack, iconos) / Llamada a la API (`api/`) / Autenticación (`AuthContext`, `SecureStore`) / No lo sé, búscalo
   - **Severidad**: Bloqueante (rompe un flujo clave) / Molesto (funciona pero mal) / Cosmético
   - **Reproducibilidad**: Siempre / A veces (intermitente) / Solo en un caso concreto (ej. plataforma iOS vs Android, o versión de Expo)

3. Pide como texto libre en el chat (no con AskUserQuestion), lo que falte de:
   - **Pasos para reproducir** (qué se hace, con qué datos/rol de usuario, en qué plataforma: iOS/Android/Expo Go/build)
   - **Comportamiento esperado** vs **comportamiento actual**
   - Mensajes de error, stack traces, o capturas si las tiene
   - Desde cuándo ocurre (si lo sabe): ¿siempre existió o es una regresión reciente? Si es reciente, pregunta si sabe qué cambio lo pudo causar (útil para `git log`/`git blame`) o si coincidió con una actualización de Expo/dependencias

4. Localiza la causa raíz ANTES de proponer una solución:
   - Si el alcance no está claro, usa el agente `Explore` para localizar el código relevante dentro de `Mobile/` (no asumas el archivo).
   - Si ya se sabe que es un cambio reciente, usa `git log`/`git blame` sobre los archivos sospechosos en vez de adivinar.
   - Si el bug puede deberse a un cambio de comportamiento de Expo/React Navigation entre versiones, verifica contra la documentación versionada exacta (`https://docs.expo.dev/versions/v57.0.0/`, confirmando la versión real en `Mobile/package.json`) antes de asumir que es un bug de la app.
   - Reproduce el bug mentalmente leyendo el código real — no propongas un fix sobre una suposición sin verificar el código fuente.

5. Resume en un bloque corto: **Dónde ocurre / Causa raíz encontrada (archivo:línea) / Fix propuesto / Alcance del test de regresión**, y muéstraselo al usuario para confirmación antes de escribir código, salvo que el bug sea trivial y de alcance obvio (ej. typo, valor mal puesto) — en ese caso puedes proceder directo y explicar qué hiciste al terminar.

6. Una vez confirmada la causa raíz (o si es trivial y procedes directo):
   - Aplica TDD estricto (Red → Green → Refactor) tal como exige `CLAUDE.md`, **salvo** que el bug sea puramente cosmético/estilo sin lógica testeable:
     1. **Red**: escribe primero un test de regresión (Jest + `@testing-library/react-native`) en `__tests__/` junto al archivo afectado, que reproduzca el bug y falle contra el código actual.
     2. **Green**: aplica el fix mínimo necesario para que ese test (y el resto de la suite) pase.
     3. **Refactor**: limpia si hace falta, manteniendo todo en verde.
   - Usa el agente `mobile-specialist` para el fix. Si el bug es realmente cross-stack (dato mal enviado por el backend), coordina con `back-specialist` primero.
   - No cambies el `name` interno de una pantalla/tab al corregir algo visual (label, icono) — solo lo visible (ver `.claude/rules/react-native.md`).
   - No añadas manejo de errores, validaciones o refactors no relacionados con el bug reportado.

7. Al terminar, confirma que la suite completa de Mobile pasa (`npm test` dentro de `Mobile/`) y resume qué causaba el bug y qué se cambió, en 2-3 frases.

No asumas la causa raíz sin haber leído el código real, y no escribas el fix antes que el test de regresión salvo que el usuario haya indicado explícitamente que quiere saltarse TDD.
