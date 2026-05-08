import { forwardRef, useImperativeHandle, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { ExcuseType } from "../../../services/excuseTypeService";
import type { ClubKit } from "../../../services/kitService";
import type { MatchState } from "./convocationMatchDetail.types";
import type { DeconvokeProposal } from "../utils/deconvokeProposal";
import styles from "./ConvocatoriaPrint.module.css";

// How many cromos fit in one row inside the 794px container
// Container: 794 - 48px padding = 746px. Card: 746 - 48px padding = 698px usable.
// 5 × 110px + 4 × 10px gap = 590px ✓  (6 × 110 + 5 × 10 = 710 > 698 → overflows)
const CROMOS_PER_ROW = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Handle ────────────────────────────────────────────────────────────────────

export type ConvocatoriaPrintHandle = {
  print: () => Promise<void>;
  printProposal: () => Promise<void>;
  /** Generates a WhatsApp-ready text and copies it to the clipboard.
   *  Returns true on success, false if clipboard access was denied. */
  copyForWhatsApp: () => Promise<boolean>;
};

// ─── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  match: MatchState | null;
  calledIds: string[];
  notCalledIds: string[];
  proposal: DeconvokeProposal;
  players: PlayerResponse[];
  photos: Record<string, string | null>;
  excuseMap: Record<string, number | null>;
  excuseTypes: ExcuseType[];
  kits: ClubKit[];
  selectedKitNumber: number | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDateES(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAYS_ES[d.getDay()]}, ${day} de ${MONTHS_ES[d.getMonth()]} de ${year}`;
}

function arrivalTime(time: string): string {
  if (!time || !time.includes(":")) return "";
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10) - 1;
  const m = parseInt(mStr, 10);
  if (h < 0) h = 23;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function positionOrder(pos: string | null | undefined): number {
  const p = (pos ?? "").toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (
    p.includes("defensa") || p.includes("central") ||
    p.includes("lateral") || p.includes("libero") || p.includes("stopper")
  ) return 1;
  if (
    p.includes("centrocampista") || p.includes("medio") ||
    p.includes("pivote") || p.includes("interior") || p.includes("volante")
  ) return 2;
  if (
    p.includes("delantero") || p.includes("extremo") ||
    p.includes("punta") || p.includes("ariete") || p.includes("winger")
  ) return 3;
  return 4;
}

const POSITION_LABELS: Record<number, string> = {
  0: "Porteros",
  1: "Defensas",
  2: "Medios",
  3: "Delanteros",
  4: "Sin posición",
};

const EXCUSE_LABELS_ES: Record<string, string> = {
  Injury: "Lesión",
  Study: "Estudios",
  Ill: "Enfermedad",
  "Family Problem": "Problema familiar",
  "Family Event": "Evento familiar",
  "Birthday Event": "Cumpleaños",
};

function localizeExcuse(name: string): string {
  return EXCUSE_LABELS_ES[name] ?? name;
}

function getExcuseLabel(
  excuseId: number | null | undefined,
  excuseTypes: ExcuseType[],
): string {
  if (excuseId == null) return "Decisión técnica";
  const et = excuseTypes.find((e) => e.id === excuseId);
  return et ? localizeExcuse(et.name) : "Causa desconocida";
}

function playerDisplayName(p: PlayerResponse): string {
  // Alias (apodo) takes priority
  if (p.alias?.trim()) return p.alias.trim();
  return ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
}

// ─── Sub-renders (inline styles for html2canvas compatibility) ─────────────────

function InfoRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "10px",
        marginBottom: "6px",
      }}
    >
      <span style={{ fontSize: "15px", width: "22px", flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.45)",
          minWidth: "130px",
          flexShrink: 0,
        }}
      >
        {label}:
      </span>
      <span
        style={{
          fontSize: "14px",
          fontWeight: highlight ? 800 : 600,
          color: highlight ? "#ff9800" : "#e8e8e8",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ title, color = "#e8e8e8" }: { title: string; color?: string }) {
  return (
    <div
      style={{
        fontSize: "13px",
        fontWeight: 800,
        textTransform: "uppercase" as const,
        letterSpacing: "0.12em",
        color,
        paddingBottom: "8px",
        borderBottom: `1px solid ${color}44`,
        marginBottom: "4px",
      }}
    >
      {title}
    </div>
  );
}

function ReportStatCard({
  label,
  value,
  accent = "#ff9800",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: "150px",
        borderRadius: "14px",
        border: `1px solid ${accent}33`,
        background: "rgba(255,255,255,0.04)",
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 900, color: accent, marginTop: "6px", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function ReportTable({
  title,
  subtitle,
  columns,
  rows,
  accent = "#ff9800",
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  accent?: string;
}) {
  return (
    <div style={{ marginTop: "18px" }}>
      <SectionTitle title={title} color={accent} />
      {subtitle && (
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "6px" }}>
          {subtitle}
        </div>
      )}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "12px",
          fontSize: "11px",
        }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                style={{
                  textAlign: "left",
                  padding: "10px 10px",
                  color: accent,
                  borderBottom: `1px solid ${accent}55`,
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              {row.map((cell, ci) => (
                <td
                  key={`${ri}-${ci}`}
                  style={{
                    padding: "10px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    color: ci === 0 ? "#f5f5f5" : "rgba(255,255,255,0.82)",
                    verticalAlign: "top",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Kit swatch ───────────────────────────────────────────────────────────────

function KitSwatch({ kit, isSelected }: { kit: ClubKit; isSelected: boolean }) {
  return (
    // Outer wrapper acts as the coloured border — more reliable than CSS border+borderRadius in html2canvas
    <div
      style={{
        padding: isSelected ? "3px" : "3px",
        background: isSelected ? "#4caf50" : "rgba(255,255,255,0.1)",
        borderRadius: "14px",
        flex: "0 0 auto",
        position: "relative",
        marginTop: isSelected ? "14px" : "0",
      }}
    >
      {/* "SE JUEGA CON ESTA" banner — flexbox centering, no CSS transform */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: "-16px",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#4caf50",
              color: "#0a1a0a",
              fontSize: "10px",
              fontWeight: 900,
              padding: "3px 14px",
              borderRadius: "10px",
              letterSpacing: "0.1em",
              whiteSpace: "nowrap",
            }}
          >
            ⚽ SE JUEGA CON ESTA
          </div>
        </div>
      )}
      {/* Inner card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          padding: "18px 24px 14px",
          background: isSelected ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.04)",
          borderRadius: "12px",
        }}
      >

      {/* Color swatches with labels */}
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        {/* Shirt */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: kit.shirtColor,
              border: "2px solid rgba(255,255,255,0.35)",
            }}
          />
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
            Camiseta
          </span>
        </div>
        {/* Shorts */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "5px",
              background: kit.shortsColor,
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          />
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
            Pantalón
          </span>
        </div>
        {/* Socks */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "4px",
              background: kit.socksColor,
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />
          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>
            Calcetines
          </span>
        </div>
      </div>

      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: isSelected ? "#4caf50" : "rgba(255,255,255,0.45)",
          textAlign: "center",
        }}
      >
        {kit.kitNumber === 1 ? "1ª Equipación" : "2ª Equipación"}
      </div>
      </div>
    </div>
  );
}

// ─── Cromo card ────────────────────────────────────────────────────────────────

function PlayerCromoCard({
  player,
  photoSrc,
  excuseLabel,
  excuseIsTechnical,
}: {
  player: PlayerResponse;
  photoSrc: string | null;
  /** If set, renders the card as a desconvocado with this label */
  excuseLabel?: string;
  excuseIsTechnical?: boolean;
}) {
  const name = playerDisplayName(player);
  const dorsal = player.dorsal;
  const position = player.position;
  const isNotCalled = excuseLabel != null;
  const accentColor = isNotCalled ? "#f06464" : "#ff9800";

  return (
    <div
      style={{
        width: "110px",
        borderRadius: "10px",
        overflow: "hidden",
        background: "linear-gradient(170deg, #1c1c30 0%, #07071a 100%)",
        border: `1px solid ${isNotCalled ? "rgba(240,100,100,0.3)" : "rgba(255,255,255,0.1)"}`,
        flexShrink: 0,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      {/* Photo area */}
      <div
        style={{
          position: "relative",
          height: "95px",
          overflow: "hidden",
          background: "linear-gradient(160deg, #252545 0%, #1a1a38 100%)",
        }}
      >
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 15%",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              color: "rgba(255,255,255,0.15)",
            }}
          >
            👤
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "36px",
            background: "linear-gradient(to top, #07071a, transparent)",
          }}
        />

        {/* Dorsal badge */}
        {dorsal != null && (
          <div
            style={{
              position: "absolute",
              top: "5px",
              right: "5px",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              borderRadius: "4px",
              padding: "1px 5px",
              fontSize: "11px",
              fontWeight: 800,
              border: "1px solid rgba(255,255,255,0.2)",
              lineHeight: 1.4,
            }}
          >
            {dorsal}
          </div>
        )}


      </div>

      {/* Body */}
      <div
        style={{
          padding: "5px 7px 7px",
          borderTop: `2px solid ${accentColor}`,
        }}
      >
        <div
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            color: "#e8e8e8",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.3,
          }}
          title={name}
        >
          {name}
        </div>

        {/* Convocado: show position */}
        {!isNotCalled && position && (
          <div
            style={{
              fontSize: "9.5px",
              color: "rgba(255,255,255,0.4)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: "2px",
            }}
          >
            {position}
          </div>
        )}

        {/* Desconvocado: show excuse */}
        {isNotCalled && (
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: excuseIsTechnical ? "#ff8040" : "#4ec9b0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: "3px",
            }}
          >
            {excuseLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

const ConvocatoriaPrint = forwardRef<ConvocatoriaPrintHandle, Props>(
  (
    {
      match,
      calledIds,
      notCalledIds,
      proposal,
      players,
      photos,
      excuseMap,
      excuseTypes,
      kits,
      selectedKitNumber,
    },
    ref,
  ) => {
    const page1Ref = useRef<HTMLDivElement>(null);
    const page2Ref = useRef<HTMLDivElement>(null);
    const page3Ref = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      print: async () => {
        const RENDER_WIDTH = 794;
        const SCALE = 2;
        const PAGE_W_PX = RENDER_WIDTH * SCALE;
        const PAGE_H_PX = Math.round(297 * (PAGE_W_PX / 210));

        // Render one section div into one or more A4-sized JPEG strings.
        // fitOnePage=true: if content is taller than A4, scale it down to fit (no slicing).
        const renderSection = async (el: HTMLDivElement, fitOnePage = false): Promise<string[]> => {
          const canvas = await html2canvas(el, {
            useCORS: true,
            allowTaint: true,
            scale: SCALE,
            logging: false,
            backgroundColor: "#0f0f23",
            scrollX: 0,
            scrollY: 0,
            width: RENDER_WIDTH,
            height: el.scrollHeight,
          });
          const pages: string[] = [];

          if (fitOnePage && canvas.height > PAGE_H_PX) {
            // Scale entire content down to fit exactly one A4 page
            const slice = document.createElement("canvas");
            slice.width = PAGE_W_PX;
            slice.height = PAGE_H_PX;
            const ctx = slice.getContext("2d")!;
            ctx.fillStyle = "#0f0f23";
            ctx.fillRect(0, 0, PAGE_W_PX, PAGE_H_PX);
            const scaleFactor = PAGE_H_PX / canvas.height;
            const scaledW = Math.round(canvas.width * scaleFactor);
            const xOff = Math.round((PAGE_W_PX - scaledW) / 2);
            ctx.drawImage(canvas, xOff, 0, scaledW, PAGE_H_PX);
            pages.push(slice.toDataURL("image/jpeg", 0.92));
          } else {
            for (let startY = 0; startY < canvas.height; startY += PAGE_H_PX) {
              const slice = document.createElement("canvas");
              slice.width = PAGE_W_PX;
              slice.height = PAGE_H_PX;
              const ctx = slice.getContext("2d")!;
              ctx.fillStyle = "#0f0f23";
              ctx.fillRect(0, 0, PAGE_W_PX, PAGE_H_PX);
              ctx.drawImage(canvas, 0, -startY);
              pages.push(slice.toDataURL("image/jpeg", 0.92));
            }
          }
          return pages;
        };

        const sectionEls: Array<[HTMLDivElement, boolean]> = [
          [page1Ref.current, false],
          [page2Ref.current, true],   // convocados: scale to fit one page
          [page3Ref.current, false],  // desconvocados: allow multi-page if needed
        ].filter((pair): pair is [HTMLDivElement, boolean] => pair[0] !== null);

        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        let firstPage = true;
        for (const [el, fitOnePage] of sectionEls) {
          const pages = await renderSection(el, fitOnePage);
          for (const imgData of pages) {
            if (!firstPage) pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
            firstPage = false;
          }
        }

        const localName = (match?.localTeamName ?? "Local").replace(/[^a-zA-Z0-9]/g, "_");
        const visitorName = (match?.visitorTeamName ?? "Visitante").replace(/[^a-zA-Z0-9]/g, "_");
        const dateStr = (match?.date ?? "").replace(/-/g, "");
        pdf.save(`Convocatoria_${localName}_vs_${visitorName}_${dateStr}.pdf`);
      },

      printProposal: async () => {
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = 210;
        const pageHeight = 297;
        const marginX = 16;
        const usableWidth = pageWidth - marginX * 2;

        const addPageBackground = () => {
          pdf.setFillColor(15, 15, 35);
          pdf.rect(0, 0, pageWidth, pageHeight, "F");
        };

        const addHeader = (title: string, subtitle: string) => {
          addPageBackground();
          pdf.setTextColor(255, 152, 0);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(18);
          pdf.text(title, marginX, 18);
          pdf.setTextColor(220, 220, 220);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          const subtitleLines = pdf.splitTextToSize(subtitle, usableWidth);
          pdf.text(subtitleLines, marginX, 25);
        };

        const wrapText = (text: string, width: number, size = 10): string[] => {
          pdf.setFontSize(size);
          return pdf.splitTextToSize(text, width);
        };

        const teamHeader = `${match?.localTeamName ?? "Local"} vs ${match?.visitorTeamName ?? "Visitante"}`;
        const dateHeader = match?.date ? ` · ${formatDateES(match.date)}` : "";
        const proposalPlayers = proposal.players;
        const selectedPlayers = proposalPlayers.filter((p) => p.isSelected);
        const selectedCount = selectedPlayers.length;
        const allPlayersCount = proposalPlayers.length;
        const rivalText = proposal.previousRivalResult
          ? `${proposal.previousRivalResult.rival} (${proposal.previousRivalResult.scoreText}, ${proposal.previousRivalResult.result})`
          : "Sin rival previo";

        addHeader("Informe de propuesta automática de desconvocatoria", `${teamHeader}${dateHeader}`);

        let y = 40;
        const statBoxes = [
          ["Objetivo", String(proposal.targetCount)],
          ["Analizados", String(allPlayersCount)],
          ["Seleccionados", String(selectedCount)],
          ["Convocados", String(proposal.calledCount)],
          ["Rival previo", rivalText],
        ] as const;

        statBoxes.forEach(([label, value], index) => {
          const col = index % 2;
          if (index === 2) y += 22;
          const x = marginX + col * (usableWidth / 2 + 4);
          const boxW = usableWidth / 2 - 2;
          pdf.setDrawColor(255, 152, 0);
          pdf.roundedRect(x, y, boxW, 16, 2, 2, "S");
          pdf.setTextColor(255, 152, 0);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.text(label, x + 3, y + 5);
          pdf.setTextColor(235, 235, 235);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.text(wrapText(value, boxW - 6, 10), x + 3, y + 11);
        });

        y += 26;
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text("Jugadores analizados", marginX, y);
        pdf.setDrawColor(255, 152, 0);
        pdf.line(marginX, y + 2, pageWidth - marginX, y + 2);
        y += 8;

        if (proposalPlayers.length === 0) {
          pdf.setTextColor(220, 220, 220);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.text(wrapText("No hay jugadores para evaluar.", usableWidth, 10), marginX, y);
        } else {
          proposalPlayers.forEach((player) => {
            if (y > 270) {
              pdf.addPage();
              addHeader("Informe de propuesta automática de desconvocatoria", `${teamHeader}${dateHeader}`);
              y = 38;
            }
            pdf.setTextColor(255, 255, 255);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            const selectedTag = player.isSelected ? "PROPUESTO" : "NO PROPUESTO";
            pdf.text(`${player.displayName} · ${player.score.toFixed(0)} pts · ${selectedTag}`, marginX, y);
            y += 5;

            const meta = `Posición: ${player.position ?? "Sin posición"} | Convocatorias: ${player.calledCount} | Titularidades: ${player.startsCount}`;
            pdf.setTextColor(190, 190, 190);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.text(wrapText(meta, usableWidth - 3, 9), marginX + 2, y);
            y += 5;

            pdf.setTextColor(150, 150, 150);
            pdf.setFontSize(8);
            player.factors.forEach((factor) => {
              const line = `${factor.label}: ${factor.impact > 0 ? "+" : ""}${factor.impact.toFixed(0)} (${factor.value})`;
              pdf.text(wrapText(line, usableWidth - 3, 8), marginX + 2, y);
              y += 4;
            });
            y += 4;
          });
        }

        pdf.addPage();
        addHeader("Detalle de factores", `${teamHeader}${dateHeader}`);
        y = 34;
        proposalPlayers.forEach((player) => {
          if (y > 270) {
            pdf.addPage();
            addHeader("Detalle de factores", `${teamHeader}${dateHeader}`);
            y = 34;
          }
          pdf.setTextColor(255, 255, 255);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(`${player.displayName} (${player.score.toFixed(0)} pts)`, marginX, y);
          y += 5;
          player.factors.forEach((factor) => {
            const line = `- ${factor.label}: ${factor.impact > 0 ? "+" : ""}${factor.impact.toFixed(0)} (${factor.value})`;
            pdf.setTextColor(210, 210, 210);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8.5);
            const wrapped = wrapText(line, usableWidth - 2, 8.5);
            pdf.text(wrapped, marginX + 2, y);
            y += wrapped.length * 4;
          });
          y += 3;
        });

        pdf.addPage();
        addHeader("Reglas aplicadas", `${teamHeader}${dateHeader}`);
        y = 36;
        const ruleLabels = [...new Set(proposalPlayers.flatMap((player) => player.factors.map((factor) => factor.label)))];
        ruleLabels.forEach((rule, index) => {
          if (y > 275) {
            pdf.addPage();
            addHeader("Reglas aplicadas", `${teamHeader}${dateHeader}`);
            y = 36;
          }
          pdf.setTextColor(255, 255, 255);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(`${index + 1}. ${rule}`, marginX, y);
          y += 5;
        });

        const safeLocal = (match?.localTeamName ?? "Local").replace(/[^a-zA-Z0-9]/g, "_");
        const safeVisitor = (match?.visitorTeamName ?? "Visitante").replace(/[^a-zA-Z0-9]/g, "_");
        const dateStr = (match?.date ?? "").replace(/-/g, "");
        pdf.save(`Propuesta_Desconvocatoria_${safeLocal}_vs_${safeVisitor}_${dateStr}.pdf`);
      },

      copyForWhatsApp: async () => {
        // ── Re-derive data (closure captures latest props) ──────────────────
        const _uniqueNotCalledIds = [...new Set(notCalledIds)];
        const _calledPlayers = calledIds
          .map((id) => players.find((p) => p.id === id))
          .filter(Boolean) as PlayerResponse[];
        const _notCalledPlayers = _uniqueNotCalledIds
          .map((id) => players.find((p) => p.id === id))
          .filter(Boolean) as PlayerResponse[];

        const _groups = new Map<number, PlayerResponse[]>();
        for (const p of _calledPlayers) {
          const order = positionOrder(p.position);
          if (!_groups.has(order)) _groups.set(order, []);
          _groups.get(order)!.push(p);
        }
        const _sortedGroups = Array.from(_groups.entries()).sort(([a], [b]) => a - b);
        const _selectedKit = kits.find((k) => k.kitNumber === selectedKitNumber);
        const _otherKit = kits.find((k) => k.kitNumber !== selectedKitNumber);
        const _arrival = match ? arrivalTime(match.time) : "";
        const _dateES = match ? formatDateES(match.date) : "";

        const POSITION_EMOJIS: Record<number, string> = {
          0: "🧤",
          1: "🛡️",
          2: "⚙️",
          3: "⚡",
          4: "👤",
        };

        const lines: string[] = [];
        lines.push("⚽ *CONVOCATORIA* ⚽");
        lines.push("");

        if (match) {
          lines.push(`🆚 *${match.localTeamName} vs ${match.visitorTeamName}*`);
          if (_dateES) lines.push(`📅 ${_dateES}`);
          if (match.time) lines.push(`⏰ Hora del partido: *${match.time}*`);
          if (_arrival) lines.push(`🕐 Hora de llegada: *${_arrival}*`);
          if (match.field) {
            lines.push(`📍 Campo: ${match.field}`);
            const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(match.field)}`;
            lines.push(`🗺️ ${mapsUrl}`);
          }
        }

        if (_selectedKit) {
          const kitName = _selectedKit.kitNumber === 1 ? "1ª Equipación" : "2ª Equipación";
          lines.push("");
          lines.push(`👕 *Equipación: ${kitName}*`);
          if (_otherKit) {
            const other = _otherKit.kitNumber === 1 ? "primera" : "segunda";
            lines.push(`⚠️ Traed también la ${other} equipación`);
          }
          lines.push("🧤 *Porteros:* traed las dos equipaciones de portero");
        }

        lines.push("");
        lines.push("━━━━━━━━━━━━━━━━━━━━━━");
        lines.push(`✅ *CONVOCADOS (${calledIds.length})*`);

        for (const [order, groupPlayers] of _sortedGroups) {
          lines.push("");
          lines.push(`${POSITION_EMOJIS[order] ?? "👤"} *${POSITION_LABELS[order]}:*`);
          for (const p of groupPlayers) {
            const name = playerDisplayName(p);
            const dorsal = p.dorsal != null ? ` (Nº ${p.dorsal})` : "";
            lines.push(`• ${name}${dorsal}`);
          }
        }

        if (_notCalledPlayers.length > 0) {
          lines.push("");
          lines.push("━━━━━━━━━━━━━━━━━━━━━━");
          lines.push(`❌ *DESCONVOCADOS (${_uniqueNotCalledIds.length})*`);
          for (const p of _notCalledPlayers) {
            const label = getExcuseLabel(excuseMap[p.id], excuseTypes);
            lines.push(`• ${playerDisplayName(p)} — ${label}`);
          }
        }

        const text = lines.join("\n");
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          return false;
        }
      },
    }));

    // ── Derived data ──────────────────────────────────────────────────────────

    const calledPlayers = calledIds
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean) as PlayerResponse[];

    // Deduplicate notCalledIds — the hook can push the same id more than once
    const uniqueNotCalledIds = [...new Set(notCalledIds)];
    const notCalledPlayers = uniqueNotCalledIds
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean) as PlayerResponse[];

    // Group called players by position
    const groups = new Map<number, PlayerResponse[]>();
    for (const p of calledPlayers) {
      const order = positionOrder(p.position);
      if (!groups.has(order)) groups.set(order, []);
      groups.get(order)!.push(p);
    }
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a - b);

    // Kit helpers
    const selectedKit = kits.find((k) => k.kitNumber === selectedKitNumber);
    const otherKit = kits.find((k) => k.kitNumber !== selectedKitNumber);

    const arrival = match ? arrivalTime(match.time) : "";
    const dateES = match ? formatDateES(match.date) : "";
    const totalCalled = calledIds.length;
    const totalNotCalled = uniqueNotCalledIds.length;
    const totalPlayers = players.length;
    const proposalCount = totalNotCalled;
    const technicalNotCalledCount = uniqueNotCalledIds.filter((id) => (excuseMap[id] == null)).length;
    const nonTechnicalNotCalledCount = totalNotCalled - technicalNotCalledCount;

    // ── Section card base style ─────────────────────────────────────────────

    const card: React.CSSProperties = {
      background: "linear-gradient(135deg, #1a1a35 0%, #0f1129 100%)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: "12px",
      padding: "20px 24px",
      marginBottom: "14px",
    };

    // ─────────────────────────────────────────────────────────────────────────

    const pageStyle: React.CSSProperties = {
      backgroundColor: "#0f0f23",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      color: "#e8e8e8",
      padding: "24px",
      boxSizing: "border-box",
    };

    return (
      <div className={styles.printWrapper}>
        {/* ═══ PAGE 1: Informe ejecutivo ════════════════════════════════════ */}
        <div ref={page1Ref} className={styles.printPage} style={pageStyle}>
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.52)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
              Informe de convocatoria
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#ff9800", marginTop: "4px", lineHeight: 1.05 }}>
              {match?.localTeamName ?? "—"} vs {match?.visitorTeamName ?? "—"}
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.72)", marginTop: "8px" }}>
              Documento resumen para impresión y archivo interno.
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <ReportStatCard label="Convocados" value={String(totalCalled)} accent="#4ec9b0" />
              <ReportStatCard label="Desconvocados" value={String(totalNotCalled)} accent="#f06464" />
              <ReportStatCard label="Plantilla" value={String(totalPlayers)} accent="#6ab4f0" />
              <ReportStatCard label="Propuesta" value={String(proposalCount)} accent="#ff9800" />
            </div>

            <div style={{ marginTop: "18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <SectionTitle title="Datos del partido" color="#ff9800" />
                <div style={{ display: "flex", flexDirection: "column", marginTop: "10px" }}>
                  {dateES && <InfoRow icon="📅" label="Fecha" value={dateES} />}
                  {match?.time && <InfoRow icon="⏰" label="Hora del partido" value={match.time} />}
                  {arrival && <InfoRow icon="🕐" label="Hora de llegada" value={arrival} highlight />}
                  {match?.field && <InfoRow icon="📍" label="Campo" value={match.field} />}
                </div>
              </div>
              <div>
                <SectionTitle title="Resumen de desconvocatorias" color="#f06464" />
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.78)" }}>
                    Técnicas: <strong style={{ color: "#ff9800" }}>{technicalNotCalledCount}</strong>
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.78)" }}>
                    No técnicas: <strong style={{ color: "#4ec9b0" }}>{nonTechnicalNotCalledCount}</strong>
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.78)" }}>
                    Estado: <strong style={{ color: "#ffffff" }}>{totalNotCalled > 0 ? "Con desconvocatorias" : "Sin desconvocatorias"}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Equipación */}
          <div style={{ ...card, marginBottom: 0 }}>
            <SectionTitle title="Equipación" color="#e8e8e8" />

            {kits.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "10px 0 0" }}>
                Sin equipación configurada
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "22px" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    paddingTop: "16px",
                  }}
                >
                  {kits.map((k) => (
                    <KitSwatch key={k.kitNumber} kit={k} isSelected={k.kitNumber === selectedKitNumber} />
                  ))}
                </div>

                {selectedKit && otherKit && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "rgba(255,152,0,0.1)",
                      border: "1px solid rgba(255,152,0,0.28)",
                      borderRadius: "8px",
                      padding: "9px 14px",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#ff9800", fontWeight: 600 }}>
                      ⚠️&nbsp;Traed también la{" "}
                      <strong>
                        {otherKit.kitNumber === 1 ? "primera" : "segunda"} equipación
                      </strong>{" "}
                      por si es necesario
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "rgba(106,180,240,0.1)",
                    border: "1px solid rgba(106,180,240,0.25)",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    fontSize: "13px",
                    color: "#6ab4f0",
                    fontWeight: 600,
                  }}
                >
                  🧤&nbsp;
                  <span>
                    <strong>Porteros:</strong> Traed las dos equipaciones de portero
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ PAGE 2: Convocados como informe ═════════════════════════════ */}
        <div ref={page2Ref} className={styles.printPage} style={pageStyle}>
          <div style={{ ...card, marginBottom: 0 }}>
            <SectionTitle title={`Listado de convocados (${calledIds.length})`} color="#4ec9b0" />
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "6px" }}>
              Relación nominal de jugadores convocados, agrupada por posición para facilitar la lectura en formato impreso.
            </div>

            {sortedGroups.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "10px 0 0" }}>
                Sin jugadores convocados
              </p>
            ) : (
              <div style={{ marginTop: "14px" }}>
                {sortedGroups.map(([order, groupPlayers]) => {
                  const rows = groupPlayers.map((p) => {
                    const row: string[] = [];
                    row.push(playerDisplayName(p));
                    row.push(p.dorsal != null ? String(p.dorsal) : "—");
                    row.push(p.position ?? "Sin posición");
                    row.push(photos[p.id] ? "Sí" : "No");
                    return row;
                  });
                  return (
                    <ReportTable
                      key={order}
                      title={`${POSITION_LABELS[order]} (${groupPlayers.length})`}
                      columns={["Jugador", "Dorsal", "Posición", "Foto"]}
                      rows={rows}
                      accent="#4ec9b0"
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══ PAGE 3: Desconvocados como informe ═══════════════════════════ */}
        {notCalledPlayers.length > 0 && (
          <div ref={page3Ref} className={styles.printPage} style={pageStyle}>
            <div style={{ ...card, marginBottom: 0 }}>
              <SectionTitle title={`Desconvocados (${uniqueNotCalledIds.length})`} color="#f06464" />
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "6px" }}>
                Detalle de las desconvocatorias y su causa principal.
              </div>
              <ReportTable
                title="Relación de desconvocados"
                columns={["Jugador", "Dorsal", "Causa", "Tipo"]}
                rows={notCalledPlayers.map((p) => {
                  const excuseId = excuseMap[p.id];
                  const label = getExcuseLabel(excuseId, excuseTypes);
                  return [
                    playerDisplayName(p),
                    p.dorsal != null ? String(p.dorsal) : "—",
                    label,
                    excuseId == null ? "Técnica" : "No técnica",
                  ];
                })}
                accent="#f06464"
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);
ConvocatoriaPrint.displayName = "ConvocatoriaPrint";

export default ConvocatoriaPrint;
