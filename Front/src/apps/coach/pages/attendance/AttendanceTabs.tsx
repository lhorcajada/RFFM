import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Checkbox, Tabs, Tab } from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import convocationService, {
  PlayerSimple,
  ConvocationItem,
} from "../../services/convocationService";
import playerService from "../../services/playerService";
import convocationStatusService from "../../services/convocationStatusService";
import excuseTypeService, {
  ExcuseType,
} from "../../services/excuseTypeService";
import assistanceTypeService, { AssistanceType } from "../../services/assistanceTypeService";
import { coachAuthService } from "../../services/authService";
import { getMyProfile } from "../../services/coachApi";
import styles from "./AttendanceTabs.module.css";
import defaultAvatar from "../../../../assets/avatar.svg";
import NotConvokedList from "./components/NotConvokedList";
import ConvocationCard from "./components/ConvocationCard";
import DeconvokeDialog from "./components/DeconvokeDialog";
import CollapsibleGroup from "./components/CollapsibleGroup";
import PositionGroupedList from "./components/PositionGroupedList";
import AvailabilityList from "./components/AvailabilityList";
import PlayerRow from "./components/PlayerRow";
import OwnPlayerCard from "./components/OwnPlayerCard";
import ConvocationSummary from "./components/ConvocationSummary";
import actionStyles from "./components/RowActions.module.css";
import { findOwnPlayerEntry, matchesAssociatedPlayer, type OwnPlayerEntry } from "./utils/ownPlayerEntry";
import { positionTagOf } from "./utils/positionGroups";
import { playerDetailHref, playerDisplayName, playerDorsal } from "./utils/playerDisplay";
import availabilityService, { AvailabilityRequestItem } from "../../services/availabilityService";
import NotifyPendingConvocationDialog, { type NotifyPendingKind } from "./components/NotifyPendingConvocationDialog";
import type { PendingConfirmationEventSummary } from "./utils/pendingConfirmationWhatsApp";
import useAutoRefresh from "../../hooks/useAutoRefresh";

type Props = {
  eventId: string;
  eventStart?: string | null;
  isMatch?: boolean;
  /** League match ("Partido"): convocation goes through the availability request flow. */
  isLeagueMatch?: boolean;
  isTraining?: boolean;
  eventSummary?: PendingConfirmationEventSummary;
};

type GroupKey = "waiting" | "availabilityPending" | "available" | "pending" | "accepted" | "desconvocados";

// Matches RFFM.Api.Domain.Aggregates.Assistances.ExcuseTypes' "Decisión técnica" entry (id 7).
const TECHNICAL_DECISION_EXCUSE_TYPE_ID = 7;

// A player is injured for a given event only if the injury started BEFORE that day (not same day).
function isInjuredBeforeDate(injuryStartDate: string | null | undefined, eventDate: string | null | undefined): boolean {
  if (!injuryStartDate) return true;
  if (!eventDate) return true;
  return injuryStartDate.slice(0, 10) < eventDate.slice(0, 10);
}

function statusNameMap(id: number, statuses: { id: number; name: string }[]) {
  const s = statuses.find((x) => x.id === id);
  if (!s) return "-";
  const m: Record<string, string> = {
    Pending: "Pendiente",
    Accepted: "Aceptado",
    Deconvoke: "Desconvocado",
  };
  return m[s.name] ?? s.name;
}

function showSnackbar(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function apiErrorMessage(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || fallback;
}

export default function AttendanceTabs({ eventId, eventStart, isMatch, isLeagueMatch, isTraining, eventSummary }: Props) {
  const [tab, setTab] = useState(0);
  const [players, setPlayers] = useState<PlayerSimple[]>([]);
  const [convocations, setConvocations] = useState<ConvocationItem[]>([]);
  const [playerPhotos, setPlayerPhotos] = useState<
    Record<string, string | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<{ id: number; name: string }[]>([]);
  const [excuseTypes, setExcuseTypes] = useState<ExcuseType[]>([]);
  const [assistanceTypes, setAssistanceTypes] = useState<AssistanceType[]>([]);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [settingAllAttends, setSettingAllAttends] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [selectedAvailabilityIds, setSelectedAvailabilityIds] = useState<Set<string>>(new Set());
  const [notifyKind, setNotifyKind] = useState<NotifyPendingKind | null>(null);
  const [pushKind, setPushKind] = useState<NotifyPendingKind | null>(null);
  const [sendingPush, setSendingPush] = useState(false);
  const [availabilityRequests, setAvailabilityRequests] = useState<AvailabilityRequestItem[]>([]);
  const [requestAvailabilityOpen, setRequestAvailabilityOpen] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [deconvokeAvailableTarget, setDeconvokeAvailableTarget] = useState<AvailabilityRequestItem | null>(null);
  const [unavailableTarget, setUnavailableTarget] = useState<AvailabilityRequestItem | null>(null);

  // Selection is scoped to the current event — reset whenever the coach
  // navigates to a different event's convocation screen.
  useEffect(() => {
    setSelectedPendingIds(new Set());
    setSelectedAvailabilityIds(new Set());
  }, [eventId]);

  const toggleInSet = (prev: Set<string>, teamPlayerId: string) => {
    const next = new Set(prev);
    if (next.has(teamPlayerId)) next.delete(teamPlayerId);
    else next.add(teamPlayerId);
    return next;
  };

  const toggleSelectedPending = (teamPlayerId: string) => setSelectedPendingIds((prev) => toggleInSet(prev, teamPlayerId));
  const toggleSelectedAvailability = (teamPlayerId: string) =>
    setSelectedAvailabilityIds((prev) => toggleInSet(prev, teamPlayerId));

  const selectedIdsFor = (kind: NotifyPendingKind | null) =>
    kind === "availability" ? selectedAvailabilityIds : selectedPendingIds;

  const _roles = coachAuthService.getRoles();
  const isPlayerOrFamily =
    (_roles.includes("Player") || _roles.includes("FamilyPlayer") || _roles.includes("FamilyMember")) &&
    !_roles.includes("Coach") &&
    !_roles.includes("Administrator");
  const [associatedPlayerId, setAssociatedPlayerId] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (!eventStart) return true;
    const d = new Date(eventStart);
    if (Date.now() < d.getTime()) return true;
    // After the event date, admins and coaches can still edit
    return coachAuthService.hasRole("Coach");
  }, [eventStart]);

  // Player/FamilyMember may only move their own player out of "Desconvocado"
  // (back to Pendiente/Aceptada) when the event is a Training session — the
  // backend enforces this with a 403 (see handleChangeStatus below); this is
  // the client-side mirror that decides whether to render the control at all.
  // Coach/Administrator remain unrestricted on any event type.
  const canReactivateFromDeconvokeByEventType = !isPlayerOrFamily || !!isTraining;

  // A convocation deconvoked by the coach as "Decisión técnica" (excuseTypeId 7)
  // is off-limits to Player/FamilyMember: they can neither change the reason
  // ("Editar motivo") nor reactivate it, regardless of event type. The backend
  // enforces this with a 403 (see UpdateConvocationStatus.Handler); this is the
  // client-side mirror that decides whether to render the controls at all.
  const isDeconvokedByTechnicalDecision = (c: ConvocationItem) =>
    c.status === deconvokeStatusId && c.excuseTypeId === TECHNICAL_DECISION_EXCUSE_TYPE_ID;

  const canPlayerOrFamilyModifyDeconvoke = (c: ConvocationItem) =>
    !isPlayerOrFamily || !isDeconvokedByTechnicalDecision(c);

  // Player/FamilyMember/FamilyPlayer must never see the "Asistencia" tab nor
  // its content (attendance marking is a coach-only action). Defense in
  // depth: even if `tab` state were somehow forced to 1, the content below
  // is gated on `!isPlayerOrFamily` as well.
  useEffect(() => {
    if (isPlayerOrFamily && tab === 1) setTab(0);
  }, [isPlayerOrFamily, tab]);

  useEffect(() => {
    if (!isPlayerOrFamily) {
      setAssociatedPlayerId(null);
      return;
    }
    const cached = localStorage.getItem("coach_player_teamId");
    if (cached) setAssociatedPlayerId(cached);
    getMyProfile().then((profile) => {
      if (profile?.playerId) setAssociatedPlayerId(profile.playerId);
    });
  }, [isPlayerOrFamily]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Injured players are registered as Deconvoke + "Lesión" server-side (idempotent, so
        // a double mount or two coaches opening the page never duplicates a convocation).
        if (!isPlayerOrFamily) {
          try {
            await convocationService.deconvokeInjuredPlayers(eventId);
          } catch {
            // non-blocking: the page still shows the current convocations
          }
          if (!mounted) return;
        }
        const [pl, conv, st, ex, at, av] = await Promise.all([
          convocationService.getEventPlayers(eventId),
          convocationService.getConvocations(eventId),
          convocationStatusService.getConvocationStatuses(),
          excuseTypeService.getExcuseTypes(),
          assistanceTypeService.getAssistanceTypes(),
          isLeagueMatch ? availabilityService.getAvailabilityRequests(eventId) : Promise.resolve([]),
        ]);
        if (!mounted) return;
        setPlayers(pl);
        setAvailabilityRequests(av);
        setConvocations(conv);
        setStatuses(st);
        setExcuseTypes(ex);
        setAssistanceTypes(at);

        // fetch photos for players and convocated players
        const photos: Record<string, string | null> = {};
        const all = [
          ...pl.map((p) => ({ id: p.id, url: p.urlPhoto })),
          ...conv.map((c) => ({ id: c.player?.id, url: c.player?.urlPhoto })),
        ];
        await Promise.all(
          all.map(async (it) => {
            const idKey = it.id != null ? String(it.id) : null;
            const urlKey = it.url ? String(it.url) : null;

            if (!it.url) {
              if (idKey) photos[idKey] = null;
              if (urlKey) photos[urlKey] = null;
              return;
            }

            try {
              const obj = await playerService.fetchPlayerPhoto(
                it.url as string
              );
              if (idKey) photos[idKey] = obj;
              if (urlKey) photos[urlKey] = obj;
            } catch (e) {
              if (idKey) photos[idKey] = null;
              if (urlKey) photos[urlKey] = null;
            }
          })
        );
        if (!mounted) return;
        setPlayerPhotos(photos);
      } catch (e) {
        // ignore
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [eventId]);

  // Silent background refresh so the coach sees players accepting/rejecting the convocation
  // from their own devices without reloading the page (no spinner, no injured auto-registration).
  const refreshingRef = useRef(false);
  const eventIdRef = useRef(eventId);
  eventIdRef.current = eventId;
  useAutoRefresh(async () => {
    if (loading || refreshingRef.current) return;
    refreshingRef.current = true;
    const requestedEventId = eventId;
    try {
      const [conv, pl, av] = await Promise.all([
        convocationService.getConvocations(requestedEventId),
        convocationService.getEventPlayers(requestedEventId),
        isLeagueMatch ? availabilityService.getAvailabilityRequests(requestedEventId) : Promise.resolve([]),
      ]);
      if (eventIdRef.current !== requestedEventId) return;
      setConvocations(conv);
      setPlayers(pl);
      setAvailabilityRequests(av);
    } catch {
      // transient failure: the next tick retries
    } finally {
      refreshingRef.current = false;
    }
  });

  // A convocation always wins over an availability request; without one, a Requested/Available
  // request places the player in its availability group and anything else stays on the waiting list.
  const availabilityByPlayer = useMemo(
    () => new Map(availabilityRequests.map((r) => [r.teamPlayerId, r])),
    [availabilityRequests]
  );
  const availabilityOf = (p: PlayerSimple) => (p.id ? availabilityByPlayer.get(p.id) : undefined);
  const unconvoked = players.filter(
    (p) => !convocations.some((c) => c.player.id === p.id)
  );
  const availabilityPending = isLeagueMatch ? unconvoked.filter((p) => availabilityOf(p)?.status === "Requested") : [];
  const availablePlayers = isLeagueMatch ? unconvoked.filter((p) => availabilityOf(p)?.status === "Available") : [];
  const notConvoked = unconvoked.filter((p) => !availabilityPending.includes(p) && !availablePlayers.includes(p));
  const waitingList = notConvoked.filter((p) => !p.isInjured || !isInjuredBeforeDate(p.injuryStartDate, eventStart));
  const injuredWaiting = notConvoked.filter((p) => p.isInjured && isInjuredBeforeDate(p.injuryStartDate, eventStart));

  // ── Group membership (hoisted so both rendering and the default expand/
  // collapse logic can share the same source of truth) ──────────────────
  const convocatedFiltered = useMemo(() => convocations.filter((c) => c.player), [convocations]);
  const acceptedStatusId = useMemo(() => statuses.find((s) => s.name === "Accepted")?.id, [statuses]);
  const pendingStatusId = useMemo(() => statuses.find((s) => s.name === "Pending")?.id, [statuses]);
  const deconvokeStatusId = useMemo(() => statuses.find((s) => s.name === "Deconvoke")?.id, [statuses]);

  const accepted = useMemo(
    () => convocatedFiltered.filter((c) => c.status === acceptedStatusId && !c.isInjured),
    [convocatedFiltered, acceptedStatusId]
  );
  const pending = useMemo(
    () => convocatedFiltered.filter((c) => c.status === pendingStatusId && !c.isInjured),
    [convocatedFiltered, pendingStatusId]
  );
  const pendingTeamPlayerIds = useMemo(
    () => pending.map((c) => c.player.id).filter((id): id is string => !!id),
    [pending]
  );
  const allPendingSelected =
    pendingTeamPlayerIds.length > 0 && pendingTeamPlayerIds.every((id) => selectedPendingIds.has(id));
  const somePendingSelected = pendingTeamPlayerIds.some((id) => selectedPendingIds.has(id));

  const toggleSelectAllPending = () => {
    setSelectedPendingIds((prev) => {
      if (pendingTeamPlayerIds.length > 0 && pendingTeamPlayerIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(pendingTeamPlayerIds);
    });
  };

  const availabilityPendingIds = availabilityPending.map((p) => p.id).filter((id): id is string => !!id);
  const allAvailabilitySelected =
    availabilityPendingIds.length > 0 && availabilityPendingIds.every((id) => selectedAvailabilityIds.has(id));
  const someAvailabilitySelected = availabilityPendingIds.some((id) => selectedAvailabilityIds.has(id));

  const toggleSelectAllAvailability = () =>
    setSelectedAvailabilityIds(allAvailabilitySelected ? new Set() : new Set(availabilityPendingIds));

  const canNotifyPlayers = !isPlayerOrFamily && canEdit;

  const renderNotifyActions = (kind: NotifyPendingKind) => {
    const selectedCount = selectedIdsFor(kind).size;
    return (
      <>
        <Button
          size="small"
          variant="outlined"
          startIcon={<WhatsAppIcon />}
          disabled={selectedCount === 0}
          onClick={() => setNotifyKind(kind)}
          sx={{ borderColor: "#25D366", color: "#25D366" }}
        >
          Notificar por WhatsApp
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<NotificationsActiveIcon />}
          disabled={selectedCount === 0 || sendingPush}
          onClick={() => setPushKind(kind)}
        >
          Notificar por push
        </Button>
      </>
    );
  };

  const injuredWithConv = useMemo(() => convocatedFiltered.filter((c) => c.isInjured), [convocatedFiltered]);
  const injuredNoConv: PlayerSimple[] = injuredWaiting;
  const declinedNonInjured = useMemo(
    () => convocatedFiltered.filter((c) => c.status === deconvokeStatusId && !c.isInjured),
    [convocatedFiltered, deconvokeStatusId]
  );
  // ── Own player (Player/FamilyMember) ────────────────────────────────
  // Shown first in the «Tu jugador» card and left out of every group below.
  const ownEntry: OwnPlayerEntry | null = isPlayerOrFamily
    ? findOwnPlayerEntry(
        {
          waiting: waitingList,
          availabilityPending,
          available: availablePlayers,
          injured: injuredNoConv,
          pending,
          accepted,
          injuredWithConv,
          declined: declinedNonInjured,
        },
        associatedPlayerId
      )
    : null;
  const isOwnPlayer = (p: PlayerSimple | null | undefined) => !!ownEntry && matchesAssociatedPlayer(p, associatedPlayerId);
  const shownWaitingList = waitingList.filter((p) => !isOwnPlayer(p));
  const shownNotConvoked = notConvoked.filter((p) => !isOwnPlayer(p));
  const shownAvailabilityPending = availabilityPending.filter((p) => !isOwnPlayer(p));
  const shownAvailable = availablePlayers.filter((p) => !isOwnPlayer(p));
  const shownPending = pending.filter((c) => !isOwnPlayer(c.player));
  const shownAccepted = accepted.filter((c) => !isOwnPlayer(c.player));
  const shownInjuredNoConv = injuredNoConv.filter((p) => !isOwnPlayer(p));
  const shownInjuredWithConv = injuredWithConv.filter((c) => !isOwnPlayer(c.player));
  const shownDeclined = declinedNonInjured.filter((c) => !isOwnPlayer(c.player));
  const totalDesconvocados = shownInjuredNoConv.length + shownInjuredWithConv.length + shownDeclined.length;

  const summary = {
    total: convocatedFiltered.length + injuredNoConv.length,
    accepted: isLeagueMatch ? pending.length + accepted.length : accepted.length,
    pending: isLeagueMatch ? availabilityPending.length : pending.length,
    declined: declinedNonInjured.length + injuredWithConv.length + injuredNoConv.length,
  };

  // ── Collapsible groups ──────────────────────────────────────────────
  // Coach/Administrator: everything collapsed by default.
  // Player/FamilyMember: «Aceptados» expanded (their own player is already
  // shown first in «Tu jugador»); every other group stays collapsed.
  const [groupOverrides, setGroupOverrides] = useState<Partial<Record<GroupKey, boolean>>>({});

  const defaultExpandedGroup: GroupKey | null = isPlayerOrFamily ? "accepted" : null;

  const groupCounts: Record<GroupKey, number> = {
    waiting: shownNotConvoked.length,
    availabilityPending: shownAvailabilityPending.length,
    available: shownAvailable.length,
    pending: shownPending.length,
    accepted: shownAccepted.length,
    desconvocados: totalDesconvocados,
  };

  const isGroupExpanded = (key: GroupKey): boolean => {
    if (groupCounts[key] === 0) return false;
    if (Object.prototype.hasOwnProperty.call(groupOverrides, key)) return !!groupOverrides[key];
    return defaultExpandedGroup === key;
  };

  const toggleGroup = (key: GroupKey) => {
    setGroupOverrides((prev) => ({ ...prev, [key]: !isGroupExpanded(key) }));
  };

  const [adding, setAdding] = useState(false);

  const handleAdd = async (playerId?: string) => {
    if (!coachAuthService.hasRole("Coach"))
      return alert("Solo un entrenador puede convocar.");
    if (!canEdit)
      return alert(
        "No se puede editar: el evento ya ha comenzado o está cerrado."
      );
    if (adding) return;
    setAdding(true);
    try {
      if (playerId) await convocationService.addConvocation(eventId, playerId);
      else await convocationService.addConvocationsBulk(eventId);
      const [conv, pl] = await Promise.all([
        convocationService.getConvocations(eventId),
        convocationService.getEventPlayers(eventId),
      ]);
      setConvocations(conv);
      setPlayers(pl);
    } catch (e: any) {
      alert(e?.message ?? "Error al convocar");
    } finally {
      setAdding(false);
    }
  };

  const reloadAfterAvailabilityChange = async () => {
    const [conv, pl, av] = await Promise.all([
      convocationService.getConvocations(eventId),
      convocationService.getEventPlayers(eventId),
      availabilityService.getAvailabilityRequests(eventId),
    ]);
    setConvocations(conv);
    setPlayers(pl);
    setAvailabilityRequests(av);
  };

  const runAvailabilityAction = async (action: () => Promise<void>, errorFallback: string) => {
    if (availabilityBusy) return;
    setAvailabilityBusy(true);
    try {
      await action();
      await reloadAfterAvailabilityChange();
    } catch (e: unknown) {
      showSnackbar(apiErrorMessage(e, errorFallback), "error");
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const handleRequestAvailabilityConfirmed = () =>
    runAvailabilityAction(async () => {
      const { requestedCount } = await availabilityService.requestAvailability(eventId);
      setRequestAvailabilityOpen(false);
      showSnackbar(
        `Disponibilidad pedida a ${requestedCount} ${requestedCount === 1 ? "jugador" : "jugadores"}`,
        "success"
      );
    }, "Error al pedir disponibilidad");

  const handleDecideAvailable = (request: AvailabilityRequestItem, convoke: boolean) =>
    runAvailabilityAction(async () => {
      await availabilityService.decideAvailable(eventId, request.id, convoke);
      setDeconvokeAvailableTarget(null);
    }, convoke ? "Error al convocar" : "Error al desconvocar");

  const handleRespondAvailability = (request: AvailabilityRequestItem, available: boolean, excuseTypeId?: number) =>
    runAvailabilityAction(async () => {
      if (available) await availabilityService.respondAvailability(eventId, request.id, true);
      else await availabilityService.respondAvailability(eventId, request.id, false, excuseTypeId);
    }, "Error al responder la disponibilidad");

  const handleSendPushConfirmed = async () => {
    if (!pushKind) return;
    setSendingPush(true);
    try {
      const teamPlayerIds = [...selectedIdsFor(pushKind)];
      const { notifiedCount } =
        pushKind === "availability"
          ? await availabilityService.sendAvailabilityReminders(eventId, teamPlayerIds)
          : await convocationService.sendConvocationReminders(eventId, teamPlayerIds);
      showSnackbar(`Notificación enviada a ${notifiedCount} ${notifiedCount === 1 ? "jugador" : "jugadores"}`, "success");
      setPushKind(null);
    } catch (e: unknown) {
      showSnackbar(apiErrorMessage(e, "Error al enviar la notificación push"), "error");
    } finally {
      setSendingPush(false);
    }
  };

  const handleChangeStatus = async (
    conv: ConvocationItem,
    statusId: number,
    excuseTypeId?: number | null
  ) => {
    if (!canEdit)
      return alert(
        "No se puede editar: el evento ya ha comenzado o está cerrado."
      );
    try {
      await convocationService.updateConvocationStatus(
        eventId,
        conv.id,
        statusId,
        excuseTypeId
      );
      const convs = await convocationService.getConvocations(eventId);
      setConvocations(convs);
    } catch (e: any) {
      // Defense in depth: even if the UI hid/showed this control incorrectly,
      // surface the backend's own reason (e.g. the 403 thrown for a
      // Player/FamilyMember reactivation attempt on a non-training event)
      // instead of a generic message.
      alert(
        e?.response?.data?.detail ??
          e?.message ??
          "Error al actualizar estado"
      );
    }
  };

  const handleMoveToWaiting = async (convocationId: string) => {
    if (!canEdit) return alert("No se puede editar: el evento ya ha comenzado o está cerrado.");
    try {
      await convocationService.deleteConvocation(eventId, convocationId);
      const [conv, pl] = await Promise.all([
        convocationService.getConvocations(eventId),
        convocationService.getEventPlayers(eventId),
      ]);
      setConvocations(conv);
      setPlayers(pl);
    } catch (e: any) {
      alert(e?.message ?? "Error al mover a lista de espera");
    }
  };

  const [deconvokeDialog, setDeconvokeDialog] = useState<{
    open: boolean;
    conv?: ConvocationItem;
    waitingPlayerId?: string;
  }>({ open: false });

  const [notAvailableDialog, setNotAvailableDialog] = useState<{
    open: boolean;
    conv?: ConvocationItem;
  }>({ open: false });

  const photoOf = (p: PlayerSimple | null | undefined): string | null =>
    (p?.id != null ? playerPhotos[String(p.id)] : null) ?? (p?.urlPhoto ? playerPhotos[String(p.urlPhoto)] : null) ?? null;

  const canEditThisConvocationFor = (c: ConvocationItem) =>
    !isPlayerOrFamily || (canEdit && matchesAssociatedPlayer(c.player, associatedPlayerId));

  const openDeconvokeDialog = (cv: ConvocationItem) => {
    if (!canEdit) return alert("No se puede editar: el evento ya ha comenzado.");
    setDeconvokeDialog({ open: true, conv: cv });
  };

  const renderConvocation = (
    c: ConvocationItem,
    {
      selectableInPending = false,
      closedConvocation = false,
      variant = "row",
    }: { selectableInPending?: boolean; closedConvocation?: boolean; variant?: "row" | "own" } = {}
  ) => {
    const teamPlayerId = c.player?.id;
    return (
      <ConvocationCard
        key={c.id}
        variant={variant}
        conv={c}
        isInjured={c.isInjured}
        photoSrc={photoOf(c.player)}
        statuses={statuses}
        excuseTypes={excuseTypes}
        canEdit={canEdit}
        canEditThisConvocation={canEditThisConvocationFor(c)}
        viewablePlayerId={null}
        hideWaitingListButton={isPlayerOrFamily}
        canReactivateFromDeconvoke={canReactivateFromDeconvokeByEventType && canPlayerOrFamilyModifyDeconvoke(c)}
        selectable={selectableInPending && !isPlayerOrFamily && canEdit}
        selected={!!teamPlayerId && selectedPendingIds.has(teamPlayerId)}
        onToggleSelect={toggleSelectedPending}
        closedConvocation={closedConvocation}
        onChangeStatus={handleChangeStatus}
        onDelete={openDeconvokeDialog}
        onEditReason={canPlayerOrFamilyModifyDeconvoke(c) ? openDeconvokeDialog : undefined}
        onMoveToWaiting={(cv) => handleMoveToWaiting(cv.id)}
      />
    );
  };

  const renderInjuredRow = (p: PlayerSimple) => (
    <PlayerRow
      key={p.id}
      name={playerDisplayName(p)}
      photoSrc={photoOf(p)}
      dorsal={playerDorsal(p)}
      positionTag={positionTagOf(p.position)}
      detailHref={playerDetailHref(p)}
      secondary="Lesionado"
      status={{ label: "Baja", tone: "declined" }}
      dimmed
    />
  );

  const renderOwnPlayer = () => {
    if (!ownEntry) return null;
    if ("conv" in ownEntry) {
      return renderConvocation(ownEntry.conv, { variant: "own", closedConvocation: !!isLeagueMatch });
    }
    const p = ownEntry.player;
    const request = ownEntry.kind === "availabilityPending" ? availabilityOf(p) : undefined;
    const statusByKind = {
      waiting: { label: "En espera", tone: "waiting" },
      availabilityPending: { label: "Sin responder", tone: "pending" },
      available: { label: "Disponible", tone: "available" },
      injured: { label: "Baja", tone: "declined" },
    } as const;
    return (
      <OwnPlayerCard
        name={playerDisplayName(p)}
        photoSrc={photoOf(p)}
        dorsal={playerDorsal(p)}
        position={p.position}
        detailHref={playerDetailHref(p)}
        status={statusByKind[ownEntry.kind]}
        detail={ownEntry.kind === "injured" ? "Lesionado" : null}
        actions={
          request && (
            <>
              <button
                type="button"
                className={`${actionStyles.textBtn} ${actionStyles.positive}`}
                disabled={availabilityBusy || !canEdit}
                onClick={() => handleRespondAvailability(request, true)}
              >
                Sí, disponible
              </button>
              <button
                type="button"
                className={`${actionStyles.textBtn} ${actionStyles.negative}`}
                disabled={availabilityBusy || !canEdit}
                onClick={() => setUnavailableTarget(request)}
              >
                No disponible
              </button>
            </>
          )
        }
      />
    );
  };

  return (
    <div>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Convocatoria" />
        {/* Marking attendance is exclusively the coach's responsibility on
            event day — Player/FamilyPlayer/FamilyMember must never see or
            reach this tab (see AttendanceTabsAsistenciaTabVisibility.test.tsx). */}
        {!isPlayerOrFamily && <Tab label="Asistencia" />}
      </Tabs>

      {tab === 0 && !loading && (
        <div className={styles.topStack}>
          {renderOwnPlayer()}
          <ConvocationSummary {...summary} />
        </div>
      )}

      {tab === 0 && (
        <Box className={styles.page}>
          <div className={styles.half}>
            <CollapsibleGroup
              title="Lista de espera"
              count={shownNotConvoked.length}
              colorClassName={styles.listGroupHeaderBlue}
              expanded={isGroupExpanded("waiting")}
              onToggle={() => toggleGroup("waiting")}
              headerExtra={
                shownWaitingList.length > 0 &&
                (isLeagueMatch ? (
                  !isPlayerOrFamily && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setRequestAvailabilityOpen(true)}
                      disabled={availabilityBusy || !canEdit || !coachAuthService.hasRole("Coach")}
                    >
                      Pedir disponibilidad
                    </Button>
                  )
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAdd()}
                    disabled={adding || !coachAuthService.hasRole("Coach")}
                  >
                    Convocar toda la lista de espera
                  </Button>
                ))
              }
            >
              <NotConvokedList
                players={shownWaitingList}
                photos={playerPhotos}
                onAdd={handleAdd}
                onReject={(playerId) =>
                  setDeconvokeDialog({ open: true, waitingPlayerId: playerId })
                }
                canEdit={coachAuthService.hasRole("Coach")}
                adding={adding}
              />
            </CollapsibleGroup>

            {isLeagueMatch && (
              <>
                <CollapsibleGroup
                  title="Pendientes de respuesta"
                  count={shownAvailabilityPending.length}
                  colorClassName={styles.listGroupHeaderGray}
                  expanded={isGroupExpanded("availabilityPending")}
                  onToggle={() => toggleGroup("availabilityPending")}
                  headerExtra={
                    canNotifyPlayers &&
                    shownAvailabilityPending.length > 0 && (
                      <>
                        <Checkbox
                          size="small"
                          checked={allAvailabilitySelected}
                          indeterminate={someAvailabilitySelected && !allAvailabilitySelected}
                          onChange={toggleSelectAllAvailability}
                          inputProps={{ "aria-label": "Seleccionar todos los pendientes de respuesta" }}
                        />
                        {renderNotifyActions("availability")}
                      </>
                    )
                  }
                >
                  <AvailabilityList
                    players={shownAvailabilityPending}
                    photos={playerPhotos}
                    statusTone="pending"
                    emptyText="No hay jugadores pendientes de responder."
                    badgeText="Sin responder"
                    disabled={availabilityBusy || !canEdit}
                    selectable={canNotifyPlayers}
                    selectedIds={selectedAvailabilityIds}
                    onToggleSelect={toggleSelectedAvailability}
                    getActions={(p) => {
                      const request = availabilityOf(p);
                      // The coach can answer on behalf of a player (e.g. one who confirmed in person).
                      const isCoach = !isPlayerOrFamily && coachAuthService.hasRole("Coach");
                      if (!request || !isCoach) return [];
                      return [
                        { label: "Disponible", tone: "teal", onClick: () => handleRespondAvailability(request, true) },
                        { label: "No disponible", tone: "red", onClick: () => setUnavailableTarget(request) },
                      ];
                    }}
                  />
                </CollapsibleGroup>

                <CollapsibleGroup
                  title="Disponibles"
                  count={shownAvailable.length}
                  colorClassName={styles.listGroupHeaderTeal}
                  expanded={isGroupExpanded("available")}
                  onToggle={() => toggleGroup("available")}
                >
                  <AvailabilityList
                    players={shownAvailable}
                    photos={playerPhotos}
                    statusTone="available"
                    emptyText="Todavía no hay jugadores disponibles."
                    badgeText="Disponible"
                    disabled={availabilityBusy || !canEdit}
                    getActions={(p) => {
                      const request = availabilityOf(p);
                      if (!request || isPlayerOrFamily || !coachAuthService.hasRole("Coach")) return [];
                      return [
                        { label: "Convocar", tone: "teal", onClick: () => handleDecideAvailable(request, true) },
                        { label: "Desconvocar", tone: "red", onClick: () => setDeconvokeAvailableTarget(request) },
                      ];
                    }}
                  />
                </CollapsibleGroup>
              </>
            )}
          </div>

          <div className={styles.half}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderTeal}`}>
              <div className={styles.listGroupTitle}>
                <span>Convocados</span>
                <span className={styles.listGroupCount}>
                  {convocatedFiltered.filter((c) => !isOwnPlayer(c.player)).length}
                </span>
              </div>
            </div>

            {(() => {
              if (loading) return <div>Cargando...</div>;

              const shownConvocated = shownPending.length + shownAccepted.length + totalDesconvocados;
              if (shownConvocated === 0)
                return <EmptyState description={ownEntry ? "No hay más convocados." : "No hay convocados aún."} />;

              return (
                <div className={styles.convocatedGroups}>
                  {isLeagueMatch && shownPending.length + shownAccepted.length > 0 && (
                    <PositionGroupedList
                      items={[...shownPending, ...shownAccepted]}
                      getPosition={(c) => c.player?.position}
                      renderItem={(c) => renderConvocation(c, { closedConvocation: true })}
                    />
                  )}
                  {!isLeagueMatch && shownPending.length > 0 && (
                    <CollapsibleGroup
                      title="Pendientes de aceptar"
                      count={shownPending.length}
                      colorClassName={styles.listGroupHeaderOrange}
                      expanded={isGroupExpanded("pending")}
                      onToggle={() => toggleGroup("pending")}
                      headerExtra={
                        !isPlayerOrFamily &&
                        canEdit && (
                          <>
                            <Checkbox
                              size="small"
                              checked={allPendingSelected}
                              indeterminate={somePendingSelected && !allPendingSelected}
                              onChange={toggleSelectAllPending}
                              inputProps={{ "aria-label": "Seleccionar todos los pendientes" }}
                            />
                            {renderNotifyActions("convocation")}
                            {(() => {
                              const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
                              if (!acceptedId) return null;
                              return (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={acceptingAll}
                                  onClick={async () => {
                                    setAcceptingAll(true);
                                    try {
                                      await Promise.all(
                                        pending.map((c) =>
                                          convocationService.updateConvocationStatus(eventId, c.id, acceptedId, null)
                                        )
                                      );
                                      const conv = await convocationService.getConvocations(eventId);
                                      setConvocations(conv);
                                    } catch (err: any) {
                                      alert(err?.message ?? "Error al aceptar convocados");
                                    } finally {
                                      setAcceptingAll(false);
                                    }
                                  }}
                                >
                                  Aceptar todos
                                </Button>
                              );
                            })()}
                          </>
                        )
                      }
                    >
                      <PositionGroupedList
                        items={shownPending}
                        getPosition={(c) => c.player?.position}
                        renderItem={(c) => renderConvocation(c, { selectableInPending: true })}
                      />
                    </CollapsibleGroup>
                  )}
                  {!isLeagueMatch && shownAccepted.length > 0 && (
                    <CollapsibleGroup
                      title="Aceptados"
                      count={shownAccepted.length}
                      colorClassName={styles.listGroupHeaderGreen}
                      expanded={isGroupExpanded("accepted")}
                      onToggle={() => toggleGroup("accepted")}
                    >
                      <PositionGroupedList
                        items={shownAccepted}
                        getPosition={(c) => c.player?.position}
                        renderItem={(c) => renderConvocation(c)}
                      />
                    </CollapsibleGroup>
                  )}
                  {totalDesconvocados > 0 ? (
                    <CollapsibleGroup
                      title="Desconvocados"
                      count={totalDesconvocados}
                      colorClassName={styles.listGroupHeaderRed}
                      expanded={isGroupExpanded("desconvocados")}
                      onToggle={() => toggleGroup("desconvocados")}
                    >
                      <PositionGroupedList
                        items={[
                          ...shownInjuredNoConv.map((p) => ({ position: p.position, node: renderInjuredRow(p) })),
                          ...shownInjuredWithConv.map((c) => ({ position: c.player?.position, node: renderConvocation(c) })),
                          ...shownDeclined.map((c) => ({ position: c.player?.position, node: renderConvocation(c) })),
                        ]}
                        getPosition={(item) => item.position}
                        renderItem={(item) => item.node}
                      />
                    </CollapsibleGroup>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </Box>
      )}

      {tab === 1 && !isPlayerOrFamily && (
        <Box className={styles.page}>
          <div style={{ width: "100%" }}>
            <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderBlue}`} style={{ marginBottom: 8 }}>
              <span>Asistencia</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {canEdit && !isPlayerOrFamily && (() => {
                  const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
                  const notAttending = convocations.filter(
                    (c) => c.status === acceptedId && c.assistanceTypeId !== 1
                  );
                  if (notAttending.length === 0) return null;
                  return (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={settingAllAttends}
                      onClick={async () => {
                        setSettingAllAttends(true);
                        try {
                          await Promise.all(
                            notAttending.map((c) =>
                              assistanceTypeService.updateConvocationAssistance(eventId, c.id, 1, null)
                            )
                          );
                          const conv = await convocationService.getConvocations(eventId);
                          setConvocations(conv);
                        } catch (err: any) {
                          alert(err?.message ?? "Error al actualizar asistencia");
                        } finally {
                          setSettingAllAttends(false);
                        }
                      }}
                    >
                      Todos asisten
                    </Button>
                  );
                })()}
              </div>
            </div>
            {(() => {
              const acceptedId = statuses.find((s) => s.name === "Accepted")?.id;
              const withAttendance = convocations.filter((c) => c.status === acceptedId);
              if (withAttendance.length === 0) {
                return <EmptyState title="Asistencia" description="No hay jugadores aceptados todavía." />;
              }
              // ids 1 (Asiste) y 4 (Llega tarde) = asisten; 2 y 3 = no asisten; null = sin indicar
              const attend = withAttendance.filter((c) => c.assistanceTypeId === 1 || c.assistanceTypeId === 4);
              const absent = withAttendance.filter((c) => c.assistanceTypeId === 2 || c.assistanceTypeId === 3);
              const pending = withAttendance.filter((c) => !c.assistanceTypeId);

              const renderCard = (c: typeof withAttendance[0]) => {
                const assistColorClass = (id: number | null | undefined) => {
                  if (id === 1) return styles.optionBtnGreen;
                  if (id === 2) return styles.optionBtnOrange;
                  if (id === 3) return styles.optionBtnRed;
                  if (id === 4) return styles.optionBtnBlue;
                  return styles.optionBtnGray;
                };
                const NO_EXCUSA_ID = 2;
                const p = c.player as any;
                const displayName = p?.alias || ((p?.name ?? "") + " " + (p?.lastName ?? "")).trim() || "Jugador";
                const dorsalValue =
                  typeof p?.dorsal === "number" ? p.dorsal : p?.dorsal ? Number(p.dorsal) : null;
                const hasDorsal =
                  typeof dorsalValue === "number" && Number.isFinite(dorsalValue);
                const rawPhotoSrc =
                  playerPhotos[String(c.player?.id ?? "")] ??
                  playerPhotos[String(c.player?.urlPhoto ?? "")] ??
                  null;
                const photo = rawPhotoSrc ?? defaultAvatar;
                const stripeClass =
                  c.assistanceTypeId === 1 || c.assistanceTypeId === 4
                    ? styles.cromoStatusStripeAttends
                    : c.assistanceTypeId === 2 || c.assistanceTypeId === 3
                    ? styles.cromoStatusStripeAbsent
                    : styles.cromoStatusStripePending;

                return (
                  <div key={c.id} className={styles.cardWrap}>
                    <div className={styles.cromoCard}>
                      {c.player?.id ? (
                        <Link to={`/coach/player/${c.player.id}`} className={styles.cromoPhotoLink}>
                          <div className={styles.cromoPhotoArea}>
                            <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                            <div className={styles.cromoGradient} />
                            {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                            <div className={`${styles.cromoStatusStripe} ${stripeClass}`} />
                          </div>
                        </Link>
                      ) : (
                        <div className={styles.cromoPhotoArea}>
                          <img src={photo} alt={displayName} className={photo === defaultAvatar ? styles.cromoPhotoAvatar : styles.cromoPhoto} />
                          <div className={styles.cromoGradient} />
                          {hasDorsal && <div className={styles.cromoDorsalBadge}>{dorsalValue}</div>}
                          <div className={`${styles.cromoStatusStripe} ${stripeClass}`} />
                        </div>
                      )}
                      <div className={styles.cromoBody}>
                        <div className={styles.cromoAccentLine} />
                        <div className={styles.cromoName}>{displayName}</div>
                        {p?.position && <div className={styles.cromoPosition}>{p.position}</div>}
                        <div className={styles.cromoActions}>
                          <div className={styles.optionGroup}>
                            <button
                              disabled={!canEdit}
                              className={`${styles.optionBtn} ${styles.optionBtnGray}${!c.assistanceTypeId ? " " + styles.optionBtnActive : ""}`}
                              onClick={async () => {
                                try {
                                  await assistanceTypeService.updateConvocationAssistance(eventId, c.id, null, null);
                                  const conv = await convocationService.getConvocations(eventId);
                                  setConvocations(conv);
                                } catch (err: any) { alert(err?.message ?? "Error"); }
                              }}
                            >Sin indicar</button>
                            {assistanceTypes.map((a) => (
                              <button
                                key={a.id}
                                disabled={!canEdit}
                                className={`${styles.optionBtn} ${assistColorClass(a.id)}${c.assistanceTypeId === a.id ? " " + styles.optionBtnActive : ""}`}
                                onClick={async () => {
                                  try {
                                    await assistanceTypeService.updateConvocationAssistance(eventId, c.id, a.id, null);
                                    const conv = await convocationService.getConvocations(eventId);
                                    setConvocations(conv);
                                  } catch (err: any) { alert(err?.message ?? "Error al actualizar asistencia"); }
                                }}
                              >{a.name}</button>
                            ))}
                          </div>
                          {c.assistanceTypeId === NO_EXCUSA_ID && excuseTypes.length > 0 && (
                            <div className={styles.optionGroupSub}>
                              {excuseTypes.map((ex) => (
                                <button
                                  key={ex.id}
                                  disabled={!canEdit}
                                  className={`${styles.optionBtn} ${styles.optionSubBtn} ${styles.optionBtnPurple}${c.excuseTypeId === ex.id ? " " + styles.optionBtnActive : ""}`}
                                  onClick={async () => {
                                    try {
                                      await assistanceTypeService.updateConvocationAssistance(eventId, c.id, NO_EXCUSA_ID, ex.id);
                                      const conv = await convocationService.getConvocations(eventId);
                                      setConvocations(conv);
                                    } catch (err: any) { alert(err?.message ?? "Error al guardar excusa"); }
                                  }}
                                >{ex.name}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
                  {attend.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGreen}`}>
                        <div className={styles.listGroupTitle}>
                          <span>Asisten</span>
                          <span className={styles.listGroupCount}>{attend.length}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>
                        {attend.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {absent.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderRed}`}>
                        <div className={styles.listGroupTitle}>
                          <span>No asisten</span>
                          <span className={styles.listGroupCount}>{absent.length}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>
                        {absent.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {pending.length > 0 && (
                    <div>
                      <div className={`${styles.listGroupHeader} ${styles.listGroupHeaderGray}`}>
                        <div className={styles.listGroupTitle}>
                          <span>Sin indicar</span>
                          <span className={styles.listGroupCount}>{pending.length}</span>
                        </div>
                      </div>
                      <div className={styles.convocatedList}>
                        {pending.map(renderCard)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Box>
      )}

      <DeconvokeDialog
        open={deconvokeDialog.open}
        onClose={() => setDeconvokeDialog({ open: false })}
        excuseTypes={excuseTypes}
        hideTechnical={(!isMatch && !!deconvokeDialog.waitingPlayerId) || (isPlayerOrFamily && !!deconvokeDialog.conv)}
        hideCoachOnly={isPlayerOrFamily}
        confirmLabel={
          deconvokeDialog.waitingPlayerId
            ? "Rechazar"
            : deconvokeDialog.conv?.status === deconvokeStatusId
            ? "Guardar"
            : "Desconvocar"
        }
        title={
          deconvokeDialog.waitingPlayerId
            ? "Motivo del rechazo"
            : deconvokeDialog.conv?.status === deconvokeStatusId
            ? "Editar motivo de desconvocatoria"
            : undefined
        }
        initialValue={
          deconvokeDialog.conv && deconvokeDialog.conv.status === deconvokeStatusId
            ? deconvokeDialog.conv.excuseTypeId
              ? String(deconvokeDialog.conv.excuseTypeId)
              : "technical"
            : undefined
        }
        onConfirm={async (reason) => {
          const excuseTypeId = reason === "technical" ? null : Number(reason);
          try {
            if (deconvokeDialog.waitingPlayerId) {
              // Player in lista de espera: add convocation then set Deconvoke
              const playerId = deconvokeDialog.waitingPlayerId;
              await convocationService.addConvocation(eventId, playerId);
              const reloaded = await convocationService.getConvocations(eventId);
              const newConv = reloaded.find((c) => c.player?.id === playerId);
              const deconvokeId = statuses.find((s) => s.name === "Deconvoke")?.id;
              if (newConv && deconvokeId) {
                await convocationService.updateConvocationStatus(eventId, newConv.id, deconvokeId, excuseTypeId);
              }
            } else if (deconvokeDialog.conv) {
              // Already-convoked player: set status to Deconvoke
              const deconvokeId = statuses.find((s) => s.name === "Deconvoke")?.id;
              if (deconvokeId) {
                await convocationService.updateConvocationStatus(
                  eventId,
                  deconvokeDialog.conv.id,
                  deconvokeId,
                  excuseTypeId
                );
              }
            }
            const [conv, pl] = await Promise.all([
              convocationService.getConvocations(eventId),
              convocationService.getEventPlayers(eventId),
            ]);
            setConvocations(conv);
            setPlayers(pl);
          } catch (e: any) {
            alert(e?.message ?? "Error al desconvocar");
          }
        }}
      />

      <DeconvokeDialog
        open={!!unavailableTarget}
        onClose={() => setUnavailableTarget(null)}
        excuseTypes={excuseTypes}
        hideCoachOnly
        title="¿Por qué no está disponible?"
        confirmLabel="No disponible"
        onConfirm={(reason) => {
          if (unavailableTarget) handleRespondAvailability(unavailableTarget, false, Number(reason));
        }}
      />

      <ConfirmDialog
        open={requestAvailabilityOpen}
        title="Pedir disponibilidad"
        description={`Se preguntará a ${waitingList.length} ${
          waitingList.length === 1 ? "jugador" : "jugadores"
        } de la lista de espera (y a sus familiares con cuenta vinculada) si están disponibles para el partido. Los lesionados y sancionados no recibirán la petición.`}
        confirmText="Pedir"
        processing={availabilityBusy}
        onCancel={() => setRequestAvailabilityOpen(false)}
        onConfirm={handleRequestAvailabilityConfirmed}
      />

      <ConfirmDialog
        open={!!deconvokeAvailableTarget}
        title="Desconvocar jugador disponible"
        description="El jugador pasará a desconvocados con el motivo «Decisión técnica»."
        confirmText="Desconvocar"
        processing={availabilityBusy}
        onCancel={() => setDeconvokeAvailableTarget(null)}
        onConfirm={() => {
          if (deconvokeAvailableTarget) handleDecideAvailable(deconvokeAvailableTarget, false);
        }}
      />

      <NotifyPendingConvocationDialog
        open={notifyKind !== null}
        onClose={() => setNotifyKind(null)}
        eventId={eventId}
        teamPlayerIds={[...selectedIdsFor(notifyKind)]}
        eventSummary={eventSummary}
        kind={notifyKind ?? "convocation"}
      />

      <ConfirmDialog
        open={pushKind !== null}
        title="Enviar notificación push"
        description={`Se enviará un recordatorio para ${
          pushKind === "availability" ? "indicar la disponibilidad para el partido" : "confirmar la convocatoria"
        } a ${selectedIdsFor(pushKind).size} ${
          selectedIdsFor(pushKind).size === 1 ? "jugador seleccionado" : "jugadores seleccionados"
        } (y sus familiares con cuenta vinculada).`}
        confirmText="Enviar"
        processing={sendingPush}
        onCancel={() => setPushKind(null)}
        onConfirm={handleSendPushConfirmed}
      />
    </div>
  );
}
