---
description: Recoge una solicitud de nueva funcionalidad (front, back o ambos) preguntando lo necesario paso a paso, y arranca el trabajo con el/los agente(s) correctos.
---

Vas a recoger una solicitud de nueva funcionalidad para FutbolBase. NO implementes nada todavía. Sigue este flujo:

1. Si el usuario ya incluyó información junto al comando (en `$ARGUMENTS`), úsala como respuesta inicial a las preguntas de abajo y no vuelvas a preguntar lo que ya esté claro.

2. Usa la herramienta AskUserQuestion para obtener, en el orden que tenga sentido, lo que falte de:
   - **Alcance**: Solo Frontend / Solo Backend / Frontend + Backend
   - **Qué quiere**: descripción breve de la funcionalidad (qué hace, quién la usa: Federación o Coach/Familia)
   - **Dónde encaja**: página/feature existente relacionada, si la conoce (o "no lo sé, búscalo")
   - **Flujo de trabajo**: usar OpenSpec (proposal → design → tasks → implement) o implementar directo

   No preguntes todo en una sola pregunta gigante: usa preguntas cortas y específicas (AskUserQuestion soporta hasta 4 por llamada). Si "Frontend + Backend", pregunta también si el contrato de API ya existe o hay que diseñarlo.

3. Pide los criterios de aceptación como texto libre (qué debe poder hacer el usuario al terminar) — esto no encaja bien como opción de botón, así que pídelo como pregunta abierta normal en el chat, no con AskUserQuestion.

4. Con toda la información reunida, resume la solicitud en un bloque corto (Alcance / Qué quiere / Dónde encaja / Criterios de aceptación / Flujo de trabajo) y muéstraselo al usuario para confirmación antes de tocar código.

5. Una vez confirmado:
   - Si el alcance es "Solo Frontend", usa el agente `front-specialist`.
   - Si el alcance es "Solo Backend", usa el agente `back-specialist`.
   - Si es "Frontend + Backend", coordina ambos (puedes lanzarlos en paralelo si las partes son independientes, o backend primero si el frontend depende del contrato de API).
   - Si el usuario pidió OpenSpec, sigue el flujo proposal → design → tasks → implement antes de escribir código.
   - Si pidió implementación directa mas la funcionalidad no es trivial, recuerda igualmente la metodología TDD (Red → Green → Refactor) definida en CLAUDE.md.

No asumas alcance, agente ni flujo de trabajo sin que el usuario los haya confirmado explícitamente.
