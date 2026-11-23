# Reglas de estado del backlog (GitHub Project "Futbol Base")

Cada issue del backlog tiene un campo **Status** en el proyecto GitHub "Futbol Base"
(`gh project 3`, propietario `lhorcajada`) con las columnas
`Backlog` → `Ready` → `In progress` → `In review` → `Done`.

El agente mueve el issue de forma automática, sin pedir confirmación, en estos hitos:

| Hito | Estado destino |
|---|---|
| Plan establecido y spec generada (proposal/specs listos) | `Ready` |
| Se empieza a implementar la tarea | `In progress` |
| Termina la implementación (código y tests listos, commit local o PR) | `In review` |
| Se despliega | `Done` |

- Aplica a todas las sesiones y a todas las rutas (OpenSpec, SAI, Direct Build, cambios manuales).
- Solo se mueve el issue de origen de la tarea; si no hay issue asociado, no se hace nada.
- No retroceder estados salvo petición del usuario.
- Cómo mover (ids actuales; releerlos con `gh project field-list 3 --owner lhorcajada --format json` si fallan):
  `gh project item-edit --project-id <project-id> --id <item-id> --field-id PVTSSF_lAHOASbSus4BqVFxzhosso8 --single-select-option-id <option-id>`
  con Ready `61e4505c`, In progress `47fc9ee4`, In review `df73e18b`, Done `98236657`.
- Informar al usuario en una línea de cada movimiento realizado.
