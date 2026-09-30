import React from "react";
import styles from "./AppVersionInfo.module.css";
import {
  type AppVersion,
  formatVersion,
  getApiVersion,
  getWebVersion,
} from "../../../services/versionService";

type ApiVersionState = AppVersion | "loading" | "unavailable";

export default function AppVersionInfo(): JSX.Element {
  const [apiVersion, setApiVersion] = React.useState<ApiVersionState>("loading");

  React.useEffect(() => {
    let cancelled = false;
    getApiVersion()
      .then((v) => !cancelled && setApiVersion(v))
      .catch(() => !cancelled && setApiVersion("unavailable"));
    return () => {
      cancelled = true;
    };
  }, []);

  const apiLabel =
    apiVersion === "loading"
      ? "API …"
      : apiVersion === "unavailable"
        ? "API no disponible"
        : `API ${formatVersion(apiVersion)}`;

  return (
    <li className={styles.root} aria-label="Versión de la aplicación">
      <span>{`Web ${formatVersion(getWebVersion())}`}</span>
      <span>{apiLabel}</span>
    </li>
  );
}
