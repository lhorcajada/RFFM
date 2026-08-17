# ADN del Modelo de Juego — especificación técnica de importación
### Cadete, Segundo Año, Segunda División

---

## Cambio de diseño respecto a la versión anterior

Hasta ahora este documento duplicaba el contenido del modelo en un formato propio (`Principio` con una `decision` de una sola frase, más `ZoneRule`, `Trigger` y `RuleException`), separado del nivel de detalle (`GameScenario → SubPrincipio → SubSubPrincipio → EssentialSkill`) que ya existía en la app como una cadena aparte. Ese diseño se ha quedado obsoleto: desde esta temporada, la identidad del equipo vive directamente en los Subprincipios y Sub-subprincipios — no en una frase genérica por Principio — y así es como está escrito `ADN-Modelo-de-Juego-Legible.md`.

**`ADN-Modelo-de-Juego-Legible.md` es ahora la única fuente de la verdad.** Este documento ya no duplica su contenido — define cómo se importa directamente: la jerarquía de entidades, cómo se derivan sus claves (`key`) a partir de la numeración y los títulos que ya existen en el legible, y cómo se resuelven los casos especiales. Cuando el legible cambie, el importador se vuelve a ejecutar sobre él — no hay un segundo documento de contenido que mantener sincronizado a mano.

---

## 0. Jerarquía de entidades

```
Fase                                    ← catálogo existente, GameMoments (5)
 └─ Principio                           ← "1." / "2." dentro de la Fase
     └─ Subprincipio                    ← "Subprincipio X.Y — Título."
         ├─ Zona (0..N)                 ← "Zona de...", "Todas las zonas.", casos compuestos (ver §3)
         │   └─ SubSubPrincipio (0..N)  ← "Sub-subprincipio X.Y.Z — Rol:"
         │       └─ Habilidad (0..N)    ← "Habilidad imprescindible — Nombre: texto (Entrenable: ...)"
         └─ SubSubPrincipio (0..N)      ← si el Subprincipio no varía por zona, cuelga directo del Subprincipio
             └─ Habilidad (0..N)
 └─ SetPieceRule (solo Fase balon-parado, estructura plana — ver §5)
 └─ Nota (0..N, en cualquier nivel)     ← excepciones, riesgos aceptados, objetivos de temporada
```

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

El legible sigue sus propias convenciones de forma consistente en todo el documento — el importador puede apoyarse en ellas sin necesitar heurísticas de lenguaje natural:

| Patrón en el markdown | Entidad |
|---|---|
| `## N. Título` | `Fase` |
| `N. **Título.** texto` (numerado, indentación mínima, dentro de una Fase) | `Principio` |
| `- **Subprincipio X.Y — Título.** texto` | `Subprincipio` |
| `- **Zona de X.**` / `- **Todas las zonas.**` / cabeceras equivalentes (ver §3) | `Zona` |
| `- **Sub-subprincipio X.Y.Z — Rol:** texto` | `SubSubPrincipio` |
| `- Habilidad imprescindible — **Nombre**: texto. (Entrenable: texto)` | `Habilidad`, con `nombre` (del vocabulario cerrado), `descripcion` y `entrenable` como campos separados |
| Línea envuelta en un solo asterisco (`*texto*`) | `Nota`; `tipo: riesgo-aceptado` si empieza con "Riesgo aceptado", `tipo: objetivo-temporada` si contiene "objetivo de temporada", `tipo: nota` en el resto — anclada al `Subprincipio`/`Zona` más cercano hacia arriba en el documento |
| La palabra "Excepción" dentro de un párrafo de `Subprincipio` o `Zona` | `Nota`, `tipo: excepcion`, mismo anclaje que arriba |
| `![caption](ruta)` | se ignora para el modelo de datos — es solo apoyo visual del legible, no dato importable |
| `(misma que X.Y.Z)` tras el nombre de una Habilidad | no se duplica la habilidad — se guarda como `referenciaA: "{faseSlug}-X.Y.Z"` en vez de repetir `descripcion`/`entrenable` |

---

## 3. Casos especiales de Zona (no son un `zoneKey` simple)

El legible tiene varias cabeceras de Zona que no son una única zona del catálogo. El importador debe resolverlas así, caso por caso, en vez de intentar adivinar un patrón genérico:

- **"Zona de Creación Propia / Iniciación (bloque medio)"** (Defensa organizada, Subprincipio 1.1) → `zoneKeys: [creacion-propia, iniciacion]`, con una `Nota` explicando que lo que define esta Zona es la posición relativa de la línea de presión respecto al resto del bloque, no la zona absoluta del campo.
- **"Zona de Finalización / Creación Rival / Creación Propia."** (Defensa organizada, Subprincipio 1.3) → `zoneKeys: [finalizacion, creacion-rival, creacion-propia]`.
- **"Balón cae entre Zona de Creación Rival y Zona de Creación Propia (extremo superado en Finalización)"** (Defensa organizada, Subprincipio 1.4) → `zoneKey: compuesta`, con `zona_texto` guardando el texto literal — este caso depende de dónde cae el balón tras un pase largo, no de dónde se defiende, y no encaja limpio en el catálogo de 4 zonas.
- **"Balón cae en Zona de Creación Rival."** / **"Balón cae en Zona de Creación Propia / Iniciación."** (mismo Subprincipio 1.4) → mismo tratamiento que el punto anterior.
- **"Zona de Iniciación y Zona de Creación Propia (campo propio)."** (Defensa organizada, Subprincipio 1.6) → `zoneKeys: [iniciacion, creacion-propia]`.
- **"Ataque del centro (ambas zonas)."** (Transición defensa-ataque, Subprincipio 2.1) → no es una Zona nueva — es una sub-agrupación dentro de las zonas ya definidas en ese Subprincipio (Creación Propia y Creación Rival). Se importa como `Zona` con `zoneKeys` heredadas del Subprincipio padre y un campo `label: "Ataque del centro"` para distinguirla de las otras Zonas del mismo Subprincipio.
- **"Todas las zonas."** → `zoneKey: todas`.

Cualquier cabecera de Zona nueva que aparezca en el futuro y no encaje en el catálogo de 4 zonas ni en los patrones de arriba debe tratarse como `compuesta` con `zona_texto` libre, nunca forzarse dentro de una zona del catálogo que no le corresponde.

---

## 4. Vocabulario cerrado de Habilidades

`Habilidad.nombre` debe ser uno de estos catorce valores — cualquier nombre que no esté en esta lista es un error de importación, no una habilidad nueva silenciosa:

**Perfilamiento, Anticipación, Activación, Carga, Temporización, Comunicación, Entrada, Conducción, Protección de balón, Control orientado, Pase, Centro, Remate, Remate de cabeza.**

Si el legible introduce una habilidad nueva en el futuro, hay que añadirla explícitamente a esta lista antes de que el importador la acepte — así se evita que una errata de redacción en el legible cree una habilidad fantasma en la base de datos.

---

## 5. Balón parado — estructura plana, no jerárquica

A diferencia de las otras cuatro fases, "## 5. Balón parado (ABP)" no tiene Subprincipios ni Zonas — es una lista plana de bloques `**Etiqueta.** texto`. Cada uno se importa como `SetPieceRule`:

```yaml
subtype: filosofia-general | corners-defensivos | corners-ofensivos | faltas-defendiendo |
  faltas-atacando | saques-banda | saque-porteria | penaltis | formato-reducido
fields:
  texto: "el contenido completo del bloque, sin trocear más"
notes: "Balón parado se trabaja con guiones cerrados, no con decisiones por rol — no hace
  falta descomponerlo en SubSubPrincipio/Habilidad como el resto de fases"
```

---

## 6. Ejemplo completo (caso de prueba para el importador)

Transcripción real de un fragmento del legible con sus entidades resultantes, de principio a fin — sirve como fixture de test antes de correr el importador sobre el documento completo:

```yaml
# Fuente: ADN-Modelo-de-Juego-Legible.md, "## 1. Defensa organizada"

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

- topic: "Transición ataque-defensa, Subprincipios 1.2, 1.3 y 1.4"
  description: "Contenido nuevo de esta temporada (abandonar la presión con un gatillo observable en vez de contar segundos, diferenciar riesgo asumido vs. error no forzado, comunicar el instante de la pérdida). Usarlo como caso de prueba adicional del importador, junto al ejemplo de §6, por ser el más reciente y menos probado."
  status: open
```

---

## 8. Notas sobre la importación

- El importador debe leer `ADN-Modelo-de-Juego-Legible.md` directamente, no una copia de su contenido — así se elimina el riesgo de que este documento y el legible digan cosas distintas, que era el problema real del diseño anterior.
- Los casos de §3 no cubiertos explícitamente deben rechazarse o marcarse como pendientes en vez de importarse con una zona adivinada.
- `Habilidad.nombre` fuera del vocabulario cerrado de §4 debe rechazarse, nunca crear una habilidad nueva de forma silenciosa.
- Las referencias `(misma que X.Y.Z)` deben resolverse contra una `key` ya importada; si esa key todavía no existe en el momento de procesar la referencia (porque el legible la define más adelante en el documento), el importador debe hacer una segunda pasada en vez de fallar.
- Un `OpenIssue` sin resolver es válido de importar como tal — no bloquea el resto del import, pero el formulario debería mostrarlo como "decisión pendiente" en vez de dejarlo vacío silenciosamente.
