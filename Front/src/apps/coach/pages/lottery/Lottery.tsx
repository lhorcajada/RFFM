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
  createLotteryCampaign,
  deleteLotteryBook,
  deliverLotteryBook,
  getLotteryCampaign,
  getLotteryCampaigns,
  recordLotteryClubDelivery,
  returnLotteryBook,
  undoLotteryBookReturn,
  undoLotteryClubDelivery,
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
  apiErrorMessage,
  booksByPlayer,
  christmasCampaignDefaults,
  countByStatus,
  formatEuros,
  initialStatusFilter,
  playerLotteryStatus,
  searchPlayers,
  suggestNextBook,
  todayIso,
} from "./lotteryHelpers";
import type { LotteryStatus } from "./lotteryHelpers";
import LotterySummary from "./components/LotterySummary";
import LotteryPlayerCard from "./components/LotteryPlayerCard";
import type { LotteryCardPlayer } from "./components/LotteryPlayerCard";
import DeliverBookSheet from "./components/DeliverBookSheet";
import type { DeliverBookValues } from "./components/DeliverBookSheet";
import ReturnBookSheet from "./components/ReturnBookSheet";
import LotteryClubDeliveryCard from "./components/LotteryClubDeliveryCard";
import LotteryCampaignDialog from "./components/LotteryCampaignDialog";
import styles from "./Lottery.module.css";

const STATUS_LABELS: Record<LotteryStatus, string> = {
  none: "Sin taco",
  pending: "Por devolver",
  returned: "Devueltos",
};

type DeliverTarget =
  | { mode: "deliver"; player: LotteryCardPlayer }
  | { mode: "edit"; player: LotteryCardPlayer; book: LotteryBook };

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
  const [statusFilter, setStatusFilter] = useState<LotteryStatus>("none");
  const initialFilterFor = useRef<string | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<DeliverTarget | null>(null);
  const [returnTarget, setReturnTarget] = useState<LotteryBook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LotteryBook | null>(null);
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
  const canEdit = campaign?.canEdit ?? false;
  const grouped = useMemo(() => booksByPlayer(books), [books]);

  const players = useMemo<LotteryCardPlayer[]>(() => {
    const known = new Set(roster.map((p) => p.id));
    const orphans = [...grouped.keys()]
      .filter((id) => !known.has(id))
      .map((id) => ({ id, name: "Jugador", lastName: "fuera de la plantilla", alias: "", dorsal: null }));
    return [...roster, ...orphans];
  }, [roster, grouped]);

  const counts = useMemo(() => countByStatus(players, books), [players, books]);

  useEffect(() => {
    if (!campaign || roster.length === 0 || initialFilterFor.current === campaign.id) return;
    initialFilterFor.current = campaign.id;
    setStatusFilter(initialStatusFilter(counts));
  }, [campaign, roster.length, counts]);

  const visiblePlayers = useMemo(() => {
    if (!canEdit) return searchPlayers(players.filter((p) => grouped.has(p.id)), "");
    if (search.trim()) return searchPlayers(players, search);
    return searchPlayers(
      players.filter((p) => playerLotteryStatus(grouped.get(p.id) ?? []) === statusFilter),
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

  const deliverInitial = useMemo<DeliverBookValues>(() => {
    if (deliverTarget?.mode === "edit") {
      const { book } = deliverTarget;
      return { bookNumber: book.bookNumber, firstTicketNumber: book.firstTicketNumber, deliveredOn: book.deliveredOn };
    }
    return { ...suggestNextBook(books), deliveredOn: todayIso() };
  }, [deliverTarget, books]);

  const campaignInitial = useMemo<LotteryCampaignRequest>(() => {
    if (campaignDialog === "edit" && campaign) {
      const { name, drawDate, ticketPrice, ticketsPerBook, clubDeliveryFrom, clubDeliveryTo } = campaign;
      return { name, drawDate, ticketPrice, ticketsPerBook, clubDeliveryFrom, clubDeliveryTo };
    }
    return christmasCampaignDefaults();
  }, [campaignDialog, campaign]);

  const handleDeliverSubmit = async (values: DeliverBookValues) => {
    if (!teamId || !campaign || !deliverTarget) return;
    const { player } = deliverTarget;
    const ok =
      deliverTarget.mode === "deliver"
        ? await runAction(
            () => deliverLotteryBook(teamId, campaign.id, { teamPlayerId: player.id, ...values }),
            `Taco ${values.bookNumber} entregado a ${playerLabel(player)}`,
            "No se pudo entregar el taco.",
          )
        : await runAction(
            () => updateLotteryBook(teamId, campaign.id, deliverTarget.book.id, { teamPlayerId: player.id, ...values }),
            `Taco ${values.bookNumber} actualizado`,
            "No se pudo actualizar el taco.",
          );
    if (ok) {
      setDeliverTarget(null);
      setSearch("");
    }
  };

  const handleReturnSubmit = async (amount: number, returnedOn: string) => {
    if (!teamId || !campaign || !returnTarget) return;
    const ok = await runAction(
      () => returnLotteryBook(teamId, campaign.id, returnTarget.id, { amount, returnedOn }),
      `Taco ${returnTarget.bookNumber} devuelto · ${formatEuros(amount)}`,
      "No se pudo registrar la devolución.",
    );
    if (ok) {
      setReturnTarget(null);
      setSearch("");
    }
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

  const playerById = (id: string) => players.find((p) => p.id === id);
  const returnPlayer = returnTarget ? playerById(returnTarget.teamPlayerId) : undefined;
  const canCreate = !isPlayerRole;

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
                {(Object.keys(STATUS_LABELS) as LotteryStatus[]).map((status) => (
                  <Chip
                    key={status}
                    label={`${STATUS_LABELS[status]} · ${counts[status]}`}
                    color={statusFilter === status ? "primary" : "default"}
                    variant={statusFilter === status ? "filled" : "outlined"}
                    onClick={() => setStatusFilter(status)}
                  />
                ))}
              </Stack>
            )}
          </>
        )}

        <Stack spacing={1}>
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
              onDeliver={(p) => setDeliverTarget({ mode: "deliver", player: p })}
              onReturn={setReturnTarget}
              onEdit={(book) => setDeliverTarget({ mode: "edit", player, book })}
              onUndoReturn={(book) =>
                runAction(
                  () => undoLotteryBookReturn(teamId, campaign.id, book.id),
                  `Devolución del taco ${book.bookNumber} deshecha`,
                  "No se pudo deshacer la devolución.",
                )
              }
              onDelete={setDeleteTarget}
            />
          ))}
        </Stack>

        <LotteryClubDeliveryCard
          campaign={campaign}
          processing={processing}
          onEditWindow={() => setCampaignDialog("edit")}
          onRecord={(amount, deliveredOn) =>
            runAction(
              () => recordLotteryClubDelivery(teamId, campaign.id, { amount, deliveredOn }),
              `Entrega al club registrada · ${formatEuros(amount)}`,
              "No se pudo registrar la entrega al club.",
            )
          }
          onUndo={() =>
            runAction(
              () => undoLotteryClubDelivery(teamId, campaign.id),
              "Entrega al club deshecha",
              "No se pudo deshacer la entrega al club.",
            )
          }
        />
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
          <DeliverBookSheet
            open={deliverTarget !== null}
            title={deliverTarget?.mode === "edit" ? `Editar taco ${deliverTarget.book.bookNumber}` : "Entregar taco"}
            playerName={deliverTarget ? playerLabel(deliverTarget.player) : ""}
            submitLabel={deliverTarget?.mode === "edit" ? "Guardar" : "Entregar taco"}
            initial={deliverInitial}
            ticketsPerBook={campaign.ticketsPerBook}
            processing={processing}
            onClose={() => setDeliverTarget(null)}
            onSubmit={handleDeliverSubmit}
          />
          <ReturnBookSheet
            open={returnTarget !== null}
            book={returnTarget}
            playerName={returnPlayer ? playerLabel(returnPlayer) : ""}
            ticketPrice={campaign.ticketPrice}
            ticketsPerBook={campaign.ticketsPerBook}
            processing={processing}
            onClose={() => setReturnTarget(null)}
            onSubmit={handleReturnSubmit}
          />
          <ConfirmDialog
            open={deleteTarget !== null}
            title="Eliminar taco"
            description={deleteTarget ? `¿Eliminar el taco ${deleteTarget.bookNumber}? Podrás volver a entregarlo después.` : ""}
            confirmText="Eliminar"
            processing={processing}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleDeleteConfirmed}
          />
        </>
      )}

      <LotteryCampaignDialog
        open={campaignDialog !== null}
        title={campaignDialog === "edit" ? "Editar campaña" : "Nueva campaña de lotería"}
        initial={campaignInitial}
        bookSettingsLocked={campaignDialog === "edit" && books.length > 0}
        processing={processing}
        onClose={() => setCampaignDialog(null)}
        onSubmit={handleCampaignSubmit}
      />
    </BaseLayout>
  );
}
