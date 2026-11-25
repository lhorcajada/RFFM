import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import SearchIcon from "@mui/icons-material/Search";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import { useTeamRoster } from "../../hooks/useTeamRoster";
import useIsPlayerRole from "../../hooks/useIsPlayerRole";
import {
  advanceLotteryBookStatus,
  assignLotteryBook,
  createLotteryBooks,
  createLotteryCampaign,
  deleteLotteryBook,
  getLotteryCampaign,
  getLotteryCampaigns,
  undoLotteryBookStatus,
  updateLotteryBook,
  updateLotteryCampaign,
} from "../../services/lotteryService";
import type {
  LotteryBook,
  LotteryCampaign,
  LotteryCampaignRequest,
  LotteryCampaignSummary,
} from "../../services/lotteryService";
import {
  BOOK_STATUS_LABELS,
  PLAYER_FILTER_ORDER,
  apiErrorMessage,
  bookTicketCount,
  booksByPlayer,
  christmasCampaignDefaults,
  countByFilter,
  formatEuros,
  initialFilter,
  playerLotteryFilter,
  searchPlayers,
  suggestNextBook,
  undoEffect,
} from "./lotteryHelpers";
import type { PlayerLotteryFilter } from "./lotteryHelpers";
import LotterySummary from "./components/LotterySummary";
import LotteryPlayerCard from "./components/LotteryPlayerCard";
import type { LotteryCardPlayer } from "./components/LotteryPlayerCard";
import LotteryUnassignedBooks from "./components/LotteryUnassignedBooks";
import AssignBookSheet from "./components/AssignBookSheet";
import type { AssignBookValues } from "./components/AssignBookSheet";
import BookDateSheet from "./components/BookDateSheet";
import CreateBooksDialog from "./components/CreateBooksDialog";
import ReturnBookSheet from "./components/ReturnBookSheet";
import LotteryClubDeliveryCard from "./components/LotteryClubDeliveryCard";
import LotteryCampaignDialog from "./components/LotteryCampaignDialog";
import styles from "./Lottery.module.css";

const FILTER_LABELS: Record<PlayerLotteryFilter, string> = {
  none: "Sin taco",
  Assigned: BOOK_STATUS_LABELS.Assigned,
  DeliveredToPlayer: BOOK_STATUS_LABELS.DeliveredToPlayer,
  ReturnedToCoach: BOOK_STATUS_LABELS.ReturnedToCoach,
  DeliveredToClub: BOOK_STATUS_LABELS.DeliveredToClub,
};

type AssignTarget =
  | { mode: "assign"; player?: LotteryCardPlayer; book?: LotteryBook }
  | { mode: "edit"; book: LotteryBook };

type DateStep = { kind: "player" | "club"; book: LotteryBook };

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function playerLabel(player: LotteryCardPlayer): string {
  return player.alias || player.name;
}

export default function Lottery() {
  useAuditPageAccess("Lottery");
  const goToTeamDashboard = useTeamDashboardBack();
  const { team } = useTeamAndClub();
  const teamId = team?.id ?? null;
  const { players: roster } = useTeamRoster(teamId);
  const isPlayerRole = useIsPlayerRole();

  const [campaigns, setCampaigns] = useState<LotteryCampaignSummary[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<LotteryCampaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState("");
  const [numericKeyboard, setNumericKeyboard] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PlayerLotteryFilter>("none");
  const initialFilterFor = useRef<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [dateStep, setDateStep] = useState<DateStep | null>(null);
  const [returnTarget, setReturnTarget] = useState<LotteryBook | null>(null);
  const [undoTarget, setUndoTarget] = useState<LotteryBook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LotteryBook | null>(null);
  const [createBooksOpen, setCreateBooksOpen] = useState(false);
  const [campaignDialog, setCampaignDialog] = useState<"create" | "edit" | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    setLoading(true);
    getLotteryCampaigns(teamId)
      .then((list) => {
        if (!active) return;
        setCampaigns(list);
        setCampaignId(list[0]?.id ?? null);
        if (list.length === 0) setCampaign(null);
      })
      .catch((e: unknown) => notify(apiErrorMessage(e, "No se pudieron cargar las campañas de lotería."), "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId]);

  const loadedCampaignId = campaign?.id ?? null;
  useEffect(() => {
    if (!teamId || !campaignId || loadedCampaignId === campaignId) return;
    let active = true;
    setLoading(true);
    getLotteryCampaign(teamId, campaignId)
      .then((detail) => {
        if (active) setCampaign(detail);
      })
      .catch((e: unknown) => notify(apiErrorMessage(e, "No se pudo cargar la campaña de lotería."), "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId, campaignId, loadedCampaignId]);

  const books = useMemo(() => campaign?.books ?? [], [campaign]);
  const unassignedBooks = useMemo(() => books.filter((b) => b.status === "Unassigned"), [books]);
  const canEdit = campaign?.canEdit ?? false;
  const grouped = useMemo(() => booksByPlayer(books), [books]);

  const players = useMemo<LotteryCardPlayer[]>(() => {
    const known = new Set(roster.map((p) => p.id));
    const orphans = [...grouped.keys()]
      .filter((id) => !known.has(id))
      .map((id) => ({ id, name: "Jugador", lastName: "fuera de la plantilla", alias: "", dorsal: null }));
    return [...roster, ...orphans];
  }, [roster, grouped]);

  const counts = useMemo(() => countByFilter(players, books), [players, books]);

  useEffect(() => {
    if (!campaign || roster.length === 0 || initialFilterFor.current === campaign.id) return;
    initialFilterFor.current = campaign.id;
    setStatusFilter(initialFilter(counts));
  }, [campaign, roster.length, counts]);

  const visiblePlayers = useMemo(() => {
    if (!canEdit) return searchPlayers(players.filter((p) => grouped.has(p.id)), "");
    if (search.trim()) return searchPlayers(players, search);
    return searchPlayers(
      players.filter((p) => playerLotteryFilter(grouped.get(p.id) ?? []) === statusFilter),
      "",
    );
  }, [canEdit, players, grouped, search, statusFilter]);

  const runAction = useCallback(
    async (action: () => Promise<LotteryCampaign>, success: string, failure: string) => {
      if (!teamId) return false;
      setProcessing(true);
      try {
        setCampaign(await action());
        notify(success, "success");
        return true;
      } catch (e: unknown) {
        notify(apiErrorMessage(e, failure), "error");
        return false;
      } finally {
        setProcessing(false);
      }
    },
    [teamId],
  );

  const assignInitial = useMemo<AssignBookValues>(() => {
    if (assignTarget?.mode === "edit") {
      const { book } = assignTarget;
      return {
        teamPlayerId: book.teamPlayerId,
        bookNumber: book.bookNumber,
        firstTicketNumber: book.firstTicketNumber,
        lastTicketNumber: book.lastTicketNumber,
      };
    }
    if (assignTarget?.book) {
      const { book } = assignTarget;
      return {
        teamPlayerId: null,
        bookNumber: book.bookNumber,
        firstTicketNumber: book.firstTicketNumber,
        lastTicketNumber: book.lastTicketNumber,
      };
    }
    return {
      teamPlayerId: assignTarget?.player?.id ?? null,
      ...suggestNextBook(books, campaign?.ticketsPerBook ?? 1),
    };
  }, [assignTarget, books, campaign?.ticketsPerBook]);

  const campaignInitial = useMemo<LotteryCampaignRequest>(() => {
    if (campaignDialog === "edit" && campaign) {
      const { name, drawDate, ticketPrice, ticketsPerBook, clubDeliveryFrom, clubDeliveryTo } = campaign;
      return { name, drawDate, ticketPrice, ticketsPerBook, clubDeliveryFrom, clubDeliveryTo };
    }
    return christmasCampaignDefaults();
  }, [campaignDialog, campaign]);

  const playerById = (id: string | null) => (id === null ? undefined : players.find((p) => p.id === id));

  const handleAdvance = (book: LotteryBook) => {
    if (book.status === "Assigned") setDateStep({ kind: "player", book });
    if (book.status === "DeliveredToPlayer") setReturnTarget(book);
    if (book.status === "ReturnedToCoach") setDateStep({ kind: "club", book });
  };

  const handleAssignSubmit = async (values: AssignBookValues) => {
    if (!teamId || !campaign || !assignTarget) return;
    const numbers = {
      bookNumber: values.bookNumber,
      firstTicketNumber: values.firstTicketNumber,
      lastTicketNumber: values.lastTicketNumber,
    };
    let ok = false;
    if (assignTarget.mode === "edit") {
      ok = await runAction(
        () => updateLotteryBook(teamId, campaign.id, assignTarget.book.id, numbers),
        `Taco ${values.bookNumber} actualizado`,
        "No se pudo actualizar el taco.",
      );
    } else if (values.teamPlayerId) {
      const teamPlayerId = values.teamPlayerId;
      const assigned = playerById(teamPlayerId);
      ok = await runAction(
        () => assignLotteryBook(teamId, campaign.id, { bookId: assignTarget.book?.id, teamPlayerId, ...numbers }),
        `Taco ${values.bookNumber} asignado${assigned ? ` a ${playerLabel(assigned)}` : ""}`,
        "No se pudo asignar el taco.",
      );
    }
    if (ok) {
      setAssignTarget(null);
      setSearch("");
    }
  };

  const handleDateStepSubmit = async (date: string) => {
    if (!teamId || !campaign || !dateStep) return;
    const { kind, book } = dateStep;
    const owner = playerById(book.teamPlayerId);
    const ok = await runAction(
      () => advanceLotteryBookStatus(teamId, campaign.id, book.id, { date }),
      kind === "player"
        ? `Taco ${book.bookNumber} entregado${owner ? ` a ${playerLabel(owner)}` : ""}`
        : `Taco ${book.bookNumber} entregado al club`,
      kind === "player" ? "No se pudo entregar el taco al jugador." : "No se pudo entregar el taco al club.",
    );
    if (ok) {
      setDateStep(null);
      setSearch("");
    }
  };

  const handleReturnSubmit = async (amount: number, returnedOn: string) => {
    if (!teamId || !campaign || !returnTarget) return;
    const ok = await runAction(
      () => advanceLotteryBookStatus(teamId, campaign.id, returnTarget.id, { amount, date: returnedOn }),
      `Taco ${returnTarget.bookNumber} devuelto · ${formatEuros(amount)}`,
      "No se pudo registrar la devolución.",
    );
    if (ok) {
      setReturnTarget(null);
      setSearch("");
    }
  };

  const handleUndoConfirmed = async () => {
    if (!teamId || !campaign || !undoTarget) return;
    const ok = await runAction(
      () => undoLotteryBookStatus(teamId, campaign.id, undoTarget.id),
      `Paso del taco ${undoTarget.bookNumber} deshecho`,
      "No se pudo deshacer el paso del taco.",
    );
    if (ok) setUndoTarget(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!teamId || !campaign || !deleteTarget) return;
    const ok = await runAction(
      () => deleteLotteryBook(teamId, campaign.id, deleteTarget.id),
      `Taco ${deleteTarget.bookNumber} eliminado`,
      "No se pudo eliminar el taco.",
    );
    if (ok) setDeleteTarget(null);
  };

  const handleCreateBooks = async (count: number) => {
    if (!teamId || !campaign) return;
    const ok = await runAction(
      () => createLotteryBooks(teamId, campaign.id, { count }),
      count === 1 ? "Taco creado" : `${count} tacos creados`,
      "No se pudieron crear los tacos.",
    );
    if (ok) setCreateBooksOpen(false);
  };

  const handleCampaignSubmit = async (values: LotteryCampaignRequest) => {
    if (!teamId) return;
    setProcessing(true);
    try {
      const saved =
        campaignDialog === "edit" && campaign
          ? await updateLotteryCampaign(teamId, campaign.id, values)
          : await createLotteryCampaign(teamId, values);
      setCampaign(saved);
      setCampaigns((list) => {
        const summary = { id: saved.id, name: saved.name, drawDate: saved.drawDate };
        const others = list.filter((c) => c.id !== saved.id);
        return [summary, ...others].sort((a, b) => b.drawDate.localeCompare(a.drawDate));
      });
      setCampaignId(saved.id);
      setCampaignDialog(null);
      notify("Campaña guardada", "success");
    } catch (e: unknown) {
      notify(apiErrorMessage(e, "No se pudo guardar la campaña."), "error");
    } finally {
      setProcessing(false);
    }
  };

  const canCreate = !isPlayerRole;
  const assignTitle =
    assignTarget?.mode === "edit"
      ? `Editar taco ${assignTarget.book.bookNumber}`
      : assignTarget?.book
        ? `Asignar taco ${assignTarget.book.bookNumber}`
        : "Asignar taco";
  const undoDetails = undoTarget ? undoEffect(undoTarget.status) : null;
  const dateStepOwner = dateStep ? playerById(dateStep.book.teamPlayerId) : undefined;
  const returnPlayer = returnTarget ? playerById(returnTarget.teamPlayerId) : undefined;

  const renderContent = () => {
    if (!teamId || (loading && !campaign)) {
      return (
        <Box className={styles.centered}>
          <CircularProgress />
        </Box>
      );
    }

    if (!campaign) {
      return (
        <Stack spacing={2} alignItems="center" className={styles.empty}>
          <EmptyState
            title="No hay ninguna campaña de lotería"
            description={
              canCreate
                ? "Crea la campaña para empezar a repartir los tacos a los jugadores."
                : "Cuando el entrenador cree la campaña verás aquí tus tacos."
            }
          />
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCampaignDialog("create")}>
              Crear campaña
            </Button>
          )}
        </Stack>
      );
    }

    return (
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {campaigns.length > 1 ? (
            <Select
              size="small"
              value={campaign.id}
              onChange={(e) => setCampaignId(e.target.value)}
              className={styles.campaignSelect}
              inputProps={{ "aria-label": "Campaña" }}
            >
              {campaigns.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Typography variant="h6" className={styles.campaignName}>
              {campaign.name}
            </Typography>
          )}
          {canEdit && (
            <>
              <Tooltip title="Crear tacos">
                <IconButton aria-label="Crear tacos" onClick={() => setCreateBooksOpen(true)}>
                  <PlaylistAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Editar campaña">
                <IconButton aria-label="Editar campaña" onClick={() => setCampaignDialog("edit")}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Nueva campaña">
                <IconButton aria-label="Nueva campaña" onClick={() => setCampaignDialog("create")}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
        <Typography variant="caption" className={styles.muted}>
          {campaign.ticketsPerBook} papeletas por taco · {formatEuros(campaign.ticketPrice)} cada una
        </Typography>

        <LotterySummary totals={campaign.totals} />

        {canEdit && (
          <LotteryUnassignedBooks
            books={unassignedBooks}
            onAssign={(book) => setAssignTarget({ mode: "assign", book })}
            onDelete={setDeleteTarget}
          />
        )}

        {canEdit && (
          <>
            <TextField
              label="Buscar dorsal, alias o nombre"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth
              inputProps={{ inputMode: numericKeyboard ? "numeric" : "text", autoComplete: "off" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      onClick={() => setNumericKeyboard((value) => !value)}
                      aria-label={numericKeyboard ? "Teclado de letras" : "Teclado numérico"}
                    >
                      {numericKeyboard ? "ABC" : "123"}
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
            {!search.trim() && (
              <Stack direction="row" spacing={1} className={styles.filters}>
                {PLAYER_FILTER_ORDER.map((status) => (
                  <Chip
                    key={status}
                    label={`${FILTER_LABELS[status]} · ${counts[status]}`}
                    color={statusFilter === status ? "primary" : "default"}
                    variant={statusFilter === status ? "filled" : "outlined"}
                    onClick={() => setStatusFilter(status)}
                  />
                ))}
              </Stack>
            )}
          </>
        )}

        <Box className={styles.list}>
          {visiblePlayers.length === 0 && (
            <Typography variant="body2" className={styles.muted}>
              {canEdit ? "No hay jugadores en este filtro." : "No tienes tacos asignados en esta campaña."}
            </Typography>
          )}
          {visiblePlayers.map((player) => (
            <LotteryPlayerCard
              key={player.id}
              player={player}
              books={grouped.get(player.id) ?? []}
              canEdit={canEdit}
              onAssign={(p) => setAssignTarget({ mode: "assign", player: p })}
              onAdvance={handleAdvance}
              onEdit={(book) => setAssignTarget({ mode: "edit", book })}
              onUndo={setUndoTarget}
            />
          ))}
        </Box>

        <LotteryClubDeliveryCard campaign={campaign} onEditWindow={() => setCampaignDialog("edit")} />
      </Stack>
    );
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Lotería"
        subtitle="Reparto y recogida de los tacos de lotería"
        actionBar={
          <Button startIcon={<ArrowBackIcon />} onClick={() => goToTeamDashboard()} variant="outlined" size="small">
            Volver
          </Button>
        }
      >
        <Box className={styles.content}>{renderContent()}</Box>
      </ContentLayout>

      {campaign && (
        <>
          <AssignBookSheet
            open={assignTarget !== null}
            mode={assignTarget?.mode ?? "assign"}
            title={assignTitle}
            submitLabel={assignTarget?.mode === "edit" ? "Guardar" : "Asignar taco"}
            players={players}
            initial={assignInitial}
            ticketsPerBook={campaign.ticketsPerBook}
            processing={processing}
            onClose={() => setAssignTarget(null)}
            onSubmit={handleAssignSubmit}
          />
          <BookDateSheet
            open={dateStep !== null}
            title={
              dateStep?.kind === "club"
                ? `Entregar al club · Taco ${dateStep.book.bookNumber}`
                : `Entregar al jugador · Taco ${dateStep?.book.bookNumber ?? ""}`
            }
            subtitle={
              dateStep?.kind === "club" && dateStep.book.amountReturned !== null
                ? `${formatEuros(dateStep.book.amountReturned)} recogidos`
                : dateStepOwner
                  ? playerLabel(dateStepOwner)
                  : ""
            }
            dateLabel={dateStep?.kind === "club" ? "Fecha de entrega al club" : "Fecha de entrega"}
            submitLabel={dateStep?.kind === "club" ? "Entregar al club" : "Entregar al jugador"}
            processing={processing}
            onClose={() => setDateStep(null)}
            onSubmit={handleDateStepSubmit}
          />
          <ReturnBookSheet
            open={returnTarget !== null}
            book={returnTarget}
            playerName={returnPlayer ? playerLabel(returnPlayer) : ""}
            ticketPrice={campaign.ticketPrice}
            ticketsPerBook={returnTarget ? bookTicketCount(returnTarget) : campaign.ticketsPerBook}
            processing={processing}
            onClose={() => setReturnTarget(null)}
            onSubmit={handleReturnSubmit}
          />
          <ConfirmDialog
            open={undoTarget !== null}
            title="Deshacer paso"
            description={
              undoTarget && undoDetails
                ? `Se quitará ${undoDetails.removed} del taco ${undoTarget.bookNumber} y volverá a «${BOOK_STATUS_LABELS[undoDetails.previous]}».`
                : ""
            }
            confirmText="Deshacer"
            processing={processing}
            onCancel={() => setUndoTarget(null)}
            onConfirm={handleUndoConfirmed}
          />
          <ConfirmDialog
            open={deleteTarget !== null}
            title="Eliminar taco"
            description={deleteTarget ? `¿Eliminar el taco ${deleteTarget.bookNumber}? Solo se pueden eliminar tacos sin asignar.` : ""}
            confirmText="Eliminar"
            processing={processing}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDeleteConfirmed}
          />
          <CreateBooksDialog
            open={createBooksOpen}
            ticketsPerBook={campaign.ticketsPerBook}
            processing={processing}
            onClose={() => setCreateBooksOpen(false)}
            onSubmit={handleCreateBooks}
          />
        </>
      )}

      <LotteryCampaignDialog
        open={campaignDialog !== null}
        title={campaignDialog === "edit" ? "Editar campaña" : "Nueva campaña de lotería"}
        initial={campaignInitial}
        priceLocked={campaignDialog === "edit" && books.length > 0}
        processing={processing}
        onClose={() => setCampaignDialog(null)}
        onSubmit={handleCampaignSubmit}
      />
    </BaseLayout>
  );
}
