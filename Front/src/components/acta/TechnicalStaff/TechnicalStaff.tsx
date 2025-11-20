import React from "react";
import styles from "./TechnicalStaff.module.css";
import { Paper, Typography, List, ListItem, Avatar } from "@mui/material";
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
    entrenador_local || delegadolocal || (local && local.length > 0)
  );
  const hasAway = Boolean(
    entrenador_visitante || delegado_visitante || (away && away.length > 0)
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
                {entrenador_local ? (
                  <ListItem className={styles.item}>
                    <div className={styles.avatarWrap}>
                      <Avatar />
                    </div>
                    <div className={styles.techInfo}>
                      <div className={styles.name}>{entrenador_local}</div>
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
                      <div className={styles.name}>{delegadolocal}</div>
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
                          <div className={styles.name}>{t.nombre}</div>
                          <div className={styles.role}>{t.tipo}</div>
                        </div>
                      </ListItem>
                    ))
                  : null}
              </>
            ) : (
              <ListItem className={styles.item}>
                <div className={styles.techInfo}>
                  No hay cuerpo técnico local
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
                {entrenador_visitante ? (
                  <ListItem className={styles.item}>
                    <div className={styles.avatarWrap}>
                      <Avatar />
                    </div>
                    <div className={styles.techInfo}>
                      <div className={styles.name}>{entrenador_visitante}</div>
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
                      <div className={styles.name}>{delegado_visitante}</div>
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
                          <div className={styles.name}>{t.nombre}</div>
                          <div className={styles.role}>{t.tipo}</div>
                        </div>
                      </ListItem>
                    ))
                  : null}
              </>
            ) : (
              <ListItem className={styles.item}>
                <div className={styles.techInfo}>
                  No hay cuerpo técnico visitante
                </div>
              </ListItem>
            )}
          </List>
        </div>
      </div>
    </Paper>
  );
}
