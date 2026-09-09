import { Fragment, useState } from "react";
import {
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Stack,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import type { PlayerMatchRecord } from "../../convocations/components/simulation/liveMatch.types";
import { derivePlayerStints } from "./playerMatchStints";
import styles from "./PlayerMatchHistoryTable.module.css";

type Props = {
  matchHistory: PlayerMatchRecord[];
  teamPlayerId: string;
};

function formatMatchDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function MatchHistoryRow({ record, teamPlayerId }: { record: PlayerMatchRecord; teamPlayerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const stints = derivePlayerStints(record, teamPlayerId);

  return (
    <Fragment>
      <TableRow>
        <TableCell padding="checkbox">
          <IconButton
            size="small"
            aria-label={expanded ? "Contraer detalle" : "Expandir detalle"}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell className={styles.cell}>{formatMatchDate(record.matchDate)}</TableCell>
        <TableCell className={styles.cell}>{record.rivalName ?? "—"}</TableCell>
        <TableCell className={styles.cell}>{record.eventTypeName || "—"}</TableCell>
        <TableCell className={styles.cell}>
          {record.scoreLocal}:{record.scoreVisitor}
        </TableCell>
        <TableCell className={styles.cell}>{record.minutesPlayed}</TableCell>
        <TableCell className={record.isStarter ? styles.starterYes : styles.starterNo}>
          {record.isStarter ? "Sí" : "No"}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.75} className={styles.cardsCell}>
            {record.yellowCards > 0 && <span>🟨{record.yellowCards}</span>}
            {record.redCards > 0 && <span>🟥{record.redCards}</span>}
            {record.yellowCards === 0 && record.redCards === 0 && (
              <span className={styles.starterNo}>—</span>
            )}
          </Stack>
        </TableCell>
        <TableCell className={record.goalsScored > 0 ? styles.goalsWithScore : styles.goalsNoScore}>
          {record.goalsScored}
        </TableCell>
      </TableRow>
      <TableRow className={styles.stintsRow}>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <div className={styles.stintsWrapper}>
              {stints.length === 0 ? (
                <Typography className={styles.stintsEmpty}>Sin sustituciones registradas.</Typography>
              ) : (
                stints.map((stint, idx) => (
                  <Typography key={idx} className={styles.stintItem}>
                    {stint.enteredAtMinute}' — {stint.exitedAtMinute != null ? `${stint.exitedAtMinute}'` : "final del partido"}
                  </Typography>
                ))
              )}
            </div>
          </Collapse>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

export default function PlayerMatchHistoryTable({ matchHistory, teamPlayerId }: Props) {
  return (
    <div className={styles.tableWrapper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell className={styles.headerCell}>Fecha</TableCell>
            <TableCell className={styles.headerCell}>Rival</TableCell>
            <TableCell className={styles.headerCell}>Tipo</TableCell>
            <TableCell className={styles.headerCell}>Marcador</TableCell>
            <TableCell className={styles.headerCell}>Min</TableCell>
            <TableCell className={styles.headerCell}>Titular</TableCell>
            <TableCell className={styles.headerCell}>Tarjetas</TableCell>
            <TableCell className={styles.headerCell}>Goles</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matchHistory.map((record) => (
            <MatchHistoryRow key={record.eventId} record={record} teamPlayerId={teamPlayerId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
