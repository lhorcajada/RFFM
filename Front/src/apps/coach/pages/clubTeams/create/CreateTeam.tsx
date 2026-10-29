import React, { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";
import { Box, Button } from "@mui/material";
import styles from "../ClubTeams.module.css";
import formStyles from "../TeamForm.module.css";
import createStyles from "./CreateTeam.module.css";
import teamService from "../../../services/teamService";
import type { TeamResponse } from "../../../services/teamService";
import CategorySelect from "../../../components/CategorySelect/CategorySelect";
import LeagueSelect from "../../../components/LeagueSelect/LeagueSelect";
import TeamCrest from "../../../components/TeamCrest/TeamCrest";
import TeamLettersPicker from "./components/TeamLettersPicker";
import BatchSummary from "./components/BatchSummary";
import { buildTeamName, getExistingLetters } from "./teamBatch";

function notify(message: string, severity: "success" | "error") {
  window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }));
}

function getErrorDetail(e: unknown): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail;
  return typeof detail === "string" && detail ? detail : "No se pudieron crear los equipos";
}

function buildResultMessage(createdCount: number, skippedCount: number): string {
  const created = createdCount === 1 ? "1 equipo creado" : `${createdCount} equipos creados`;
  if (skippedCount === 0) return created;
  return `${created}, ${skippedCount} ${skippedCount === 1 ? "ya existía" : "ya existían"}`;
}

export default function CreateTeam() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const cameFromSettings = (location.state as { from?: string } | null)?.from === "settings";
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [clubTeams, setClubTeams] = useState<TeamResponse[]>([]);
  const [letters, setLetters] = useState<string[]>([]);

  // Categories and leagues are loaded from the API via CategorySelect/LeagueSelect

  const goBackToList = () => {
    if (cameFromSettings) {
      navigate("/coach/settings", { state: { section: "teams" } });
    } else {
      navigate(`/coach/clubs/${id}/teams`);
    }
  };

  const existingLetters = React.useMemo(
    () => (categoryId ? getExistingLetters(clubTeams, categoryId, categoryName) : []),
    [clubTeams, categoryId, categoryName]
  );
  const namesToCreate = letters.map((l) => buildTeamName(categoryName, l));

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    teamService
      .getTeams(id)
      .then((teams) => {
        if (active) setClubTeams(teams);
      })
      .catch(() => {
        if (active) setClubTeams([]);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleCategoryChange = (c?: { id: number; name: string }) => {
    setCategoryId(c?.id ?? null);
    setCategoryName(c?.name ?? "");
    setLetters([]);
  };

  const handleBatchSubmit = async () => {
    if (!id || !categoryId || letters.length === 0) return;
    setSaving(true);
    try {
      const result = await teamService.createTeamsBatch(id, { categoryId, leagueId, letters });
      notify(buildResultMessage(result.created.length, result.skipped.length), "success");
      goBackToList();
    } catch (e) {
      notify(getErrorDetail(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Añadir equipo"
        subtitle={id ? <ClubHeader clubId={id} /> : "-"}
        actionBar={
          <Button variant="outlined" size="small" onClick={() => navigate(-1)}>
            Volver
          </Button>
        }
      >
        <Box className={`${styles.page} ${formStyles.page}`}>
        <div className={createStyles.batchLayout}>
          <div className={createStyles.batchMain}>
            <section className={formStyles.section}>
              <h2 id="team-data-title" className={formStyles.sectionTitle}>
                Datos del equipo
              </h2>

              <CategorySelect value={categoryId} onChange={handleCategoryChange} />

              <LeagueSelect
                categoryId={categoryId}
                value={leagueId}
                onChange={(l) => setLeagueId(l?.id ?? null)}
              />

              {categoryId ? (
                <TeamLettersPicker
                  categoryName={categoryName}
                  existing={existingLetters}
                  selected={letters}
                  onChange={setLetters}
                />
              ) : (
                <p className={formStyles.sectionHint}>
                  Elige una categoría para seleccionar las letras de los equipos.
                </p>
              )}
            </section>

            <section className={`${formStyles.section} ${createStyles.crestNotice}`}>
              <div className={createStyles.crestBox}>
                <TeamCrest />
              </div>
              <div className={createStyles.crestTexts}>
                <span className={createStyles.crestTitle}>Foto del equipo</span>
                <span className={formStyles.sectionHint}>
                  Al crear varios equipos a la vez, todos llevan este escudo genérico. Podrás cambiar la
                  foto de cada uno después desde su ficha.
                </span>
              </div>
            </section>
          </div>

          <BatchSummary
            names={namesToCreate}
            existingCount={existingLetters.length}
            processing={saving}
            onSubmit={handleBatchSubmit}
            onCancel={() => navigate(-1)}
          />
        </div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
