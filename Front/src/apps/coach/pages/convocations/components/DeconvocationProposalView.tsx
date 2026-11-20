import { Fragment, useState } from "react";
import { Alert, Button, CircularProgress, Tab, Tabs } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RefreshIcon from "@mui/icons-material/Refresh";
import RuleIcon from "@mui/icons-material/Rule";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { PositionFit } from "../../../types/positionFit";
import type { TraitRating } from "../../../types/traitRating";
import type { RivalDifficulty } from "../utils/deconvocationFunnel";
import {
  DETAIL_RESULT_LABELS,
  type DeconvokeProposal,
  type DetailResult,
  type PlayerProposal,
  type ProposalDecision,
  type ProposalOrderEntry,
} from "../utils/deconvokeProposal";
import { formatShortfall, roleLabel } from "../utils/positionRequirements";
import type { SimulatedProposal } from "../utils/simulateUpcomingProposals";
import PlayerFitDialog from "./PlayerFitDialog";
import styles from "./DeconvocationProposalView.module.css";

type Props = {
  proposal: DeconvokeProposal;
  /** Estimated proposals for the next league matches; the tabs are hidden when empty or omitted. */
  upcoming?: SimulatedProposal[];
  loading: boolean;
  refreshing: boolean;
  applying: boolean;
  onBack: () => void;
  onApply: () => void;
  /** Reloads the team rules and regenerates the proposal; the button is hidden when omitted. */
  onRefresh?: () => void;
  /** Opens the rules dialog; the button is hidden when omitted. */
  onOpenRules?: () => void;
  /** Fit orders and trait ratings; without them the players' fit cannot be explained. */
  fitContext?: FitContext;
};

export type FitContext = {
  positionFit: PositionFit[];
  traitRatings: TraitRating[];
};

const CRITERION_LABELS: Record<NonNullable<ProposalDecision["criterion"]>, string> = {
  schedule: "partidos difíciles próximos",
  fit: "encaje por rasgos",
  consecutive: "jornadas seguidas",
  surplus: "excedente de convocatorias",
  technicalTotal: "desconvocatorias técnicas",
  attendance: "asistencia",
  rating: "nivel ante rival difícil",
  mandatory: "regla obligatoria",
};

const DIFFICULTY_LABELS: Record<RivalDifficulty, string> = {
  easy: "Rival fácil",
  medium: "Rival medio",
  hard: "Rival difícil",
};

function scheduleText(
  { upcoming, keepStrong, maxStrong }: DeconvokeProposal["schedule"],
  current: RivalDifficulty,
): string {
  const window = [current, ...upcoming];
  const hardCount = window.filter((d) => d === "hard").length;
  const scope = `De los ${window.length} partidos (el actual y los ${upcoming.length} siguientes)`;
  const outlook =
    upcoming.length === 0
      ? "No hay previsión de los próximos partidos."
      : hardCount > 0
        ? `${scope}, ${hardCount === 1 ? "1 es difícil" : `${hardCount} son difíciles`}${keepStrong ? ": se evita desconvocar a los jugadores importantes para tenerlos en ese partido" : ""}.`
        : `${scope}, ninguno es difícil.`;
  const strongCap = maxStrong === 0 ? "No se desconvoca a jugadores importantes" : `Como mucho ${maxStrong} importante(s)`;
  return `${outlook} ${strongCap}, no se quita a dos jugadores de la misma línea si hay alternativa y, si sale un delantero, quedan al menos dos que puedan jugar de delantero.`;
}

const RESULT_TONE: Record<DetailResult, string> = {
  protects: styles.toneProtect,
  doesNotProtect: styles.toneMuted,
  allows: styles.toneOk,
  decides: styles.toneDecides,
  tie: styles.toneMuted,
  noEffect: styles.toneMuted,
  mandatory: styles.toneForced,
};

const PROTECTED_GROUPS: Array<{ title: string; kinds: Array<NonNullable<ProposalDecision["protection"]>> }> = [
  { title: "Descansaron o desconvocados hace poco", kinds: ["technicalWindow", "injuryRest", "otherCause"] },
  { title: "Pocos minutos en el último partido", kinds: ["lowMinutes"] },
  { title: "Mínimo de convocatorias", kinds: ["minCalls"] },
  { title: "Mínimo por posición", kinds: ["position", "goalkeeper"] },
];

const OTHER_PROTECTED = { title: "Otros protegidos", kinds: [] as Array<NonNullable<ProposalDecision["protection"]>> };

/** Group of a protected player; one whose reason has no group is never dropped, it goes to the last one. */
function groupOf(item: PlayerProposal): string {
  const kind = item.decision.protection;
  return PROTECTED_GROUPS.find((g) => kind && g.kinds.includes(kind))?.title ?? OTHER_PROTECTED.title;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function FitButton({ item, onShowFit }: { item: PlayerProposal; onShowFit?: (item: PlayerProposal) => void }) {
  if (!onShowFit || !item.fit) return null;
  return (
    <button
      type="button"
      className={styles.fitButton}
      aria-label={`Ver encaje de ${item.displayName}`}
      onClick={() => onShowFit(item)}
    >
      Ver encaje
    </button>
  );
}

function ProposedCard({ item, onShowFit }: { item: PlayerProposal; onShowFit?: (item: PlayerProposal) => void }) {
  const { decision } = item;
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.name}>
          <strong>{item.displayName}</strong>
          <span className={styles.chip} title={item.position ?? undefined}>
            {roleLabel(item.positionRole ?? null)}
          </span>
          {item.forced && <span className={styles.forcedBadge}>Obligatorio</span>}
        </div>
        {decision.criterion && (
          <span className={styles.criterionBadge}>Elegido por: {CRITERION_LABELS[decision.criterion]}</span>
        )}
      </div>
      <p className={styles.reason}>{decision.reason}</p>
      {decision.compare && <p className={styles.compare}>{decision.compare}</p>}
      <FitButton item={item} onShowFit={onShowFit} />
      <div className={styles.chips}>
        <span className={styles.chip}>{item.calledCount} conv.</span>
        {item.startsDataAvailable && <span className={styles.chip}>{item.startsCount} tit.</span>}
        <span className={styles.chip}>Mín. conv: {item.minRequiredCalls}</span>
        {item.weeklyTraining.totalTrainings > 0 && (
          <span className={styles.chip}>
            {item.weeklyTraining.attendedTrainings}/{item.weeklyTraining.totalTrainings} entrenos
          </span>
        )}
      </div>
      {item.detail.length > 0 && (
        <details className={styles.details}>
          <summary className={styles.detailsSummary}>Ver detalle de reglas</summary>
          <ul className={styles.detailList}>
            {item.detail.map((row) => (
              <li key={row.rule} className={styles.detailRow}>
                <span className={styles.detailRule}>{row.rule}</span>
                <span className={styles.detailValue}>{row.value}</span>
                <span className={`${styles.detailResult} ${RESULT_TONE[row.result]}`}>{DETAIL_RESULT_LABELS[row.result]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

const ORDER_OUTCOME_LABELS: Partial<Record<ProposalOrderEntry["outcome"], string>> = {
  proposed: "Se desconvoca",
  positionSkip: "Se salta: mínimo de su posición",
  balanceSkip: "Se salta: reparto entre líneas",
};

function OrderList({ order }: { order: ProposalOrderEntry[] }) {
  const lastProposed = order.reduce((last, entry, index) => (entry.outcome === "proposed" ? index : last), -1);
  return (
    <section className={styles.orderSection} aria-label="Orden en que se desconvoca">
      <h4 className={styles.sectionLabel}>Orden de desconvocatoria</h4>
      <p className={styles.orderIntro}>
        De arriba abajo, el primero es el primero en salir. Cada jugador explica por qué va antes que el siguiente.
      </p>
      <ol className={styles.orderList} aria-label="Orden de desconvocatoria">
        {order.map((entry, index) => (
          <Fragment key={entry.playerId}>
            <li
              className={`${styles.orderItem} ${entry.outcome === "proposed" ? styles.orderItemOut : ""} ${
                entry.outcome === "stays" ? styles.orderItemStays : ""
              }`}
            >
              <span className={styles.orderRank}>{entry.rank}</span>
              <div className={styles.orderBody}>
                <div className={styles.name}>
                  <strong>{entry.name}</strong>
                  <span className={styles.position}>{entry.position}</span>
                  {ORDER_OUTCOME_LABELS[entry.outcome] && (
                    <span className={entry.outcome === "proposed" ? styles.orderBadgeOut : styles.orderBadgeSkip}>
                      {ORDER_OUTCOME_LABELS[entry.outcome]}
                    </span>
                  )}
                </div>
                <div className={styles.chips}>
                  {entry.chips.map((chip) => (
                    <span key={chip} className={styles.chip}>
                      {chip}
                    </span>
                  ))}
                </div>
                {entry.versusNext && <p className={styles.orderVersus}>{entry.versusNext.text}</p>}
              </div>
            </li>
            {index === lastProposed && index < order.length - 1 && (
              <li role="separator" aria-label="Línea de corte" className={styles.cutLine}>
                Línea de corte: se quedan los de abajo
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

function ReasonCard({ item, onShowFit }: { item: PlayerProposal; onShowFit?: (item: PlayerProposal) => void }) {
  return (
    <article className={styles.reasonCard}>
      <div className={styles.reasonCardName}>
        <strong>{item.displayName}</strong>
        <span className={styles.position} title={item.position ?? undefined}>
          {roleLabel(item.positionRole ?? null)}
        </span>
      </div>
      <p className={styles.reasonText}>{item.decision.reason}</p>
      <FitButton item={item} onShowFit={onShowFit} />
    </article>
  );
}

function matchDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(parsed);
}

export default function DeconvocationProposalView({
  proposal: currentProposal,
  upcoming = [],
  loading,
  refreshing,
  applying,
  onBack,
  onApply,
  onRefresh,
  onOpenRules,
  fitContext,
}: Props) {
  const [fitTarget, setFitTarget] = useState<PlayerProposal | null>(null);
  const [tab, setTab] = useState(0);
  const activeTab = tab <= upcoming.length ? tab : 0;
  const estimate = activeTab > 0 ? upcoming[activeTab - 1] : null;
  const proposal = estimate?.proposal ?? currentProposal;
  const onShowFit = fitContext ? setFitTarget : undefined;
  const fitPosition = fitTarget?.fit ? fitContext?.positionFit.find((p) => p.position === fitTarget.fit?.position) : undefined;
  const fitLevels = fitContext?.traitRatings.find((r) => r.teamPlayerId === fitTarget?.playerId)?.levels ?? [];

  const proposed = proposal.players.filter((p) => p.decision.group === "proposed");
  const protectedPlayers = proposal.players.filter((p) => p.decision.group === "protected");
  const notChosen = proposal.players.filter((p) => p.decision.group === "notChosen");
  const byPosition = protectedPlayers.filter(
    (p) => p.decision.protection === "position" || p.decision.protection === "goalkeeper",
  );
  const byRules = protectedPlayers.length - byPosition.length;
  const eligibleCount = proposed.filter((p) => !p.forced).length + notChosen.length;
  const hard = proposal.rivalDifficulty === "hard";

  const steps = [
    {
      title: "Protegidos",
      text: `${plural(byRules, "jugador queda", "jugadores quedan")} fuera de la propuesta por descansar, haber sido desconvocados hace poco o no llegar a su mínimo de convocatorias.`,
    },
    {
      title: "Mínimos por posición",
      text: `${plural(byPosition.length, "jugador se queda", "jugadores se quedan")} para mantener el mínimo de su posición.`,
    },
    {
      title: "Justicia",
      text: `Entre los ${eligibleCount} elegibles se ordena por jornadas seguidas, excedente de convocatorias y encaje por rasgos (la nota de sus valoraciones en su puesto), y después por desconvocatorias técnicas y asistencia.`,
    },
    {
      title: "Dificultad del rival",
      text: hard
        ? "Contra un rival difícil salen primero los de menor nivel, salvo los protegidos; la justicia solo desempata."
        : "El nivel de los jugadores no influye en el orden.",
    },
    {
      title: "Reparto y próximos partidos",
      text: scheduleText(proposal.schedule, proposal.rivalDifficulty),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h3 className={styles.title}>Propuesta automática de desconvocatoria</h3>
          <p className={styles.subtitle}>
            Objetivo: {proposal.targetCount} desconvocado(s) | Plantilla: {proposal.calledCount} jugadores
            {proposal.alreadyDeconvoked.length > 0 && ` | Ya desconvocados: ${proposal.alreadyDeconvoked.length}`}
          </p>
          {proposal.previousRivalResult && (
            <p className={styles.subtitle}>
              Rival: {proposal.previousRivalResult.rival} | Resultado previo: {proposal.previousRivalResult.scoreText} (
              {proposal.previousRivalResult.result})
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <Button variant="text" size="small" startIcon={<ArrowBackIcon />} onClick={onBack}>
            Volver
          </Button>
          {onRefresh && (
            <Button
              variant="outlined"
              size="small"
              startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
              disabled={refreshing}
              onClick={onRefresh}
            >
              Actualizar
            </Button>
          )}
          {onOpenRules && (
            <Button variant="outlined" size="small" startIcon={<RuleIcon />} onClick={onOpenRules}>
              Reglas
            </Button>
          )}
          {!estimate && (
          <Button
            variant="contained"
            size="small"
            startIcon={applying ? <CircularProgress size={14} color="inherit" /> : <AutoFixHighIcon />}
            disabled={applying || proposed.length === 0}
            onClick={onApply}
          >
            Aplicar propuesta
          </Button>
          )}
        </div>
      </div>

      {upcoming.length > 0 && (
        <Tabs
          value={activeTab}
          onChange={(_, value: number) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Propuesta por partido"
          className={styles.tabs}
        >
          <Tab label="Actual" />
          {upcoming.map(({ match }) => (
            <Tab key={match.eventId} label={`${match.label} · ${match.rival}`} />
          ))}
        </Tabs>
      )}

      {estimate && (
        <Alert severity="info" className={styles.warning}>
          Estimación para la {estimate.match.label} contra {estimate.match.rival} ({matchDay(estimate.match.date)}): se da por
          aplicada la propuesta de cada partido anterior, se supone que todos entrenan y los lesionados siguen fuera hasta su
          regreso. Es solo una previsión y no se puede aplicar.
        </Alert>
      )}

      {(proposal.positionWarnings ?? []).length > 0 && (
        <Alert severity="warning" className={styles.warning}>
          <strong>Mínimos de posición sin cubrir</strong>
          <ul className={styles.warningList}>
            {proposal.positionWarnings.map((warning) => (
              <li key={warning.requirement}>{formatShortfall(warning)}</li>
            ))}
          </ul>
        </Alert>
      )}

      {loading ? (
        <div className={styles.center}>
          <CircularProgress size={28} />
        </div>
      ) : proposal.players.length === 0 && proposal.alreadyDeconvoked.length === 0 ? (
        <EmptyState description="No hay convocados para evaluar." />
      ) : (
        <>
          <section className={styles.funnel} aria-label="Cómo se ha decidido">
            <div className={styles.funnelTop}>
              <h4 className={styles.sectionLabel}>Cómo se ha decidido</h4>
              <span className={`${styles.difficulty} ${hard ? styles.difficultyHard : ""}`}>
                {DIFFICULTY_LABELS[proposal.rivalDifficulty]}
              </span>
            </div>
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <span className={styles.stepTitle}>{step.title}</span>
                    <p className={styles.stepText}>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {proposal.order.length > 0 && <OrderList order={proposal.order} />}

          {proposal.players.length > 0 && proposed.length === 0 && (
            <p className={styles.notice}>No hace falta desconvocar jugadores con las reglas actuales.</p>
          )}
          {proposed.length > 0 && (
            <>
              <h4 className={styles.sectionLabel}>Propuestos para desconvocar</h4>
              <div className={styles.grid}>
                {proposed.map((item) => (
                  <ProposedCard key={item.playerId} item={item} onShowFit={onShowFit} />
                ))}
              </div>
            </>
          )}

          {proposal.alreadyDeconvoked.length > 0 && (
            <div role="group" aria-label="Jugadores ya desconvocados" className={styles.alreadyGroup}>
              <h4 className={`${styles.sectionLabel} ${styles.sectionLabelDim}`}>Ya desconvocados</h4>
              <div className={styles.grid}>
                {proposal.alreadyDeconvoked.map((item) => (
                  <article key={item.playerId} className={`${styles.reasonCard} ${styles.alreadyCard}`}>
                    <div className={styles.reasonCardName}>
                      <strong>{item.displayName}</strong>
                      <span className={styles.position} title={item.position ?? undefined}>
                        {roleLabel(item.positionRole)}
                      </span>
                      <span className={styles.alreadyBadge}>Ya desconvocado</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {protectedPlayers.length > 0 && (
            <>
              <h4 className={`${styles.sectionLabel} ${styles.sectionLabelProtected}`}>
                Protegidos · no se desconvocan
              </h4>
              <div className={styles.groups}>
                {[...PROTECTED_GROUPS, OTHER_PROTECTED].map((group) => {
                  const members = protectedPlayers.filter((p) => groupOf(p) === group.title);
                  if (members.length === 0) return null;
                  return (
                    <div key={group.title} role="group" aria-label={group.title} className={styles.group}>
                      <h5 className={styles.groupTitle}>{group.title}</h5>
                      {members.map((item) => (
                        <ReasonCard key={item.playerId} item={item} onShowFit={onShowFit} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {notChosen.length > 0 && (
            <div role="group" aria-label="Elegibles no elegidos" className={styles.notChosen}>
              <h4 className={`${styles.sectionLabel} ${styles.sectionLabelDim}`}>Elegibles no elegidos</h4>
              <div className={styles.grid}>
                {notChosen.map((item) => (
                  <ReasonCard key={item.playerId} item={item} onShowFit={onShowFit} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {fitTarget && (
        <PlayerFitDialog
          open
          onClose={() => setFitTarget(null)}
          playerId={fitTarget.playerId}
          playerName={fitTarget.displayName}
          fit={fitTarget.fit}
          positionFit={fitPosition}
          levels={fitLevels}
        />
      )}
    </div>
  );
}
