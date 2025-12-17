import React from "react";
import styles from "./TechnicalStaff.module.css";
import { Paper, Typography, List, ListItem, Avatar } from "@mui/material";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { Technician } from "../../../types/acta";

type Props = {
  local: Technician[];
  away: Technician[];
  entrenador_local?: string;
  entrenador_visitante?: string;
  delegadolocal?: string;
  delegado_visitante?: string;
};

export default function TechnicalStaff({
  local,
  away,
  entrenador_local,
  entrenador_visitante,
  delegadolocal,
  delegado_visitante,
}: Props) {
  const hasLocal = Boolean(
    (entrenador_local && entrenador_local !== "No presenta") ||
      delegadolocal ||
      (local && local.length > 0)
  );
  const hasAway = Boolean(
    (entrenador_visitante && entrenador_visitante !== "No presenta") ||
      delegado_visitante ||
      (away && away.length > 0)
  );

  return (
    <Paper className={styles.root} elevation={0}>
      <Typography variant="subtitle1">Cuerpo técnico</Typography>
      <div className={styles.colRow}>
        <div className={styles.col}>
          <Typography variant="subtitle2">Local</Typography>
          <List>
            {hasLocal ? (
              <>
                {entrenador_local && entrenador_local !== "No presenta" ? (
                  <ListItem className={styles.item}>
                    <div className={styles.avatarWrap}>
                      <Avatar />
                    </div>
                    <div className={styles.techInfo}>
                      <div className={styles.name}>
                        {entrenador_local.trim()}
                      </div>
                      <div className={styles.role}>ENTRENADOR</div>
                    </div>
                  </ListItem>
                ) : null}

                {delegadolocal ? (
                  <ListItem className={styles.item}>
                    <div className={styles.avatarWrap}>
                      <Avatar />
                    </div>
                    <div className={styles.techInfo}>
                      <div className={styles.name}>{delegadolocal.trim()}</div>
                      <div className={styles.role}>DELEGADO</div>
                    </div>
                  </ListItem>
                ) : null}

                {local && local.length > 0
                  ? local.map((t) => (
                      <ListItem key={t.cod_tecnico} className={styles.item}>
                        <div className={styles.avatarWrap}>
                          <Avatar src={t.foto} />
                        </div>
                        <div className={styles.techInfo}>
                          <div className={styles.name}>{t.nombre?.trim()}</div>
                          <div className={styles.role}>{t.tipo?.trim()}</div>
                        </div>
                      </ListItem>
                    ))
                  : null}
              </>
            ) : (
              <ListItem className={styles.item}>
                <div className={styles.techInfo}>
                  <EmptyState description={"No hay cuerpo técnico local"} />
                </div>
              </ListItem>
            )}
          </List>
        </div>

        <div className={styles.col}>
          <Typography variant="subtitle2">Visitante</Typography>
          <List>
            {hasAway ? (
              <>
                {entrenador_visitante &&
                entrenador_visitante !== "No presenta" ? (
                  <ListItem className={styles.item}>
                    <div className={styles.avatarWrap}>
                      <Avatar />
                    </div>
                    <div className={styles.techInfo}>
                      <div className={styles.name}>
                        {entrenador_visitante.trim()}
                      </div>
                      <div className={styles.role}>ENTRENADOR</div>
                    </div>
                  </ListItem>
                ) : null}

                {delegado_visitante ? (
                  <ListItem className={styles.item}>
                    <div className={styles.avatarWrap}>
                      <Avatar />
                    </div>
                    <div className={styles.techInfo}>
                      <div className={styles.name}>
                        {delegado_visitante.trim()}
                      </div>
                      <div className={styles.role}>DELEGADO</div>
                    </div>
                  </ListItem>
                ) : null}

                {away && away.length > 0
                  ? away.map((t) => (
                      <ListItem key={t.cod_tecnico} className={styles.item}>
                        <div className={styles.avatarWrap}>
                          <Avatar src={t.foto} />
                        </div>
                        <div className={styles.techInfo}>
                          <div className={styles.name}>{t.nombre?.trim()}</div>
                          <div className={styles.role}>{t.tipo?.trim()}</div>
                        </div>
                      </ListItem>
                    ))
                  : null}
              </>
            ) : (
              <ListItem className={styles.item}>
                <div className={styles.techInfo}>
                  <EmptyState description={"No hay cuerpo técnico visitante"} />
                </div>
              </ListItem>
            )}
          </List>
        </div>
      </div>
    </Paper>
  );
}
