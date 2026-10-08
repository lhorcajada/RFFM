import React from "react";
import styles from "./FieldInfo.module.css";
import {
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { Acta } from "../../../types/acta";
import Pitch from "../../../../../assets/football-pitch.svg";
import MapPin from "../../../../../shared/components/ui/MapPin/MapPin";
import { getMapsUrlByNameCity } from "../../../../../shared/utils/maps";

export default function FieldInfo({ acta }: { acta: Acta }) {
  return (
    <Paper className={styles.root} elevation={0}>
      <div className={styles.desktopOnly}>
        <div className={styles.headerRow}>
          <Typography variant="subtitle1">Terreno de juego</Typography>
        </div>

        <div className={styles.contentRow}>
          <div className={styles.pitchWrap}>
            <img src={Pitch} alt="campo" />
          </div>
          <div className={styles.infoCol}>
            <Typography variant="body1">
              <strong>
                {acta?.campo}
                {(() => {
                  const mapsUrl = getMapsUrlByNameCity(
                    acta?.campo || null,
                    (acta as any)?.ciudad || (acta as any)?.localidad || null
                  );
                  return mapsUrl ? <MapPin href={mapsUrl} /> : null;
                })()}
              </strong>
            </Typography>
          </div>
        </div>
      </div>

      <div className={styles.mobileOnly}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Terreno de juego</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <div className={styles.mobileContent}>
              <div className={styles.pitchWrapMobile}>
                <img src={Pitch} alt="campo" />
              </div>
              <div className={styles.infoColMobile}>
                <Typography variant="body1">
                  <strong>
                    {acta?.campo}
                    {(() => {
                      const mapsUrl = getMapsUrlByNameCity(
                        acta?.campo || null,
                        (acta as any)?.ciudad ||
                          (acta as any)?.localidad ||
                          null
                      );
                      return mapsUrl ? <MapPin href={mapsUrl} /> : null;
                    })()}
                  </strong>
                </Typography>
              </div>
            </div>
          </AccordionDetails>
        </Accordion>
      </div>
    </Paper>
  );
}
