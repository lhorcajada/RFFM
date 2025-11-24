import React, { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import styles from "./MatchCard.module.css";
import { Link } from "react-router-dom";
import TeamInfo from "./TeamInfo";
import FieldInfo from "./FieldInfo";
import ScoreChip from "./ScoreChip";
import MatchTime from "./MatchTime";
import { MatchEntry } from "../../../types/match";
import usePrimaryTeam from "../../../hooks/usePrimaryTeam";
import useMatch from "../../../hooks/useMatch";

type MatchItem = {
  rawDate?: string | null;
  parsedDate?: Date | null;
  match: MatchEntry;
};

// The API layer normalizes match entries to a consistent shape (see types/match).
// Components can rely on those fields directly (m.codacta, m.hora, m.equipo_local, ...)

export default function MatchCard({
  item,
  hideActaButton,
  compact,
}: {
  item: MatchItem;
  hideActaButton?: boolean;
  compact?: boolean;
}) {
  const { isPrimary } = usePrimaryTeam();
  const matchVals = useMatch({ item });
  const m = matchVals.match as MatchEntry;
  const [openActa, setOpenActa] = useState(false);

  const codactaVal = matchVals.codactaVal;
  const time = matchVals.timeRaw;
  const fieldName = matchVals.fieldName;
  const cityName = matchVals.cityName;
  const mapsUrl = matchVals.mapsUrl;
  const localName = matchVals.localName;
  const awayName = matchVals.awayName;
  const localTeamId = matchVals.localTeamId;
  const awayTeamId = matchVals.awayTeamId;
  const localShield = matchVals.localShield;
  const awayShield = matchVals.awayShield;
  const localGoalsNum = matchVals.localGoalsNum;
  const awayGoalsNum = matchVals.awayGoalsNum;

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

  const isPrimaryLocal = isPrimary(localTeamId);
  const isPrimaryAway = isPrimary(awayTeamId);

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
      <FieldInfo fieldName={fieldName} cityName={cityName} mapsUrl={mapsUrl} />
      <div className={styles.cardRow}>
        <TeamInfo name={localName} shieldSrc={localShield} alt={localName} />

        <div className={styles.centerArea}>
          <div className={styles.scoreSide}>
            <ScoreChip
              value={
                localGoalsNum !== null
                  ? localGoalsNum
                  : m.goles_casa ?? m.LocalGoals ?? "-"
              }
              variantClass={localResultClass}
            />
          </div>

          <div className={styles.centerStack}>
            <MatchTime time={time} />
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
                        La vista del acta aún no está implementada. Pronto
                        estará disponible en esta aplicación.
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
            <ScoreChip
              value={
                awayGoalsNum !== null
                  ? awayGoalsNum
                  : m.goles_visitante ?? m.AwayGoals ?? "-"
              }
              variantClass={awayResultClass}
            />
          </div>
        </div>

        <TeamInfo name={awayName} shieldSrc={awayShield} alt={awayName} />
      </div>
    </div>
  );
}
