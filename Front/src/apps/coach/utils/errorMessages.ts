/**
 * Mapeo de códigos de error del backend a mensajes amigables en español
 * Estructura del error del backend:
 * {
 *   code: "LoginUserNotRegistered",
 *   message: "User not registered",
 *   detail: "..." (opcional)
 * }
 */

interface ErrorMapping {
  [key: string]: string;
}

const errorMessagesEs: ErrorMapping = {
  // Errores de autenticación
  LoginUserNotRegistered:
    "El usuario no está registrado. Por favor, verifica tu nombre de usuario o regístrate.",
  LoginInvalidPassword:
    "La contraseña es incorrecta. Por favor, intenta de nuevo.",
  LoginInvalidCredentials: "Usuario o contraseña incorrectos.",
  InvalidToken: "El token de autenticación es inválido o ha expirado.",
  TokenExpired: "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.",

  // Errores de registro
  UserAlreadyExists:
    "El usuario ya existe. Por favor, usa otro nombre de usuario.",
  EmailAlreadyExists: "El correo electrónico ya está registrado.",
  InvalidEmail: "El correo electrónico no es válido.",
  PasswordTooWeak:
    "La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.",

  // Errores de recuperación de contraseña
  UserNotFound: "No se encontró un usuario con ese correo electrónico.",
  InvalidResetToken:
    "El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.",
  PasswordResetExpired:
    "El enlace de recuperación ha expirado. Solicita uno nuevo.",

  // Errores genéricos
  BadRequest: "La solicitud es inválida. Por favor, verifica los datos.",
  Unauthorized: "No tienes permiso para acceder a este recurso.",
  Forbidden: "Acceso denegado.",
  NotFound: "El recurso solicitado no fue encontrado.",
  ServerError:
    "Ha habido un problema en el servidor. Por favor, intenta más tarde.",
  ServiceUnavailable:
    "El servicio no está disponible. Por favor, intenta más tarde.",
  NetworkError:
    "Ha habido un problema de conexión. Verifica tu conexión a internet.",
  TimeoutError: "La solicitud tardó demasiado. Por favor, intenta de nuevo.",
};

/**
 * Obtiene un mensaje amigable para un código de error o mensaje genérico
 * @param errorCode - Código de error del backend o mensaje de error
 * @param detail - Detalle adicional del error (opcional)
 * @returns Mensaje amigable en español
 */
export function getErrorMessage(errorCode?: string, detail?: string): string {
  if (!errorCode) {
    return "Ha ocurrido un error inesperado. Por favor, intenta de nuevo.";
  }

  // Si el código está en el mapeo, usa ese mensaje
  if (errorMessagesEs[errorCode]) {
    return errorMessagesEs[errorCode];
  }

  // Si hay un detalle específico y empieza con un código conocido, busca ese código
  if (detail && errorMessagesEs[detail]) {
    return errorMessagesEs[detail];
  }

  // Si el error code es genérico (BadRequest, Unauthorized, etc), intenta mapear por nombre
  if (errorMessagesEs[errorCode]) {
    return errorMessagesEs[errorCode];
  }

  // Fallback: si el detalle parece ser un mensaje del backend, úsalo
  if (detail && detail.length > 0) {
    return detail;
  }

  // Fallback final
  return "Ha ocurrido un error. Por favor, intenta de nuevo.";
}

/**
 * Mapea un objeto de error HTTP a un mensaje amigable
 * @param error - Error response del servidor
 * @returns Mensaje amigable en español
 */
export function mapApiErrorToMessage(error: any): string {
  // Estructura esperada del error: { code: "...", message: "...", detail: "..." }
  if (error.response?.data?.code) {
    return getErrorMessage(
      error.response.data.code,
      error.response.data.detail
    );
  }

  // Si es solo un mensaje simple
  if (error.response?.data?.detail) {
    return getErrorMessage(undefined, error.response.data.detail);
  }

  // Si es un error de status HTTP
  if (error.response?.status) {
    const status = error.response.status;
    if (status >= 400 && status < 500) {
      return getErrorMessage("BadRequest");
    } else if (status >= 500) {
      return getErrorMessage("ServerError");
    }
  }

  // Error de conexión
  if (error.code === "ECONNABORTED") {
    return getErrorMessage("TimeoutError");
  }

  if (error.message === "Network Error" || error.code === "ERR_NETWORK") {
    return getErrorMessage("NetworkError");
  }

  return getErrorMessage(undefined);
}
