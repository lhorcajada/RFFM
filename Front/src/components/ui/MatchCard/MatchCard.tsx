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
import useMatch from "../../../hooks/useMatch";

type MatchItem = {
  rawDate?: string | null;
  parsedDate?: Date | null;
  match: MatchEntry | any;
};

export default function MatchCard({
  item,
  compact,
}: {
  item: MatchItem;
  compact?: boolean;
}) {
  const matchVals = useMatch({ item });
  const m = matchVals.match as any;
  const [openActa, setOpenActa] = useState(false);

  const data = {
    item,
    codactaVal: matchVals.codactaVal ?? null,
    timeRaw: matchVals.timeRaw,
    fieldName: matchVals.fieldName,
    cityName: matchVals.cityName,
    mapsUrl: matchVals.mapsUrl,
    localName: matchVals.localName,
    awayName: matchVals.awayName,
    localTeamId: matchVals.localTeamId,
    awayTeamId: matchVals.awayTeamId,
    localShield: matchVals.localShield,
    awayShield: matchVals.awayShield,
    localGoalsNum: matchVals.localGoalsNum,
    awayGoalsNum: matchVals.awayGoalsNum,
    match: matchVals.match,
  } as const;

  const localGoalsNum = data.localGoalsNum;
  const awayGoalsNum = data.awayGoalsNum;

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

  const rootClass = `${styles.matchCard}`;
  const finalClass = compact ? `${rootClass} ${styles.compact}` : rootClass;

  return (
    <div className={finalClass}>
      <FieldInfo
        fieldName={data.fieldName}
        cityName={data.cityName}
        mapsUrl={data.mapsUrl}
      />
      <div className={styles.cardRow}>
        <TeamInfo
          name={data.localName}
          shieldSrc={data.localShield}
          alt={data.localName}
        />

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
            <MatchTime time={data.timeRaw} />
            {data.codactaVal ? (
              <Button
                component={Link}
                to={`/acta/${encodeURIComponent(String(data.codactaVal))}`}
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

        <TeamInfo
          name={data.awayName}
          shieldSrc={data.awayShield}
          alt={data.awayName}
        />
      </div>
    </div>
  );
}
