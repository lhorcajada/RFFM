import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
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
    body: "Los boletos pagados forman la bolsa. Si una categoría queda sin acertantes, su premio pasa de bote a la jornada siguiente.",
  },
];

const PRIZES: { name: string; description: string }[] = [
  { name: "Categoría Especial", description: "Todos los 1X2 válidos y el Pleno exacto" },
  { name: "1ª categoría", description: "Todos los 1X2 válidos" },
  { name: "2ª categoría", description: "Todos menos un acierto" },
  { name: "3ª categoría", description: "Todos menos dos aciertos" },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function QuinielaRulesDialog({ open, onClose }: Props) {
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
              </li>
            ))}
          </ul>
          <p className={styles.prizesNote}>
            La bolsa de premios se reparte entre las categorías con pesos fijos; si una queda desierta, su importe pasa de bote.
          </p>
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
