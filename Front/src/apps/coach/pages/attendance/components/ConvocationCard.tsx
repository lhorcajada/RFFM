import React, { useState } from "react";
import { IconButton, Menu, MenuItem } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { ConvocationItem } from "../../../services/convocationService";
import PlayerRow, { type PlayerRowStatus } from "./PlayerRow";
import OwnPlayerCard from "./OwnPlayerCard";
import { positionTagOf } from "../utils/positionGroups";
import { playerDetailHref, playerDisplayName, playerDorsal } from "../utils/playerDisplay";
import actionStyles from "./RowActions.module.css";

type Props = {
  conv: ConvocationItem;
  /** "own" renders the convocation as the «Tu jugador» card of a Player/FamilyMember. */
  variant?: "row" | "own";
  photoSrc?: string | null;
  statuses: { id: number; name: string }[];
  excuseTypes: { id: number; name: string; justified?: boolean }[];
  canEdit: boolean;
  canEditThisConvocation?: boolean;
  isInjured?: boolean;
  viewablePlayerId?: string | null;
  hideWaitingListButton?: boolean;
  /**
   * Whether a Deconvoked convocation may be moved back to "Pendiente de
   * aceptar"/"Aceptada" from this row. Coach/Administrator can always
   * reactivate (parent should pass `true`); Player/FamilyMember can only
   * reactivate their own player's convocation on a Training event — the
   * button must not render at all otherwise (backend also enforces this
   * with a 403, see `handleChangeStatus` in AttendanceTabs).
   */
  canReactivateFromDeconvoke?: boolean;
  onChangeStatus: (
    conv: ConvocationItem,
    statusId: number,
    excuseTypeId?: number | null
  ) => void;
  onDelete: (conv: ConvocationItem) => void;
  onMoveToWaiting?: (conv: ConvocationItem) => void;
  /**
   * Opens the reason dialog to change the excuse reason of an already
   * Deconvoked convocation. Only rendered when the caller both provides this
   * handler and the current user can edit this convocation.
   */
  onEditReason?: (conv: ConvocationItem) => void;
  /**
   * Enables the bulk-selection checkbox used to pick pending convocations to
   * notify (only ever true for rows rendered inside the "Pendientes de
   * aceptar" group).
   */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (teamPlayerId: string) => void;
  /**
   * League matches: the player already confirmed availability, so a pending
   * convocation is shown as closed (convocated) with no accept/reject choice.
   */
  closedConvocation?: boolean;
};

type Presentation = {
  status: PlayerRowStatus;
  secondary?: string | null;
  dimmed?: boolean;
  actions?: React.ReactNode;
};

const REACTIVATE_TARGET_STATUSES = ["Pending", "Accepted"];

const REACTIVATE_LABELS: Record<string, string> = {
  Pending: "Pendiente de aceptar",
  Accepted: "Aceptar",
};

const WAITING_LIST_LABEL = "↩ Lista de espera";

export default function ConvocationCard({
  conv,
  variant = "row",
  photoSrc,
  statuses,
  excuseTypes,
  canEdit,
  canEditThisConvocation,
  isInjured: isInjuredProp,
  viewablePlayerId,
  hideWaitingListButton,
  canReactivateFromDeconvoke,
  onChangeStatus,
  onDelete,
  onMoveToWaiting,
  onEditReason,
  selectable,
  selected,
  onToggleSelect,
  closedConvocation,
}: Props) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const isOwn = variant === "own";
  const p = conv.player;
  const rawStatusName = statuses.find((s) => s.id === conv.status)?.name ?? "";
  const statusName = closedConvocation && rawStatusName === "Pending" ? "Accepted" : rawStatusName;
  const displayName = playerDisplayName(p);
  const canViewDetail = !viewablePlayerId || p.playerId === viewablePlayerId || p.id === viewablePlayerId;
  const detailHref = canViewDetail ? playerDetailHref(p) : null;
  const canDoAction = canEditThisConvocation ?? canEdit;
  const showWaitingListButton = canEdit && !!onMoveToWaiting && !hideWaitingListButton;

  const present = ({ status, secondary, dimmed, actions }: Presentation) =>
    isOwn ? (
      <OwnPlayerCard
        name={displayName}
        photoSrc={photoSrc}
        dorsal={playerDorsal(p)}
        position={p.position}
        status={status}
        detail={secondary}
        detailHref={detailHref}
        actions={actions}
      />
    ) : (
      <PlayerRow
        name={displayName}
        photoSrc={photoSrc}
        dorsal={playerDorsal(p)}
        positionTag={positionTagOf(p.position)}
        detailHref={detailHref}
        status={status}
        secondary={secondary}
        dimmed={dimmed}
        selectable={selectable}
        selected={selected}
        onToggleSelect={() => p.id && onToggleSelect?.(p.id)}
        selectLabel={`Seleccionar a ${displayName} para notificar`}
        actions={actions}
      />
    );

  const waitingListButton = showWaitingListButton && (
    <button type="button" className={`${actionStyles.textBtn} ${actionStyles.neutral}`} onClick={() => onMoveToWaiting?.(conv)}>
      {WAITING_LIST_LABEL}
    </button>
  );

  if (isInjuredProp || p.isInjured) {
    return present({
      status: { label: "Baja", tone: "declined" },
      secondary: "Lesionado",
      dimmed: true,
      actions: waitingListButton || undefined,
    });
  }

  if (statusName === "Accepted") {
    const status: PlayerRowStatus = { label: closedConvocation ? "Convocado" : "Va", tone: "accepted" };
    if (!canDoAction) return present({ status });
    if (isOwn) {
      return present({
        status,
        actions: (
          <button type="button" className={`${actionStyles.textBtn} ${actionStyles.negative}`} onClick={() => onDelete(conv)}>
            Desconvocar
          </button>
        ),
      });
    }
    const closeMenu = () => setMenuAnchor(null);
    return present({
      status,
      actions: (
        <>
          <IconButton
            className={actionStyles.iconBtnMenu}
            aria-label={`Acciones de ${displayName}`}
            aria-haspopup="menu"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
            <MenuItem
              onClick={() => {
                closeMenu();
                onDelete(conv);
              }}
            >
              Desconvocar
            </MenuItem>
            {showWaitingListButton && (
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onMoveToWaiting?.(conv);
                }}
              >
                {WAITING_LIST_LABEL}
              </MenuItem>
            )}
          </Menu>
        </>
      ),
    });
  }

  if (statusName === "Deconvoke") {
    const excuseLabel = conv.excuseTypeId
      ? (excuseTypes.find((e) => e.id === conv.excuseTypeId)?.name ?? null)
      : "Decisión técnica";
    const showReactivateControls = !!canReactivateFromDeconvoke && canDoAction;
    const reactivateTargets = statuses.filter((s) => REACTIVATE_TARGET_STATUSES.includes(s.name));
    const showEditReason = !!onEditReason && canDoAction;
    const hasActions = showEditReason || showReactivateControls || showWaitingListButton;
    return present({
      status: { label: "No va", tone: "declined" },
      secondary: excuseLabel,
      dimmed: true,
      actions: hasActions ? (
        <>
          {showEditReason && (
            <button type="button" className={actionStyles.textBtn} onClick={() => onEditReason?.(conv)}>
              ✎ Editar motivo
            </button>
          )}
          {showReactivateControls &&
            reactivateTargets.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${actionStyles.textBtn} ${s.name === "Accepted" ? actionStyles.positive : ""}`}
                onClick={() => onChangeStatus(conv, s.id, null)}
              >
                {REACTIVATE_LABELS[s.name] ?? s.name}
              </button>
            ))}
          {waitingListButton}
        </>
      ) : undefined,
    });
  }

  const acceptedStatus = statuses.find((s) => s.name === "Accepted");
  const deconvokeStatus = statuses.find((s) => s.name === "Deconvoke");
  const accept = () => acceptedStatus && onChangeStatus(conv, acceptedStatus.id, null);
  const reject = () => onDelete(conv);
  return present({
    status: { label: "Pendiente", tone: "pending" },
    actions: isOwn ? (
      canDoAction && (
        <>
          {acceptedStatus && (
            <button type="button" className={`${actionStyles.textBtn} ${actionStyles.positive}`} onClick={accept}>
              Aceptar
            </button>
          )}
          {deconvokeStatus && (
            <button type="button" className={`${actionStyles.textBtn} ${actionStyles.negative}`} onClick={reject}>
              Rechazar
            </button>
          )}
        </>
      )
    ) : (
      <>
        {acceptedStatus && (
          <IconButton className={actionStyles.iconBtnPositive} aria-label="Aceptar" disabled={!canDoAction} onClick={accept}>
            <CheckIcon />
          </IconButton>
        )}
        {deconvokeStatus && (
          <IconButton className={actionStyles.iconBtnNegative} aria-label="Rechazar" disabled={!canDoAction} onClick={reject}>
            <CloseIcon />
          </IconButton>
        )}
        {waitingListButton}
      </>
    ),
  });
}
