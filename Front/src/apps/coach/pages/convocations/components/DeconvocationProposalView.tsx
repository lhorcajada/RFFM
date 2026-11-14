import { Alert, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RefreshIcon from "@mui/icons-material/Refresh";
import RuleIcon from "@mui/icons-material/Rule";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { RivalDifficulty } from "../utils/deconvocationFunnel";
import {
  DETAIL_RESULT_LABELS,
  type DeconvokeProposal,
  type DetailResult,
  type PlayerProposal,
  type ProposalDecision,
} from "../utils/deconvokeProposal";
import { formatShortfall, roleLabel } from "../utils/positionRequirements";
import styles from "./DeconvocationProposalView.module.css";

type Props = {
  proposal: DeconvokeProposal;
  loading: boolean;
  refreshing: boolean;
  applying: boolean;
  onBack: () => void;
  onApply: () => void;
  /** Reloads the team rules and regenerates the proposal; the button is hidden when omitted. */
  onRefresh?: () => void;
  /** Opens the rules dialog; the button is hidden when omitted. */
  onOpenRules?: () => void;
};

const CRITERION_LABELS: Record<NonNullable<ProposalDecision["criterion"]>, string> = {
  fit: "encaje en el puesto",
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

function ProposedCard({ item }: { item: PlayerProposal }) {
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
          {item.comparison.length > 0 && (
            <div role="group" aria-label="Frente a los demás elegibles" className={styles.comparison}>
              <h5 className={styles.comparisonTitle}>Frente a los demás elegibles</h5>
              {item.comparison.map((row) => (
                <div key={row.playerId} className={styles.comparisonRow}>
                  <span className={styles.comparisonName}>
                    <strong>{row.name}</strong>
                    <span className={styles.position}>{row.position}</span>
                  </span>
                  <span className={`${styles.comparisonVerdict} ${row.outcome === "decides" ? styles.toneDecides : styles.toneMuted}`}>
                    {row.verdict}
                  </span>
                </div>
              ))}
            </div>
          )}
        </details>
      )}
    </article>
  );
}

function ReasonCard({ item }: { item: PlayerProposal }) {
  return (
    <article className={styles.reasonCard}>
      <div className={styles.reasonCardName}>
        <strong>{item.displayName}</strong>
        <span className={styles.position} title={item.position ?? undefined}>
          {roleLabel(item.positionRole ?? null)}
        </span>
      </div>
      <p className={styles.reasonText}>{item.decision.reason}</p>
    </article>
  );
}

export default function DeconvocationProposalView({
  proposal,
  loading,
  refreshing,
  applying,
  onBack,
  onApply,
  onRefresh,
  onOpenRules,
}: Props) {
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
      text: `Entre los ${eligibleCount} elegibles se ordena primero por el encaje en su puesto (cuando hay orden de encaje) y después por jornadas seguidas convocado sin descansar, excedente de convocatorias, desconvocatorias técnicas y asistencia.`,
    },
    {
      title: "Dificultad del rival",
      text: hard
        ? "En caso de empate salen primero los de menor nivel."
        : "El nivel de los jugadores no influye en el orden.",
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
          <Button
            variant="contained"
            size="small"
            startIcon={applying ? <CircularProgress size={14} color="inherit" /> : <AutoFixHighIcon />}
            disabled={applying || proposed.length === 0}
            onClick={onApply}
          >
            Aplicar propuesta
          </Button>
        </div>
      </div>

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

          {proposal.players.length > 0 && proposed.length === 0 && (
            <p className={styles.notice}>No hace falta desconvocar jugadores con las reglas actuales.</p>
          )}
          {proposed.length > 0 && (
            <>
              <h4 className={styles.sectionLabel}>Propuestos para desconvocar</h4>
              <div className={styles.grid}>
                {proposed.map((item) => (
                  <ProposedCard key={item.playerId} item={item} />
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
                        <ReasonCard key={item.playerId} item={item} />
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
                  <ReasonCard key={item.playerId} item={item} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
