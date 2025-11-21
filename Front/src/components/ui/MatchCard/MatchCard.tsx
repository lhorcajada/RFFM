import React, { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import styles from "./MatchCard.module.css";
import { Link } from "react-router-dom";
import { getMapsUrlByNameCity } from "../../../services/maps";
import MapPin from "../MapPin/MapPin";

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

export default function MatchCard({
  item,
  hideActaButton,
  compact,
}: {
  item: MatchItem;
  hideActaButton?: boolean;
  compact?: boolean;
}) {
  const m = item.match;
  const STORAGE_PRIMARY = "rffm.primary_combination_id";
  const STORAGE_KEY = "rffm.saved_combinations_v1";

  function getPrimaryTeamId(): string | null {
    try {
      const primaryId = localStorage.getItem(STORAGE_PRIMARY);
      if (!primaryId) return null;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const combos = JSON.parse(stored || "[]");
      const primary = (combos || []).find(
        (c: any) => String(c.id) === String(primaryId)
      );
      return primary?.team?.id ? String(primary.team.id) : null;
    } catch (e) {
      return null;
    }
  }

  const primaryTeamId = getPrimaryTeamId();
  function parseGoalValue(v: any): number | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "" || s === "-") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  const [openActa, setOpenActa] = useState(false);

  function extractCodacta(matchObj: any) {
    if (!matchObj) return null;
    const candidates = [
      matchObj.codacta,
      matchObj.cod_acta,
      matchObj.id_acta,
      matchObj.idacta,
      matchObj.actaId,
      matchObj.acta_id,
      matchObj.acta,
    ];
    for (const c of candidates) {
      if (c !== null && c !== undefined && String(c).trim() !== "")
        return String(c);
    }
    // try to parse from url fields
    const url = matchObj.url ?? matchObj.url_acta ?? matchObj.urlActa ?? null;
    if (url && typeof url === "string") {
      const m = url.match(/(\d{5,})/);
      if (m) return m[1];
    }
    return null;
  }
  const codactaVal = extractCodacta(m);
  const time = m.hora ?? m.time ?? m.hour ?? "";
  const rawCampo = m.campo ?? "";
  let fieldName = rawCampo;
  let cityName: string | null = null;

  // If `campo` contains a hyphen, assume format "City - Field Name" and
  // extract the city part and the rest as the field name. Handle cases with
  // multiple hyphens by taking the first part as city and the rest as name.
  if (rawCampo && rawCampo.indexOf("-") !== -1) {
    const parts = rawCampo
      .split("-")
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      cityName = parts[0];
      fieldName = parts.slice(1).join(" - ");
    }
  }
  const mapsUrl = getMapsUrlByNameCity(
    fieldName || null,
    cityName || m.ciudad || m.city || null
  );

  const localName =
    m.equipo_local ?? m.localTeamName ?? m.LocalTeamName ?? m.local ?? "-";
  const awayName =
    m.equipo_visitante ??
    m.awayTeamName ??
    m.AwayTeamName ??
    m.visitante ??
    "-";

  // try to extract possible team ids from match object
  function extractTeamId(obj: any, prefixes: string[] = []) {
    if (!obj) return null;
    // common fields
    const candidates = [
      obj.teamId,
      obj.codequipo,
      obj.codigo_equipo,
      obj.team_code,
      obj.codigo,
      obj.id,
      obj.cod_equipo,
    ];
    for (const p of prefixes) {
      candidates.push(obj[`${p}TeamId`]);
      candidates.push(obj[`${p}teamId`]);
      candidates.push(obj[`${p}TeamCode`]);
      candidates.push(obj[`${p}teamCode`]);
      candidates.push(obj[`${p}codigo_equipo`]);
      candidates.push(obj[`${p}codequipo`]);
    }
    for (const c of candidates) {
      if (c !== null && c !== undefined && String(c).trim() !== "")
        return String(c);
    }
    return null;
  }

  // match objects may include ids on different fields; try several heuristics
  const localTeamId =
    m.codigo_equipo_local ??
    m.codigo_local ??
    m.cod_equipo_local ??
    m.localTeamId ??
    m.local_team_id ??
    m.localTeamCode ??
    m.localCode ??
    extractTeamId(m.local ?? m.equipo_local ?? m);
  const awayTeamId =
    m.codigo_equipo_visitante ??
    m.codigo_visitante ??
    m.cod_equipo_visitante ??
    m.awayTeamId ??
    m.away_team_id ??
    m.awayTeamCode ??
    m.awayCode ??
    extractTeamId(m.visitante ?? m.equipo_visitante ?? m);

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

  const localGoalsNum = parseGoalValue(
    m.goles_casa ?? m.LocalGoals ?? m.LocalGoals ?? null
  );
  const awayGoalsNum = parseGoalValue(
    m.goles_visitante ?? m.AwayGoals ?? m.AwayGoals ?? null
  );

  let localResultClass = "";
  let awayResultClass = "";
  if (localGoalsNum !== null && awayGoalsNum !== null) {
    if (localGoalsNum > awayGoalsNum) {
      localResultClass = styles.winner;
      awayResultClass = styles.loser;
    } else if (localGoalsNum < awayGoalsNum) {
      localResultClass = styles.loser;
      awayResultClass = styles.winner;
    } else {
      localResultClass = styles.draw;
      awayResultClass = styles.draw;
    }
  }

  const isPrimaryLocal = Boolean(
    primaryTeamId &&
      localTeamId &&
      String(primaryTeamId) === String(localTeamId)
  );
  const isPrimaryAway = Boolean(
    primaryTeamId && awayTeamId && String(primaryTeamId) === String(awayTeamId)
  );

  const rootClass = `${styles.matchCard} ${
    isPrimaryLocal || isPrimaryAway ? styles.highlightPrimary : ""
  } ${isPrimaryLocal ? styles.highlightLeft : ""} ${
    isPrimaryAway ? styles.highlightRight : ""
  }`;
  const finalClass = compact
    ? `${rootClass} ${styles.compact} ${styles.height100}`
    : rootClass;

  return (
    <div className={finalClass}>
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
        <div className={styles.scoreSide}>
          <span className={`${styles.resultChip} ${localResultClass}`}>
            {localGoalsNum !== null
              ? localGoalsNum
              : m.goles_casa ?? m.LocalGoals ?? "-"}
          </span>
        </div>

        <div className={styles.centerStack}>
          <div className={styles.timeText}>
            <span className={styles.timeChip}>{time || "-"}</span>
          </div>
          {fieldName ? (
            <div className={styles.fieldText}>
              <span className={`${styles.fieldChip} ${styles.fieldName}`}>
                {fieldName}
                {mapsUrl ? <MapPin href={mapsUrl} /> : null}
              </span>
              {cityName ? (
                <div>
                  <span className={`${styles.fieldChip} ${styles.cityChip}`}>
                    {cityName}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          {!hideActaButton ? (
            codactaVal ? (
              <Button
                component={Link}
                to={`/acta/${encodeURIComponent(codactaVal)}`}
                state={{ item }}
                variant="contained"
                size="small"
                className={`${styles.actaBtn} ${styles.actaOutline}`}
              >
                Ver acta
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  size="small"
                  className={`${styles.actaBtn} ${styles.actaOutline}`}
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
            )
          ) : (
            <div style={{ height: 32 }} />
          )}
        </div>

        <div className={styles.scoreSide}>
          <span className={`${styles.resultChip} ${awayResultClass}`}>
            {awayGoalsNum !== null
              ? awayGoalsNum
              : m.goles_visitante ?? m.AwayGoals ?? "-"}
          </span>
        </div>
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
