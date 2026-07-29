# Spec — Board Text Objects

## ADDED Requirements

### Requirement: Pestaña de texto en el editor de ejercicios

La barra inferior del editor de ejercicios (`coach/trainings/new-exercise`) SHALL incluir una pestaña "Texto", mutuamente excluyente con Chapas/Espacios/Material/Líneas, que muestra un strip con los controles de estilo del texto.

#### Scenario: Activar la pestaña Texto

- **WHEN** el coach pulsa el botón "Texto"
- **THEN** se muestra el strip de texto con controles de fuente, tamaño, negrita, cursiva y color
- **AND** cualquier otra pestaña activa se desactiva

### Requirement: Colocar y editar objetos de texto

Con la pestaña Texto activa, un clic en el campo SHALL crear un objeto de texto en ese punto con el estilo activo, entrando en edición. Un doble clic sobre un texto colocado SHALL permitir editar su contenido en línea.

#### Scenario: Crear un texto

- **WHEN** el coach hace clic en un punto libre del campo con la pestaña Texto activa
- **THEN** se crea un objeto de texto en ese punto con la fuente, tamaño, tipo y color activos, listo para escribir

#### Scenario: Editar contenido

- **WHEN** el coach hace doble clic sobre un texto colocado y modifica su contenido
- **THEN** al confirmar (blur o Enter) el texto muestra el nuevo contenido
- **AND** si el contenido queda vacío, el objeto se elimina

### Requirement: Estilo tipográfico configurable

Cada objeto de texto SHALL tener fuente (lista fija de familias), tamaño, negrita, cursiva y color configurables, tanto antes de crearlo (estilo activo) como después (con el texto seleccionado).

#### Scenario: Cambiar estilo de un texto existente

- **WHEN** el coach selecciona un texto colocado y cambia fuente, tamaño, negrita/cursiva o color en el strip
- **THEN** el texto seleccionado se re-renderiza con el nuevo estilo

### Requirement: Comportamiento como objeto del tablero

Los objetos de texto SHALL soportar mover (drag), redimensionar, rotar, bloquear, duplicar y borrar, igual que el resto de objetos del tablero.

#### Scenario: Texto bloqueado

- **WHEN** un texto está bloqueado
- **THEN** no puede moverse, redimensionarse ni eliminarse por arrastre fuera del campo hasta desbloquearlo

### Requirement: Persistencia con el ejercicio

Los objetos de texto SHALL serializarse dentro de `boardStateJson` (`placedTexts`) y restaurarse al cargar el ejercicio. Los boards guardados sin `placedTexts` SHALL cargar sin errores.

#### Scenario: Guardar y recargar

- **WHEN** el coach guarda un ejercicio con textos y lo vuelve a abrir
- **THEN** los textos aparecen en la misma posición y con el mismo contenido y estilo

#### Scenario: Board antiguo

- **WHEN** se abre un ejercicio guardado antes de esta funcionalidad
- **THEN** el tablero carga normalmente sin objetos de texto
