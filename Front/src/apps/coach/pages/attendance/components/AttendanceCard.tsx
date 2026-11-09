import React, { useState } from "react";
import { Divider, IconButton, ListSubheader, Menu, MenuItem } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { ConvocationItem } from "../../../services/convocationService";
import PlayerRow, { type PlayerRowStatus } from "./PlayerRow";
import { positionTagOf } from "../utils/positionGroups";
import { playerDetailHref, playerDisplayName, playerDorsal } from "../utils/playerDisplay";
import actionStyles from "./RowActions.module.css";

// Ids of the seeded AssistanceTypes: 1 Asiste, 2 No asiste con excusa, 3 No asiste sin excusa, 4 Llega tarde.
const ATTENDS_ID = 1;
const ABSENT_WITH_EXCUSE_ID = 2;
const ABSENT_WITHOUT_EXCUSE_ID = 3;
const LATE_ID = 4;

type Props = {
  conv: ConvocationItem;
  photoSrc?: string | null;
  assistanceTypes: { id: number; name: string }[];
  excuseTypes: { id: number; name: string }[];
  canEdit: boolean;
  onChange: (conv: ConvocationItem, assistanceTypeId: number | null, excuseTypeId: number | null) => void;
};

function statusOf(assistanceTypeId: number | null | undefined, name: string | undefined): PlayerRowStatus {
  const label = name ?? "Sin indicar";
  if (assistanceTypeId === ATTENDS_ID) return { label, tone: "accepted" };
  if (assistanceTypeId === LATE_ID) return { label, tone: "waiting" };
  if (assistanceTypeId === ABSENT_WITH_EXCUSE_ID || assistanceTypeId === ABSENT_WITHOUT_EXCUSE_ID) {
    return { label, tone: "declined" };
  }
  return { label: "Sin indicar", tone: "pending" };
}

export default function AttendanceCard({ conv, photoSrc, assistanceTypes, excuseTypes, canEdit, onChange }: Props) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const p = conv.player;
  const displayName = playerDisplayName(p);
  const currentId = conv.assistanceTypeId ?? null;
  const currentName = assistanceTypes.find((a) => a.id === currentId)?.name;
  const attends = currentId === ATTENDS_ID || currentId === LATE_ID;
  const absent = currentId === ABSENT_WITH_EXCUSE_ID || currentId === ABSENT_WITHOUT_EXCUSE_ID;
  const excuseName =
    currentId === ABSENT_WITH_EXCUSE_ID ? excuseTypes.find((e) => e.id === conv.excuseTypeId)?.name ?? null : null;

  const closeMenu = () => setMenuAnchor(null);
  const choose = (assistanceTypeId: number | null, excuseTypeId: number | null = null) => {
    closeMenu();
    onChange(conv, assistanceTypeId, excuseTypeId);
  };

  return (
    <PlayerRow
      name={displayName}
      photoSrc={photoSrc}
      dorsal={playerDorsal(p)}
      positionTag={positionTagOf(p.position)}
      detailHref={playerDetailHref(p)}
      status={statusOf(currentId, currentName)}
      secondary={excuseName}
      dimmed={absent}
      actions={
        <>
          <IconButton
            className={actionStyles.iconBtnPositive}
            aria-label="Marcar que asiste"
            aria-pressed={attends}
            disabled={!canEdit}
            onClick={() => choose(ATTENDS_ID)}
          >
            <CheckIcon />
          </IconButton>
          <IconButton
            className={actionStyles.iconBtnNegative}
            aria-label="Marcar que no asiste"
            aria-pressed={absent}
            disabled={!canEdit}
            onClick={() => choose(ABSENT_WITHOUT_EXCUSE_ID)}
          >
            <CloseIcon />
          </IconButton>
          <IconButton
            className={actionStyles.iconBtnMenu}
            aria-label="Más opciones de asistencia"
            aria-haspopup="menu"
            disabled={!canEdit}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
            <MenuItem selected={currentId === null} onClick={() => choose(null)}>
              Sin indicar
            </MenuItem>
            {assistanceTypes.map((a) => (
              <MenuItem key={a.id} selected={currentId === a.id} onClick={() => choose(a.id)}>
                {a.name}
              </MenuItem>
            ))}
            {currentId === ABSENT_WITH_EXCUSE_ID && excuseTypes.length > 0 && [
              <Divider key="divider" />,
              <ListSubheader key="header">Motivo</ListSubheader>,
              ...excuseTypes.map((ex) => (
                <MenuItem
                  key={ex.id}
                  selected={conv.excuseTypeId === ex.id}
                  onClick={() => choose(ABSENT_WITH_EXCUSE_ID, ex.id)}
                >
                  {ex.name}
                </MenuItem>
              )),
            ]}
          </Menu>
        </>
      }
    />
  );
}
