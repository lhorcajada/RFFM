---
description: Recoge una solicitud de nueva funcionalidad específica para Mobile (Expo/React Native, Coach/Familia) preguntando lo necesario paso a paso, y arranca el trabajo con el agente mobile-specialist.
---

Vas a recoger una solicitud de nueva funcionalidad para la app **Mobile** de FutbolBase (Expo / React Native, app única de Coach/Familia — no confundir con `Front/`, que es el SPA de Federación + Coach). NO implementes nada todavía.

1. Si el usuario ya incluyó información junto al comando (en `$ARGUMENTS`), úsala como respuesta inicial a las preguntas de abajo y no vuelvas a preguntar lo que ya esté claro.

2. Usa la herramienta AskUserQuestion para obtener, en el orden que tenga sentido, lo que falte de:
   - **Qué quiere**: descripción breve de la funcionalidad (qué hace, en qué pantalla o flujo encaja)
   - **Dónde encaja**: pantalla existente relacionada si la conoce (ej. `CalendarScreen`, `PlayerSeasonCardsScreen`), o "no lo sé, búscalo"
   - **Tipo de cambio**: Pantalla nueva / Cambio en pantalla existente / Cambio de navegación (tabs, stack) / Llamada nueva a la API (`api/`)
   - **Flujo de trabajo**: usar OpenSpec (proposal → design → tasks → implement) o implementar directo

   No preguntes todo en una sola pregunta gigante: usa preguntas cortas y específicas (AskUserQuestion soporta hasta 4 por llamada).

3. Si el cambio requiere datos que hoy no expone el backend, pregúntalo como texto libre: ¿el endpoint ya existe o hay que coordinarlo con `back-specialist`?

4. Pide los criterios de aceptación como texto libre (qué debe poder hacer el usuario al terminar) — pregunta abierta normal en el chat, no con AskUserQuestion.

5. Recuerda mentalmente (no hace falta preguntarlo) que antes de tocar cualquier API de Expo o config de navegación hay que consultar la documentación versionada exacta (`https://docs.expo.dev/versions/v57.0.0/`, ver `Mobile/AGENTS.md`) en vez de asumir comportamiento de versiones anteriores.

6. Con toda la información reunida, resume la solicitud en un bloque corto (Qué quiere / Dónde encaja / Tipo de cambio / Dependencia de backend / Criterios de aceptación / Flujo de trabajo) y muéstraselo al usuario para confirmación antes de tocar código.

7. Una vez confirmado:
   - Usa el agente `mobile-specialist` para toda la parte de `Mobile/`.
   - Si hay dependencia de un endpoint nuevo o cambiado, coordina con `back-specialist` primero (Mobile depende del contrato de API).
   - Si el usuario pidió OpenSpec, sigue el flujo proposal → design → tasks → implement antes de escribir código.
   - Si pidió implementación directa y la funcionalidad no es trivial, recuerda igualmente la metodología TDD (Red → Green → Refactor) de `CLAUDE.md`, con Jest + Testing Library for React Native.

No asumas alcance, pantalla, agente ni flujo de trabajo sin que el usuario los haya confirmado explícitamente.
