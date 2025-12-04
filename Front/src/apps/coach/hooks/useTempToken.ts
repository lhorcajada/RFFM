import { useCallback } from "react";
import { SignJWT } from "jose";

interface TokenPayload {
  username?: string;
  password?: string;
  email?: string;
  [key: string]: any;
}

export const useTempToken = () => {
  const generateTempToken = useCallback(
    async (payload: TokenPayload): Promise<string> => {
      const secretKey =
        import.meta.env.VITE_APP_FRONTEND_SECRET || "frontend-temp-key";

      // Convertir la clave a Uint8Array correctamente
      const secret = new TextEncoder().encode(secretKey);

      // Generar el token sin setear 'kid' en el header
      const token = await new SignJWT(payload)
        .setProtectedHeader({
          alg: "HS256",
          typ: "JWT",
        })
        .setExpirationTime("5m") // Token válido por 5 minutos
        .sign(secret);

      return token;
    },
    []
  );

  return { generateTempToken };
};

export default useTempToken;
