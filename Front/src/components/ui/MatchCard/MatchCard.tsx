import React, { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import styles from "../../../pages/Calendar/GetCalendar.module.css";

type MatchItem = {
  rawDate?: string | null;
  parsedDate?: Date | null;
  match: any;
};

function resolveShield(u: string) {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `https://www.rffm.es${u}`;
  return u;
}

function parseTimeToHM(time?: string | null): { h: number; m: number } | null {
  if (!time) return null;
  let s = String(time).trim();
  s = s.replace(/[a-zA-Z]+$/g, "").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
  const m2 = s.match(/^(\d{1,2})$/);
  if (m2) return { h: parseInt(m2[1], 10), m: 0 };
  return null;
}

export default function MatchCard({ item }: { item: MatchItem }) {
  const m = item.match;
  const [openActa, setOpenActa] = useState(false);
  const time = m.hora ?? m.time ?? m.hour ?? "";
  const localName =
    m.equipo_local ?? m.localTeamName ?? m.LocalTeamName ?? m.local ?? "-";
  const awayName =
    m.equipo_visitante ??
    m.awayTeamName ??
    m.AwayTeamName ??
    m.visitante ??
    "-";

  let localShield =
    m.escudo_equipo_local_url ??
    m.escudo_equipo_local ??
    m.LocalShield ??
    m.localShield ??
    m.escudo_local ??
    m.localImage ??
    "";
  let awayShield =
    m.escudo_equipo_visitante_url ??
    m.escudo_equipo_visitante ??
    m.AwayShield ??
    m.awayShield ??
    m.escudo_visitante ??
    m.awayImage ??
    "";
  localShield = resolveShield(localShield);
  awayShield = resolveShield(awayShield);

  // determine finished using same heuristics as parent
  const hasActa = Boolean(m.url ?? m.url_acta ?? m.urlActa);
  const actaCerrada = m.acta_cerrada ?? m.actaCerrada ?? m.ActaCerrada ?? false;
  const estadoVal = String(
    m.estado ?? m.Estado ?? m.status ?? m.Status ?? ""
  ).toLowerCase();
  const estadoFinished =
    /final|terminad|ended|cerrad|closed|finalizado|jugado/i.test(estadoVal);
  const MATCH_DURATION_MIN = 120;
  let scheduledFinished = false;
  const dateOnly = item.parsedDate ?? null;
  if (dateOnly) {
    const timeHm = parseTimeToHM(m.hora ?? m.time ?? m.hour ?? null);
    if (timeHm) {
      const startDt = new Date(dateOnly);
      startDt.setHours(timeHm.h, timeHm.m, 0, 0);
      const endMs = startDt.getTime() + MATCH_DURATION_MIN * 60 * 1000;
      scheduledFinished = Date.now() >= endMs;
    }
  }
  const finished =
    hasActa || actaCerrada || estadoFinished || scheduledFinished;

  return (
    <div className={styles.matchCard}>
      <div className={styles.teamBox}>
        <div className={styles.shieldWrap}>
          {localShield ? (
            <img src={localShield} alt={localName} className={styles.shield} />
          ) : (
            <div
              style={{
                width: 66,
                height: 66,
                background: "#f3f4f6",
                borderRadius: 6,
              }}
            />
          )}
        </div>
        <div className={styles.teamName}>{localName}</div>
      </div>

      <div className={styles.centerArea}>
        <div className={styles.timeText}>{time || "-"}</div>
        <div className={styles.scoreBox}>
          {m.goles_casa ?? m.LocalGoals ?? "-"} —{" "}
          {m.goles_visitante ?? m.AwayGoals ?? "-"}
        </div>
        {finished ? (
          <>
            <Button
              variant="contained"
              size="small"
              className={styles.actaBtn}
              onClick={() => setOpenActa(true)}
            >
              Ver acta
            </Button>
            <Dialog open={openActa} onClose={() => setOpenActa(false)}>
              <DialogTitle>Acta no disponible</DialogTitle>
              <DialogContent>
                <Typography>
                  La vista del acta aún no está implementada. Pronto estará
                  disponible en esta aplicación.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setOpenActa(false)}>Cerrar</Button>
              </DialogActions>
            </Dialog>
          </>
        ) : (
          <div style={{ height: 32 }} />
        )}
      </div>

      <div className={styles.teamBox}>
        <div className={styles.shieldWrap}>
          {awayShield ? (
            <img src={awayShield} alt={awayName} className={styles.shield} />
          ) : (
            <div
              style={{
                width: 66,
                height: 66,
                background: "#f3f4f6",
                borderRadius: 6,
              }}
            />
          )}
        </div>
        <div className={styles.teamName}>{awayName}</div>
      </div>
    </div>
  );
}
