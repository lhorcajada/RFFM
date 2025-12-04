import React from "react";
import { Button } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { registerNavigate } from "../../../../core/api/client";
import styles from "./Error500.module.css";
import PageHeader from "../PageHeader/PageHeader";
import BaseLayout from "../BaseLayout/BaseLayout";

const Error500: React.FC = () => {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const reason = search.get("reason") || undefined;

  React.useEffect(() => {
    registerNavigate((p: string) => navigate(p));
  }, [navigate]);

  return (
    <BaseLayout>
      <PageHeader title="Oops, algo salió mal" subtitle="Error del servidor" />
      <div className={styles.wrap}>
        <div className={styles.emoji} aria-hidden>
          ⚠️
        </div>
        <div className={styles.message}>
          {reason === "network" && (
            <>
              <h2>No hay conexión con el servidor</h2>
              <p>
                Parece que no podemos contactar con el servidor. Comprueba tu
                conexión a Internet o inténtalo de nuevo más tarde.
              </p>
            </>
          )}
          {reason === "timeout" && (
            <>
              <h2>La petición ha tardado demasiado</h2>
              <p>
                La petición al servidor ha tardado demasiado en responder.
                Puedes intentarlo de nuevo en unos instantes.
              </p>
            </>
          )}
          {!reason && (
            <>
              <h2>¡Uy! Algo salió mal en el servidor.</h2>
              <p>
                Nuestro equipo ya ha sido notificado. Por favor, vuelve al
                inicio o inténtalo más tarde.
              </p>
            </>
          )}
          <div className={styles.actions}>
            <Button variant="outlined" onClick={() => navigate("/")}>
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    </BaseLayout>
  );
};

export default Error500;
