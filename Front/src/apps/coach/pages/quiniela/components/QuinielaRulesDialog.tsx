import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatMoney, prizeCategoryFunds, prizeCategoryShare } from "../quinielaHelpers";
import type { PrizeCategoryKey } from "../quinielaHelpers";
import styles from "./QuinielaRulesDialog.module.css";

const RULES: { title: string; body: string }[] = [
  {
    title: "Qué se pronostica",
    body: "En cada partido de liga de la jornada eliges 1 (gana el local), X (empate) o 2 (gana el visitante).",
  },
  {
    title: "El Pleno",
    body: "En el último partido pronosticas los goles de cada equipo: 0, 1, 2 o M (tres o más), como el Pleno al 15 oficial.",
  },
  {
    title: "Precio y participantes",
    body: "Un boleto por persona y jornada, a 1 €. Pueden jugar jugadores, familiares y entrenador.",
  },
  {
    title: "Plazo para rellenar",
    body: "Puedes modificar tu boleto hasta que empiece el primer partido de la jornada.",
  },
  {
    title: "Pago antes del viernes",
    body: "Puedes guardar el boleto como pendiente de pago, pero debes pagar antes del viernes a las 23:59. Un boleto sin pagar no participa.",
  },
  {
    title: "Aplazados y suspendidos",
    body: "Un partido aplazado o suspendido no cuenta: ni se pronostica ni suma o resta aciertos, aunque se juegue otro día.",
  },
  {
    title: "Bolsa y bote",
    body: "Los boletos pagados forman la bolsa de premios, junto al bote que llegue de la jornada anterior.",
  },
];

const PRIZES: { key: PrizeCategoryKey; name: string; description: string }[] = [
  { key: "Special", name: "Categoría Especial", description: "Todos los 1X2 válidos y el Pleno exacto" },
  { key: "First", name: "1ª categoría", description: "Todos los 1X2 válidos" },
  { key: "Second", name: "2ª categoría", description: "Todos menos un acierto" },
  { key: "Third", name: "3ª categoría", description: "Todos menos dos aciertos" },
];

const SHARE_FORMAT = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const SPLIT_RULES: string[] = [
  "Una parte de lo recaudado forma la bolsa de premios; el resto de lo recaudado va a la hucha del equipo.",
  "El importe de cada categoría se reparte a partes iguales entre los acertantes de su categoría, truncado al céntimo.",
  "Si la 2ª categoría queda desierta, su importe pasa a la 3ª; si no hay acertantes en las demás, pasa de bote a la jornada siguiente.",
  "Una categoría inferior nunca cobra más por persona que una superior: si ocurriera, se juntan los premios de ambas y se reparten entre todos sus acertantes.",
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Bolsa de premios de la jornada; con ella se muestra lo que corresponde hoy a cada categoría. */
  prizePool?: number;
};

export default function QuinielaRulesDialog({ open, onClose, prizePool }: Props) {
  const funds = prizePool === undefined ? null : prizeCategoryFunds(prizePool);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper" aria-labelledby="quiniela-rules-title">
      <DialogTitle id="quiniela-rules-title" className={styles.title}>
        <span className={styles.heading}>
          <span>Reglas de la quiniela</span>
          <span className={styles.subtitle}>
            Las mismas que La Quiniela oficial, aplicadas a los partidos de liga de tu grupo.
          </span>
        </span>
        <IconButton aria-label="Cerrar reglas" onClick={onClose} className={styles.close}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <ol className={styles.rules}>
          {RULES.map((rule, index) => (
            <li key={rule.title} className={styles.rule} data-testid="quiniela-rule">
              <span className={styles.ruleNumber}>{index + 1}</span>
              <span className={styles.ruleText}>
                <span className={styles.ruleTitle}>{rule.title}</span>
                <span className={styles.ruleBody}>{rule.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <section className={styles.prizes}>
          <h3 className={styles.prizesTitle}>Categorías de premio</h3>
          <ul className={styles.prizeList}>
            {PRIZES.map((prize) => (
              <li key={prize.name} className={styles.prize}>
                <span className={styles.prizeName}>{prize.name}</span>
                <span className={styles.prizeDescription}>{prize.description}</span>
                <span className={styles.prizeShare}>
                  {SHARE_FORMAT.format(prizeCategoryShare(prize.key))} % de la bolsa
                  {funds && <strong className={styles.prizeAmount}>{formatMoney(funds[prize.key])}</strong>}
                </span>
              </li>
            ))}
          </ul>
          <ul className={styles.splitRules}>
            {SPLIT_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      </DialogContent>
      <div className={styles.footer}>
        <button type="button" className={styles.confirm} onClick={onClose}>
          Entendido
        </button>
      </div>
    </Dialog>
  );
}
