## Context

- `Habilidad.Vocabulary` (`Domain/Aggregates/GameModels/Habilidad.cs`) es el vocabulario cerrado de 28
  habilidades. En el front está duplicado como `HABILIDAD_VOCABULARY` (`types/gameModel.ts`) y ya se usa
  en un `Autocomplete multiple` en `ModelRelationSection`.
- `PlayerModelObservation.Habilidades` es una `List<string>` jsonb que hoy siempre está vacía.
- `DomainException(categoría, mensaje, código)` se convierte en un `400` ProblemDetails
  (`ProblemDetailsMappingTests`).

## Decisions

### D1 · Dominio

- `Rules.MaxHabilidades = 5`.
- `ForGameModel(..., string? trainingSessionId = null, IEnumerable<string>? habilidades = null)` guarda
  las habilidades recortadas y sin duplicados.
- `Update(assessment, comment, IEnumerable<string>? habilidades = null)`:
  - si el tipo es `Attitude` y llegan habilidades, lanza `DomainException` con el código
    `HabilidadesNotAllowedForAttitude`;
  - con `null`, las habilidades no cambian;
  - con una lista, la sustituye.
- La validación de vocabulario y máximo es de entrada y va en los validators, con `Habilidad.Vocabulary`
  y `Rules.MaxHabilidades`; el dominio no la duplica.

### D2 · API

- `CreatePlayerObservation.Command.Habilidades: IReadOnlyList<string>?`. Validator:
  - con `GameModel`: cada habilidad está en el vocabulario, sin duplicados y como mucho 5;
  - con `Attitude`: vacío.
- `UpdatePlayerObservation.Command.Habilidades: IReadOnlyList<string>?`. Validator: vocabulario, sin
  duplicados y como mucho 5. La regla de tipo la aplica el dominio (D1).
- `PlayerObservationDto` añade al final `IReadOnlyList<string> Habilidades`.

### D3 · Front

- Tipos:
  - `PlayerObservation.habilidades: string[]`;
  - `CreatePlayerObservationRequest.habilidades?: string[]`;
  - `UpdatePlayerObservationRequest.habilidades?: string[]`.
- `HabilidadesPicker.tsx`: `Autocomplete multiple` con `HABILIDAD_VOCABULARY` y la etiqueta
  «Habilidades (opcional)». Con 5 elegidas, el resto de opciones se deshabilita (`getOptionDisabled`).
  Props: `value` y `onChange`.
- `RatingBlock` admite `habilidades?: string[]` en el borrador y una prop `withHabilidades`. Cuando está
  activa, muestra el `HabilidadesPicker` entre los botones y el comentario. La usan los bloques de
  subprincipio, no los de actitud.
- `SessionObservationForm`: las requests de modelo de juego llevan `habilidades` (vacío si no se
  eligió ninguna).
- `ObservationForm` («Sin sesión»): picker debajo de la valoración. La request lleva `habilidades`, y se
  limpian al guardar.
- `PlayerObservationCard`:
  - en lectura muestra las habilidades como `Chip` pequeños `outlined` bajo el subprincipio;
  - en edición, para modelo de juego, muestra el picker precargado y envía `habilidades`;
  - en edición de actitud, ni picker ni `habilidades`.

## Tests

- Dominio:
  - `ForGameModel` guarda las habilidades sin duplicados;
  - `Update` sustituye o mantiene (con `null`);
  - `Update` en actitud con habilidades → `DomainException`.
- Validators:
  - habilidad fuera del vocabulario;
  - más de 5;
  - duplicadas;
  - actitud con habilidades.
- Handler (Postgres): crear con habilidades las devuelve; editar las sustituye; el listado las devuelve.
- Front:
  - picker (máximo 5);
  - formulario de sesión y formulario suelto envían `habilidades`;
  - la tarjeta muestra los chips y edita las habilidades;
  - la actitud no muestra picker.
