# API Design Skill

Aplicar cuando se diseña un nuevo contrato HTTP o se modifica uno existente.

---

## Propósito

Guiar el diseño de APIs REST consistentes, seguras y preparadas para evolucionar, asegurando que cada endpoint respete las convenciones del proyecto y los principios REST.

Usar este skill cuando:

- Se crea un nuevo endpoint o controlador.
- Se modifica la firma de un endpoint existente.
- Se define el contrato de respuesta o solicitud de un recurso.
- Se añade un nuevo recurso al API.
- Se cambia el comportamiento de un verbo HTTP sobre un recurso.

---

## Antes del Cambio

Analizar antes de tocar cualquier archivo:

### 1. Recurso afectado

- Identificar el recurso principal sobre el que opera el endpoint.
- Determinar si el recurso es independiente o está anidado bajo otro recurso padre.
- Verificar si ya existe un controlador para ese recurso en `src/services/mcp/CVL.SmartLocks.MCP.Api/Controllers/`.

### 2. Verbo HTTP correcto

| Verbo   | Uso                              | Idempotente |
|---------|----------------------------------|-------------|
| GET     | Obtener recurso(s)               | Sí          |
| POST    | Crear recurso nuevo              | No          |
| PUT     | Reemplazar recurso completo      | Sí          |
| PATCH   | Modificar parcialmente recurso   | No          |
| DELETE  | Eliminar recurso                 | Sí          |

- GET nunca debe modificar estado.
- POST para creación devuelve `201 Created` con ubicación del recurso.
- PUT requiere el recurso completo; PATCH solo los campos modificados.
- DELETE sobre recurso inexistente puede devolver `204 No Content`.

### 3. Ruta REST convencional

- Colecciones en plural: `/locations`, `/users`, `/access-groups`.
- Recurso individual: `/locations/{locationId}`.
- Sub-recursos obligatorios: `/locations/{locationId}/users` (la ubicación es parte de la identidad).
- Parámetros opcionales como filtros en query string: `?search=term&sortBy=name&page=1`.
- No usar verbos en la URL: evitar `/by-email`, `/activate`, `/deactivate`.

### 4. Códigos de respuesta

| Código | Cuándo usar                                    |
|--------|------------------------------------------------|
| 200    | GET exitoso, PUT/PATCH exitoso                 |
| 201    | POST de creación exitosa                       |
| 204    | DELETE exitoso, PUT/PATCH sin contenido retornado |
| 400    | Error de validación de solicitud               |
| 401    | No autenticado                                 |
| 403    | Sin permisos para el recurso                   |
| 404    | Recurso no encontrado                          |
| 409    | Conflicto de estado (recurso ya existe, etc.)  |
| 422    | Entidad procesable pero con errores de negocio |

### 5. Compatibilidad futura

- Diseñar respuestas como objetos, no primitivos sueltos. Facilita añadir campos sin romper clientes.
- Usar paginación en colecciones desde el inicio: `{ items: [], totalCount, page, pageSize }`.
- Versionar solo cuando sea estrictamente necesario; preferir extensiones compatibles.
- Los errores deben seguir la estructura de ProblemDetails del proyecto.

---

## Implementación

### 1. Estructura del Vertical Slice

Cada endpoint pertenece a un feature slice con esta estructura:

```
src/services/mcp/CVL.SmartLocks.MCP.Api/Features/{Feature}/
├── {Feature}Request.cs          # Query o Command (input)
├── {Feature}Response.cs         # Response DTO (output)
├── {Feature}Handler.cs          # Lógica de negocio
├── {Feature}Validator.cs        # Validación FluentValidation
└── {Feature}Endpoint.cs         # Registro del endpoint (Minimal API)
```

### 2. Controlador mínimo

- El controlador o endpoint solo recibe la solicitud y la despacha.
- Toda la lógica de negocio va en el handler.
- El handler devuelve `Result<T>` o `Result`.

### 3. Validación

- Usar FluentValidation en `{Feature}Validator.cs`.
- Validar campos permitidos para búsqueda y ordenación.
- Validar formato y rango de parámetros de paginación.

### 4. Respuesta

- Mapear desde el dominio al response DTO. No exponer entidades directamente.
- Incluir solo los campos necesarios; evitar sobre-exposición.
- Los tipos fuertes del dominio se convierten a primitivos en el response.

### 5. Contratos desacoplados

- El request/response no debe replicar la entidad de dominio.
- Cambios en la base de datos no deben implicar cambios en el contrato del API.
- Campos nuevos en el response son aditivos; no eliminar campos existentes sin versión nueva.

---

## Después del Cambio

### Verificar convención REST

- La ruta sigue el patrón de recursos, no de acciones.
- El verbo HTTP es correcto para la operación.
- Los códigos de respuesta son apropiados para cada caso.
- Los parámetros obligatorios van en la ruta, los opcionales en query string.

### Verificar estructura del slice

- El request, response, handler, validator y endpoint están en la carpeta del feature.
- No hay lógica de negocio en el controlador o endpoint.
- El handler devuelve `Result<T>` con error codes cuando falla.

### Verificar compilación

```
dotnet build src/services/mcp/CVL.SmartLocks.MCP.Api/
```

### Verificar pruebas

- Probar el handler con casos de éxito y los diferentes errores de negocio.
- Probar el validator con entradas válidas e inválidas.
- Evitar pruebas triviales que solo verifican infraestructura.

---

## Evitar

### ❌ Endpoints orientados a acciones internas

```
POST /users/activate        → usar PATCH /users/{id} con campo "active"
POST /users/change-email    → usar PATCH /users/{id} con campo "email"
GET  /users/by-email        → usar GET /users?email={email}
```

### ❌ Contratos acoplados a entidades

```csharp
// Mal: expone la entidad completa
public record UserResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string PasswordHash,      // nunca exponer
    string SecurityStamp,     // nunca exponer
    DateTime CreatedAt);
```

```csharp
// Bien: DTO con solo lo necesario
public record UserResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string Email);
```

### ❌ Cambios incompatibles

- Eliminar un campo del response sin versionar.
- Cambiar el tipo de un campo existente.
- Modificar la semántica de un endpoint sin cambiar la ruta.
- Reordenar parámetros obligatorios de la ruta.

---

## Patrones Comunes

### Crear recurso anidado

```
POST /locations/{locationId}/users
Body: { userId, roleIds }
Response: 201 Created
Location: /locations/{locationId}/users/{userId}
```

### Listar con filtros y paginación

```
GET /locations/{locationId}/users?search=term&sortBy=name&sortOrder=asc&page=1&pageSize=20
Response: 200 OK
Body: { items: [...], totalCount: 50, page: 1, pageSize: 20 }
```

### Actualizar parcialmente

```
PATCH /users/{userId}
Body: { email: "new@email.com" }
Response: 200 OK con recurso actualizado o 204 No Content
```

### Eliminar recurso

```
DELETE /locations/{locationId}/users/{userId}
Response: 204 No Content
```
