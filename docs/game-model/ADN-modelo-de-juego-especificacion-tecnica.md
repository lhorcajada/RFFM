# ADN del Modelo de Juego — especificación técnica de importación
### Cadete, Primer Año, Segunda División

---

## Cambio de diseño respecto a la versión anterior

Hasta ahora este documento duplicaba el contenido del modelo en un formato propio (`Principio` con una `decision` de una sola frase, más `ZoneRule`, `Trigger` y `RuleException`), separado del nivel de detalle (`GameScenario → SubPrincipio → SubSubPrincipio → EssentialSkill`) que ya existía en la app como una cadena aparte. Ese diseño se ha quedado obsoleto: desde esta temporada, la identidad del equipo vive directamente en los Subprincipios y Sub-subprincipios — no en una frase genérica por Principio — y así es como está escrito `ADN-Modelo-de-Juego-Legible.md`.

**`ADN-Modelo-de-Juego-Legible.md` es ahora la única fuente de la verdad.** Este documento ya no duplica su contenido — define cómo se importa directamente: la jerarquía de entidades, cómo se derivan sus claves (`key`) a partir de la numeración y los títulos que ya existen en el legible, y cómo se resuelven los casos especiales. Cuando el legible cambie, el importador se vuelve a ejecutar sobre él — no hay un segundo documento de contenido que mantener sincronizado a mano.

**Segundo cambio de formato, esta vez de sintaxis (no de modelo de datos).** El legible pasó de usar negrita + numeración dentro de listas anidadas (`- **Subprincipio X.Y — Título.** texto`) a usar encabezados Markdown/Word reales, uno por nivel de la jerarquía (Fase en H1, Principio en H2, Subprincipio en H3, Zona en H4, Sub-subprincipio en H5), con el texto descriptivo como párrafo aparte debajo del encabezado, no en la misma línea. Las entidades y su jerarquía no cambian — solo cambia el patrón de texto que el importador debe reconocer. §2 de este documento describe el patrón nuevo.

---

## 0. Jerarquía de entidades

```
Fase                                    ← catálogo existente, GameMoments (5) — encabezado H1
 └─ Principio                           ← encabezado H2: "Principio N — Título."
     └─ Subprincipio                    ← encabezado H3: "Subprincipio X.Y — Título."
         ├─ Zona (0..N)                 ← encabezado H4: "Zona de...", "Todas las zonas.", casos compuestos (ver §3)
         │   └─ SubSubPrincipio (0..N)  ← encabezado H5: "Sub-subprincipio X.Y.Z — Rol"
         │       └─ Habilidad (0..N)    ← viñeta: "Habilidad imprescindible — Nombre: texto (Entrenable: ...)"
         └─ SubSubPrincipio (0..N)      ← si el Subprincipio no varía por zona, cuelga directo del Subprincipio (sin H4 de por medio)
             └─ Habilidad (0..N)
 (SetPieceRule queda obsoleto esta temporada — Balón parado sigue la jerarquía estándar de arriba, ver §5)
 └─ Nota (0..N, en cualquier nivel)     ← excepciones, riesgos aceptados, objetivos de temporada — viñeta en cursiva
```

Cada nivel de la jerarquía (Fase, Principio, Subprincipio, Zona, Sub-subprincipio) es un encabezado real seguido de su texto descriptivo como párrafo aparte — el título va solo en el encabezado, nunca repetido ni mezclado con el cuerpo del texto.

Diferencias clave con el diseño anterior: `ZoneRule`, `Trigger` y `RuleException` desaparecen como entidades separadas. Un `Trigger` de antes es ahora, casi siempre, directamente un `Subprincipio` con su propia numeración (p. ej. cada gatillo de "Recuperar el balón" en Defensa organizada es un Subprincipio, no un Trigger colgado de otro Principio) o una condición dentro de una `Zona`. Las excepciones puntuales (antes `RuleException`) pasan a ser `Nota` de tipo `excepcion`, ancladas al nivel que corresponda — ya no referencian un `Trigger` por id, referencian directamente el `Subprincipio`, la `Zona` o el `SubSubPrincipio` del que matizan el comportamiento.

---

## 1. Reglas de derivación de claves (`key`)

Todas las claves se derivan mecánicamente de lo que ya está escrito en el legible — no son inventadas por el importador, así que dos ejecuciones del import sobre el mismo legible producen siempre las mismas keys (necesario para poder hacer upsert en vez de duplicar filas).

| Entidad | Cómo se deriva la key | Ejemplo |
|---|---|---|
| `Fase` | tabla fija de slugs (igual que en el diseño anterior) | `defensa-organizada` |
| `Principio` | `{faseSlug}-{número}` | `defensa-organizada-1` |
| `Subprincipio` | `{faseSlug}-{X.Y}` (el número ya viene literal en "Subprincipio X.Y") | `defensa-organizada-1.1` |
| `Zona` | `{faseSlug}-{X.Y}-{zoneKey}`, usando el/los `zoneKey` del catálogo, `todas`, o `compuesta` con `zona_texto` libre si no encaja (ver §3) | `defensa-organizada-1.1-finalizacion` |
| `SubSubPrincipio` | `{faseSlug}-{X.Y.Z}` (el número ya viene literal en "Sub-subprincipio X.Y.Z") | `defensa-organizada-1.1.1` |
| `Habilidad` | no necesita key propia — referencia `subsubprincipioKey` + `nombre` (del vocabulario cerrado, §4) | — |

```
faseSlug: defensa-organizada | ataque-organizado | transicion-defensa-ataque | transicion-ataque-defensa | balon-parado
zoneKey:  iniciacion | creacion-propia | creacion-rival | finalizacion | todas | compuesta
```

`faseSlug` y `zoneKey` deben mapearse a los `Id` numéricos de `GameMoments`/`GameZones` en el importador — esa tabla de correspondencia ya existía en el diseño anterior y no cambia.

---

## 2. Reglas de parseo (markdown → entidad)

El legible sigue sus propias convenciones de forma consistente en todo el documento — el importador puede apoyarse en ellas sin necesitar heurísticas de lenguaje natural. Cada entidad de nivel Fase a Sub-subprincipio es un **encabezado** seguido de su **texto** como párrafo(s) aparte, hasta el siguiente encabezado del mismo nivel o superior:

| Patrón en el markdown | Entidad |
|---|---|
| `# N. Título` | `Fase` |
| `## Principio N — Título.` seguido de párrafo(s) | `Principio` |
| `### Subprincipio X.Y — Título.` seguido de párrafo(s) | `Subprincipio` |
| `#### Zona de X.` / `#### Todas las zonas.` / cabeceras equivalentes (ver §3), seguido de párrafo(s) opcional | `Zona` |
| `##### Sub-subprincipio X.Y.Z — Rol` (sin dos puntos en el encabezado) seguido de párrafo(s) | `SubSubPrincipio`, con `rol` = el texto tras el guion en el encabezado |
| `-   Habilidad imprescindible — **Nombre**: texto. (Entrenable: texto)` (viñeta, sin cambios respecto al formato anterior) | `Habilidad`, con `nombre` (del vocabulario cerrado), `descripcion` y `entrenable` como campos separados |
| `-   *texto*` (viñeta en cursiva, al mismo nivel que las Habilidades del Sub-subprincipio o Zona a la que pertenece) | `Nota`; `tipo: riesgo-aceptado` si empieza con "Riesgo aceptado", `tipo: objetivo-temporada` si contiene "objetivo de temporada", `tipo: nota` en el resto — anclada al `Subprincipio`/`Zona`/`SubSubPrincipio` más cercano hacia arriba en el documento |
| `*Nota — Etiqueta.* texto` (cursiva solo en la etiqueta inicial, seguida de texto normal, como párrafo independiente fuera de cualquier lista) | `Nota` de tipo `nota`, anclada a la `Fase` directamente (nota transversal, no de un Principio concreto) |
| La palabra "Excepción" dentro de un párrafo de `Subprincipio` o `Zona` | `Nota`, `tipo: excepcion`, mismo anclaje que arriba |
| `![caption](ruta)` | se ignora para el modelo de datos — es solo apoyo visual del legible, no dato importable |
| `(misma que X.Y.Z)` tras el nombre de una Habilidad | no se duplica la habilidad — se guarda como `referenciaA: "{faseSlug}-X.Y.Z"` en vez de repetir `descripcion`/`entrenable` |
| Texto de párrafo que empieza con paréntesis, sin frase completa (p. ej. `(mismo criterio que 1.2.4).`) | `SubSubPrincipio.texto` literal tal cual — es una referencia cruzada abreviada en vez de una descripción completa, válida así, no es un error de importación |

**Nota sobre capitalización:** el texto de cuerpo bajo cada encabezado empieza siempre en mayúscula (frase completa); el texto dentro de una Habilidad tras "Nombre:" sigue en minúscula salvo nombre propio, igual que en el diseño anterior. El importador no debe normalizar mayúsculas — debe respetar literalmente lo que hay en el legible.

---

## 3. Casos especiales de Zona (no son un `zoneKey` simple)

El legible tiene varias cabeceras de Zona que no son una única zona del catálogo. El importador debe resolverlas así, caso por caso, en vez de intentar adivinar un patrón genérico:

- **"Zona de Creación Propia / Iniciación (bloque medio)"** (Defensa organizada, Subprincipio 1.1) → `zoneKeys: [creacion-propia, iniciacion]`, con una `Nota` explicando que lo que define esta Zona es la posición relativa de la línea de presión respecto al resto del bloque, no la zona absoluta del campo.
- **"Zona de Finalización / Creación Rival / Creación Propia."** (Defensa organizada, Subprincipio 1.3) → `zoneKeys: [finalizacion, creacion-rival, creacion-propia]`.
- **"Balón cae entre Zona de Creación Rival y Zona de Creación Propia (extremo superado en Finalización)"** (Defensa organizada, Subprincipio 1.4) → `zoneKey: compuesta`, con `zona_texto` guardando el texto literal — este caso depende de dónde cae el balón tras un pase largo, no de dónde se defiende, y no encaja limpio en el catálogo de 4 zonas.
- **"Balón cae en Zona de Creación Rival."** / **"Balón cae en Zona de Creación Propia / Iniciación."** (mismo Subprincipio 1.4) → mismo tratamiento que el punto anterior.
- **"Zona de Iniciación y Zona de Creación Propia (campo propio)."** (Defensa organizada, Subprincipio 1.6) → `zoneKeys: [iniciacion, creacion-propia]`.
- **"Ataque del centro (ambas zonas)."** (Transición defensa-ataque, Subprincipio 2.1) → es un encabezado `#### Ataque del centro (ambas zonas).` real, pero no corresponde a una única zona del catálogo — es una sub-agrupación dentro de las zonas ya definidas en ese Subprincipio (Creación Propia y Creación Rival). Se importa como `Zona` con `zoneKeys` heredadas del Subprincipio padre y un campo `label: "Ataque del centro"` para distinguirla de las otras Zonas del mismo Subprincipio.
- **"Todas las zonas."** → `zoneKey: todas`.

Cualquier cabecera de Zona nueva que aparezca en el futuro y no encaje en el catálogo de 4 zonas ni en los patrones de arriba debe tratarse como `compuesta` con `zona_texto` libre, nunca forzarse dentro de una zona del catálogo que no le corresponde.

---

## 4. Vocabulario cerrado de Habilidades

`Habilidad.nombre` debe ser uno de estos quince valores — cualquier nombre que no esté en esta lista es un error de importación, no una habilidad nueva silenciosa:

**Perfilamiento, Anticipación, Activación, Carga, Temporización, Comunicación, Entrada, Intercepción, Conducción, Protección de balón, Control orientado, Pase, Centro, Remate, Remate de cabeza.**

Si el legible introduce una habilidad nueva en el futuro, hay que añadirla explícitamente a esta lista antes de que el importador la acepte — así se evita que una errata de redacción en el legible cree una habilidad fantasma en la base de datos.

---

## 5. Balón parado — jerarquía completa (cambio de diseño esta temporada)

Hasta la reestructuración de esta temporada, "## 5. Balón parado (ABP)" era una lista plana de bloques `SetPieceRule`, sin Subprincipios ni Zonas, por tratarse de guiones cerrados. Se ha comprobado que un guion cerrado también se descompone bien por rol (un jugador nombrado ejecuta un gesto concreto), así que Balón parado ahora sigue la misma jerarquía `Principio → Subprincipio → Zona (0..N) → SubSubPrincipio → Habilidad` que el resto de fases, con seis Principios (uno por subtipo: Córners, Faltas, Saques de banda, Saque de portería, Penaltis, Saque de centro) en vez de dos genéricos (defensivo/ofensivo).

Diferencia respecto al resto de fases: el tipo de Habilidad que predomina aquí es de **ejecución técnica repetible** (mismo gesto, misma posición, cada vez), no de **lectura o decisión en tiempo real** como en las otras cuatro fases — pero se importa exactamente igual, usando el mismo vocabulario cerrado de §4.

**Caso especial — Saque de portería.** Este Principio (el 4 de la fase) no lleva Subprincipios propios: su texto es una `Nota` de tipo `referencia-cruzada` que apunta a Ataque organizado, Principio 3 ("Decidir y ejecutar la salida de balón en el saque de puerta"), donde está desarrollado por completo. El importador no debe generar Subprincipios vacíos para este Principio — solo el Principio con su Nota de referencia.

**Notas transversales que no cuelgan de ningún Principio concreto:** "Filosofía general" (única excepción deliberada a la flexibilidad del resto del modelo) y "Formato reducido" (no aplica, el club no lo pide) se importan como `Nota` de fase, ancladas a la `Fase` balon-parado directamente, no a ningún Principio.

---

## 6. Ejemplo completo (caso de prueba para el importador)

Fragmento real del legible en su sintaxis actual de encabezados:

```markdown
# 1. Defensa organizada

## Principio 1 — No permitir progresar al rival.

Objetivo transversal de toda la fase: impedir que el rival avance hacia nuestra portería, sin especificar todavía la vía concreta (puede ser por dentro, por fuera o en profundidad — eso lo definen los subprincipios).

### Subprincipio 1.1 — Evitar que el rival supere nuestra primera línea de presión.

Una de las formas de no dejar progresar al rival es no permitirle superar con comodidad la línea más adelantada de presión, obligándole a jugar hacia atrás, hacia los lados, o a perder el balón directamente ahí.

#### Zona de Finalización.

La zona más cercana a la portería rival — aquí el equipo presiona altísimo, buscando robar lo más lejos posible de nuestra portería. Se aceptan riesgos calculados. Sistema base asumido: 1-4-2-3-1.

##### Sub-subprincipio 1.1.1 — Delantero

Arranca desde el carril central pegado al área, presiona al central con balón, corriendo en curva entre el central y el portero, para obligarle a centrar hacia la banda.

-   Habilidad imprescindible — **Activación**: arranca la presión en cuanto detecta el movimiento del balón hacia el central, no cuando ya lo ha recibido o controlado. (Entrenable: presión iniciada a la señal del pase hacia el central, penalizando la salida tardía tras la recepción.)
-   Habilidad imprescindible — **Perfilamiento**: orienta el cuerpo en la carrera describiendo una curva, para cerrar la vía de pase más segura (hacia atrás) y forzar el pase lateral. (Entrenable: ejercicios de presión al central con portero, evaluando si el ángulo de aproximación cierra la vía de vuelta.)
-   *Riesgo aceptado: el lateral opuesto rival queda completamente libre. Se acepta porque está lejos del balón y del peligro inmediato — la recompensa de robar cerca de su área compensa el riesgo.*
```

Entidades resultantes de ese fragmento:

```yaml
- entity: Principio
  key: defensa-organizada-1
  faseSlug: defensa-organizada
  numero: 1
  titulo: "No permitir progresar al rival"
  texto: "Objetivo transversal de toda la fase: impedir que el rival avance hacia nuestra portería, sin especificar todavía la vía concreta (puede ser por dentro, por fuera o en profundidad — eso lo definen los subprincipios)."

- entity: Subprincipio
  key: defensa-organizada-1.1
  principioKey: defensa-organizada-1
  numero: "1.1"
  titulo: "Evitar que el rival supere nuestra primera línea de presión"
  texto: "Una de las formas de no dejar progresar al rival es no permitirle superar con comodidad la línea más adelantada de presión, obligándole a jugar hacia atrás, hacia los lados, o a perder el balón directamente ahí."

- entity: Zona
  key: defensa-organizada-1.1-finalizacion
  subprincipioKey: defensa-organizada-1.1
  zoneKeys: [finalizacion]
  texto: "La zona más cercana a la portería rival — aquí el equipo presiona altísimo, buscando robar lo más lejos posible de nuestra portería. Se aceptan riesgos calculados. Sistema base asumido: 1-4-2-3-1."

- entity: SubSubPrincipio
  key: defensa-organizada-1.1.1
  zonaKey: defensa-organizada-1.1-finalizacion
  numero: "1.1.1"
  rol: "Delantero"
  texto: "Arranca desde el carril central pegado al área, presiona al central con balón, corriendo en curva entre el central y el portero, para obligarle a centrar hacia la banda."

- entity: Habilidad
  subsubprincipioKey: defensa-organizada-1.1.1
  nombre: Activación
  descripcion: "Arranca la presión en cuanto detecta el movimiento del balón hacia el central, no cuando ya lo ha recibido o controlado."
  entrenable: "Presión iniciada a la señal del pase hacia el central, penalizando la salida tardía tras la recepción."

- entity: Habilidad
  subsubprincipioKey: defensa-organizada-1.1.1
  nombre: Perfilamiento
  descripcion: "Orienta el cuerpo en la carrera describiendo una curva, para cerrar la vía de pase más segura (hacia atrás) y forzar el pase lateral."
  entrenable: "Ejercicios de presión al central con portero, evaluando si el ángulo de aproximación cierra la vía de vuelta."

- entity: Nota
  appliesTo: defensa-organizada-1.1-finalizacion
  tipo: riesgo-aceptado
  texto: "El lateral opuesto rival queda completamente libre. Se acepta porque está lejos del balón y del peligro inmediato — la recompensa de robar cerca de su área compensa el riesgo."
```

---

## 7. Pendientes abiertos (`OpenIssue`)

```yaml
- topic: "Revisión de coherencia de los escenarios ya construidos"
  description: "Defensa organizada / zona de iniciación, contra este ADN, especialmente en el uso del fuera de juego por zona. Se hará más adelante (pendiente heredado del legible, ver su sección final)."
  status: open

- topic: "Migración de los GameScenario existentes"
  description: "Los GameScenario/SubPrincipio/SubSubPrincipio/EssentialSkill ya creados en la app bajo el diseño anterior (separados del ADN de identidad) deben revisarse uno a uno contra el legible actual y migrarse a esta jerarquía unificada, o marcarse obsoletos si ya están cubiertos por un Subprincipio del legible."
  status: open

- topic: "Transición ataque-defensa, Principio 1 (Subprincipios 1.2–1.5) y Principio 2 nuevo (Subprincipio 2.1)"
  description: "Contenido nuevo de esta temporada, con reclasificación incluida: el Subprincipio 1.2 original (abandonar la presión con un gatillo observable) se promovió a Principio 2 completo (Subprincipio 2.1, + Sub-subprincipio 2.1.4 de portero nuevo); el antiguo 1.3 (riesgo asumido vs. error no forzado) pasó a 1.2; se añadieron 1.3 (inferioridad numérica, con portero) y 1.4 (superioridad numérica, con portero) como subprincipios nuevos; el antiguo 1.4 (comunicar el instante de la pérdida) pasó a 1.5. Usarlo como caso de prueba adicional del importador, junto al ejemplo de §6, por ser el más reciente y menos probado, y por incluir el primer caso real de renumeración/reclasificación de contenido ya importado previamente."
  status: open

- topic: "Ataque organizado, Principio 3 nuevo (saque de puerta)"
  description: "Principio nuevo completo — Subprincipio 3.1 (decisión corto/largo por gatillo de 3 fallos consecutivos + excepción de los últimos 15 minutos de la primera parte, condicionada al marcador), 3.2 (ejecutar corto), 3.3 (ejecutar largo con balón en la mano), 3.4 (ejecutar largo a balón parado). El Subprincipio 3.1 tiene una regla de estado con memoria entre saques (contador de fallos consecutivos, más una condición de tiempo de partido y de marcador) que no encaja en el modelo simple de Zona/gatillo puntual del resto del documento — probablemente necesite un campo o entidad propia (algo como `ReglaConEstado` o similar) en vez de forzarlo dentro de la Nota o el texto del Subprincipio. Revisar antes de importar."
  status: open

- topic: "Migración de sintaxis del legible — negrita+numeración a encabezados reales"
  description: "El legible cambió de patrón de texto: de listas anidadas con negrita ('- **Subprincipio X.Y — Título.** texto') a encabezados Markdown/Word reales por nivel (H1 Fase, H2 Principio, H3 Subprincipio, H4 Zona, H5 Sub-subprincipio), con el texto como párrafo aparte. El modelo de datos y la jerarquía de entidades no cambian, solo el patrón de reconocimiento."
  status: resolved
  resolution: "§0, §2, §3 y §6 de este documento ya describen y ejemplifican el patrón nuevo. Si el importador ya estaba construido contra el patrón antiguo, sigue haciendo falta actualizar el parser una vez, antes de la próxima ejecución — importar con el parser viejo sobre el legible nuevo no reconocería ninguna entidad."

- topic: "Balón parado — migración de estructura plana (SetPieceRule) a jerárquica"
  description: "Balón parado pasó de ser una lista plana de bloques a seguir la jerarquía Principio → Subprincipio → Zona → SubSubPrincipio → Habilidad, con seis Principios (uno por subtipo: Córners, Faltas, Saques de banda, Saque de portería, Penaltis, Saque de centro). Los `SetPieceRule` ya importados bajo el diseño anterior (si los hay) deben migrarse a esta jerarquía o marcarse obsoletos. Caso especial: el Principio 4 (Saque de portería) no lleva Subprincipios — su texto es una Nota de referencia cruzada a Ataque organizado Principio 3, no debe generar Subprincipios vacíos. El Subprincipio 2.1/2.2 (Faltas) usa Zonas por distancia/posición del golpeo (Directa frontal, Directa lateral, Intermedia frontal, Intermedia lateral, Lejana) en vez de las 4 Zonas del catálogo de campo — tratar como caso especial de §3, con `zona_texto` libre."
  status: open
- topic: "Transición defensa-ataque — reclasificación de la Zona de Iniciación"
  description: "Principio 1 y Subprincipio 1.1 renombrados a 'Asegurar posesión del balón (tras robo)'; la Zona de Iniciación (salida directa a banda bajo presión) se sacó de ahí porque es en realidad una forma de verticalidad, no de conservar la posesión. Ese contenido pasó a ser el Subprincipio 2.4 nuevo ('Ejecutar la verticalidad cuando se roba dentro de área propia'), con su Nota de riesgo aceptado movida con él. Además, Subprincipio 2.3 ganó una Zona de Iniciación explícita que antes no tenía (sus Sub-subprincipios 2.3.1-2.3.3 colgaban directo del Subprincipio, sin Zona). Usarlo como caso de prueba de reclasificación de contenido ya importado, junto con el de Transición ataque-defensa."
  status: open
```

---

## 8. Notas sobre la importación

- El importador debe leer `ADN-Modelo-de-Juego-Legible.md` directamente, no una copia de su contenido — así se elimina el riesgo de que este documento y el legible digan cosas distintas, que era el problema real del diseño anterior.
- Los casos de §3 no cubiertos explícitamente deben rechazarse o marcarse como pendientes en vez de importarse con una zona adivinada.
- `Habilidad.nombre` fuera del vocabulario cerrado de §4 debe rechazarse, nunca crear una habilidad nueva de forma silenciosa.
- Las referencias `(misma que X.Y.Z)` deben resolverse contra una `key` ya importada; si esa key todavía no existe en el momento de procesar la referencia (porque el legible la define más adelante en el documento), el importador debe hacer una segunda pasada en vez de fallar.
- Un `OpenIssue` sin resolver es válido de importar como tal — no bloquea el resto del import, pero el formulario debería mostrarlo como "decisión pendiente" en vez de dejarlo vacío silenciosamente.
