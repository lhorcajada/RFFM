# Guardrails de Seguridad

## Nunca

- Registrar contraseñas, tokens o información sensible en logs.
- Exponer entidades internas del dominio directamente en las respuestas de la API.
- Confiar en datos enviados por el cliente sin validación del lado del servidor.
- Desactivar validaciones o restricciones de seguridad para facilitar una implementación.
- Guardar secretos, claves o credenciales en el código fuente o archivos de configuración del repositorio.
- Usar consultas SQL sin parametrizar o concatenar valores en cadenas SQL.
- Retornar detalles de excepciones internas o trazas de stack al cliente.
- Permitir acceso a recursos sin la autorización correspondiente.
- Ignorar errores de certificados o deshabilitar verificaciones TLS/SSL.
- Almacenar contraseñas en texto plano; siempre usar hashing seguro.

## Siempre

- Validar y sanitizar toda entrada proveniente del cliente con FluentValidation.
- Usar `Result.Failure(...)` con códigos de error definidos en constantes `*ErrorCodes`.
- Aplicar el principio de mínimo privilegio en permisos y roles.
- Usar tipos fuertes y enums en lugar de cadenas mágicas para valores del dominio.
- Parametrizar todas las consultas SQL y validar campos permitidos de búsqueda y ordenación.
- Devolver DTOs de respuesta, nunca entidades de dominio directamente.
- Cifrar datos sensibles en reposo y en tránsito.
- Registrar eventos de seguridad relevantes (accesos denegados, cambios de permisos) sin incluir datos sensibles.
- Revisar que los endpoints apliquen las políticas de autorización correspondientes.
