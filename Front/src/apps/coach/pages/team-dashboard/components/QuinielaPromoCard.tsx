import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../../constants/featureRoutes";
import { getCurrentQuiniela } from "../../../services/quinielaService";
import type { QuinielaCurrent } from "../../../services/quinielaService";
import { formatKickoff, formatMoney } from "../../quiniela/quinielaHelpers";
import QuinielaRulesDialog from "../../quiniela/components/QuinielaRulesDialog";
import { currentUserId, isQuinielaNovelty } from "../utils/quinielaNovelty";
import styles from "./QuinielaPromoCard.module.css";

type CardState = "open" | "pending" | "paid" | "expired" | "closed";

type StateView = { lead: string; status: string; cta: string; tone: string };

const STATE_VIEWS: Record<CardState, StateView> = {
  open: {
    lead: "Pronostica los partidos de liga con tu equipo y juega por la bolsa.",
    status: "Aún no has rellenado tu boleto",
    cta: "Rellenar mi boleto",
    tone: styles.toneInfo,
  },
  pending: {
    lead: "Tu boleto está guardado. Falta el pago de 1 € para que participe.",
    status: "Pendiente de pago · hasta el viernes 23:59",
    cta: "Ver mi boleto",
    tone: styles.toneWarn,
  },
  paid: {
    lead: "Estás dentro. Suerte con los pronósticos de la jornada.",
    status: "Boleto pagado · participas",
    cta: "Ver mi boleto",
    tone: styles.toneOk,
  },
  expired: {
    lead: "El plazo de pago de tu boleto ha terminado.",
    status: "Boleto expirado · no participa",
    cta: "Ver mi boleto",
    tone: styles.toneMute,
  },
  closed: {
    lead: "Ya han empezado los partidos. Sigue cómo va tu boleto.",
    status: "Pronósticos cerrados",
    cta: "Ver resultados",
    tone: styles.toneMute,
  },
};

function stateOf(current: QuinielaCurrent): CardState {
  if (current.jornada?.picksClosed) return "closed";
  const ticket = current.myTicket;
  if (!ticket) return "open";
  if (ticket.paymentStatus === "Paid") return "paid";
  if (ticket.paymentStatus === "Expired") return "expired";
  return "pending";
}

export default function QuinielaPromoCard({ teamId }: { teamId: string | null }) {
  const { loading: permissionsLoading, hasFeatureAccess } = usePermissions();
  const [current, setCurrent] = useState<QuinielaCurrent | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const allowed = !permissionsLoading && hasFeatureAccess(COACH_FEATURE_ROUTES.Quiniela);

  useEffect(() => {
    if (!allowed || !teamId) return;
    let cancelled = false;
    getCurrentQuiniela(teamId)
      .then((data) => {
        if (!cancelled) setCurrent(data);
      })
      .catch(() => {
        if (!cancelled) setCurrent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, teamId]);

  if (!allowed || !teamId || !current) return null;

  const href = `${COACH_FEATURE_ROUTES.Quiniela}?teamId=${encodeURIComponent(teamId)}`;

  if (!current.isOpen || !current.jornada) {
    if (!current.canManage) return null;
    return (
      <Link to={href} className={styles.discreet}>
        Abrir quiniela
      </Link>
    );
  }

  const state = stateOf(current);
  const view = STATE_VIEWS[state];
  const closed = state === "closed";
  const showNovelty = isQuinielaNovelty(currentUserId(), teamId);

  return (
    <section aria-label="Quiniela de la jornada" className={styles.card}>
      <span className={styles.glow} aria-hidden="true" />
      <div className={styles.topRow}>
        {showNovelty ? (
          <span className={styles.noveltyBadge}>
            <AutoAwesomeIcon fontSize="inherit" aria-hidden="true" />
            Novedad
          </span>
        ) : (
          <span className={styles.kicker}>Quiniela</span>
        )}
        <span className={styles.round}>Jornada {current.jornada.roundNumber}</span>
      </div>

      <div className={styles.headline}>
        <h2 className={styles.title}>Quiniela del equipo</h2>
        <span className={styles.lead}>{view.lead}</span>
      </div>

      <div className={styles.facts}>
        <div className={styles.fact}>
          <span className={styles.factLabel}>Bolsa</span>
          <span className={styles.pot}>{formatMoney(current.pool?.prizePool ?? 0)}</span>
        </div>
        <div className={styles.fact}>
          <span className={styles.factLabel}>{closed ? "Jornada" : "Cierra"}</span>
          <span className={styles.factValue}>{closed ? "En juego" : formatKickoff(current.jornada.firstKickoffUtc)}</span>
        </div>
      </div>

      <div className={`${styles.status} ${view.tone}`}>{view.status}</div>

      <Link to={href} className={styles.cta}>
        {view.cta}
        <ArrowForwardIcon fontSize="small" aria-hidden="true" />
      </Link>
      <button type="button" className={styles.rules} onClick={() => setRulesOpen(true)}>
        Ver reglas · 1 € por boleto
      </button>
      <QuinielaRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </section>
  );
}
