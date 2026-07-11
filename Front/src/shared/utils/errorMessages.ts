/**
 * Traduce códigos de error del backend a mensajes amigables usando i18next
 * (namespace `errors`, ver `src/shared/i18n`).
 *
 * Estructura esperada del error del backend (RFC 7807 ProblemDetails):
 * {
 *   code: "EmailIsAlreadyTaken",
 *   title: "...",
 *   detail: "..." (opcional)
 * }
 */
import { useCallback } from "react";
import i18next from "../i18n/i18n";

const GENERIC_FALLBACK_KEY = "UnknownError";

/**
 * Obtiene un mensaje amigable, en el idioma activo, para un código de error.
 * @param errorCode - Código de error del backend
 * @param detail - Detalle adicional del error (opcional), usado como fallback
 * @returns Mensaje amigable en el idioma activo
 */
export function getErrorMessage(errorCode?: string, detail?: string): string {
  if (!errorCode) {
    if (detail && detail.length > 0) {
      return detail;
    }
    return i18next.t(`errors:${GENERIC_FALLBACK_KEY}`);
  }

  const hasTranslation = i18next.exists(`errors:${errorCode}`);
  if (hasTranslation) {
    return i18next.t(`errors:${errorCode}`);
  }

  // Si hay un detalle específico y coincide con un código conocido, úsalo.
  if (detail && i18next.exists(`errors:${detail}`)) {
    return i18next.t(`errors:${detail}`);
  }

  // Fallback: si el detalle parece ser un mensaje del backend, úsalo.
  if (detail && detail.length > 0) {
    return detail;
  }

  return i18next.t(`errors:${GENERIC_FALLBACK_KEY}`);
}

/**
 * Mapea un objeto de error de Axios a un mensaje amigable en el idioma activo.
 * @param error - Error response del servidor (AxiosError-like)
 * @returns Mensaje amigable en el idioma activo
 */
export function mapApiErrorToMessage(error: any): string {
  // Estructura esperada del error: { code: "...", title: "...", detail: "..." }
  if (error?.response?.data?.code) {
    return getErrorMessage(error.response.data.code, error.response.data.detail);
  }

  // Si es solo un mensaje simple.
  if (error?.response?.data?.detail) {
    return getErrorMessage(undefined, error.response.data.detail);
  }

  // Si es un error de status HTTP.
  if (error?.response?.status) {
    const status = error.response.status;
    if (status >= 400 && status < 500) {
      return getErrorMessage("BadRequest");
    } else if (status >= 500) {
      return getErrorMessage("ServerError");
    }
  }

  // Error de conexión.
  if (error?.code === "ECONNABORTED") {
    return getErrorMessage("TimeoutError");
  }

  if (error?.message === "Network Error" || error?.code === "ERR_NETWORK") {
    return getErrorMessage("NetworkError");
  }

  return getErrorMessage(undefined);
}

/**
 * Hook fino sobre `mapApiErrorToMessage` para componentes que prefieran
 * el patrón hook. Se re-crea si el idioma activo cambia porque
 * `i18next.t` ya lee siempre el idioma actual internamente.
 */
export function useApiErrorMessage() {
  return useCallback((error: any): string => mapApiErrorToMessage(error), []);
}
