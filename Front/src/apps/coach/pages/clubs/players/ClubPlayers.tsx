import React from "react";
import { Alert, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";
import ClubPlayerSearch from "../../../components/ClubPlayerSearch/ClubPlayerSearch";
import PreferredClubPlayersList from "../components/PreferredClubPlayersList";
import { getPlayersByClub, createPlayer } from "../../../services/playerService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { Player } from "../../../types/player";
import styles from "./ClubPlayers.module.css";

export default function ClubPlayers() {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const qs = new URLSearchParams(search);
  const seasonId = qs.get("seasonId") ?? undefined;
  const [selectedPlayers, setSelectedPlayers] = React.useState<PlayerResponse[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [playersRefreshToken, setPlayersRefreshToken] = React.useState(0);

  const normalizeKey = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

  const makePlayerKeys = (player: Pick<Player, "name" | "lastName" | "alias"> & {
    name?: string | null;
    lastName?: string | null;
    alias?: string | null;
  }) => {
    const name = normalizeKey(player.name);
    const lastName = normalizeKey(player.lastName);
    const alias = normalizeKey(player.alias);
    const fullName = normalizeKey(`${player.name ?? ""} ${player.lastName ?? ""}`.trim());

    return [alias, fullName, name ? `${name}|${lastName}` : ""]
      .filter((key): key is string => key.length > 0);
  };

  const handleBack = () => {
    if (!id) {
      navigate("/coach/clubs");
      return;
    }

    navigate(`/coach/clubs/dashboard/${id}${seasonId ? `?seasonId=${seasonId}` : ""}`);
  };

  const handleSave = async () => {
    if (!id) {
      setSaveMessage("No hay un club activo para guardar jugadores.");
      return;
    }

    if (selectedPlayers.length === 0) {
      setSaveMessage("Selecciona al menos un jugador antes de guardar.");
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    let saved = 0;
    let skipped = 0;

    try {
      const existingPlayers = await getPlayersByClub(id);
      const existingKeys = new Set<string>();

      for (const player of existingPlayers) {
        makePlayerKeys(player).forEach((key) => existingKeys.add(key));
      }

      const seenSelectedKeys = new Set<string>();

      for (const player of selectedPlayers) {
        const name = player.name?.trim() || player.alias?.trim() || "Jugador";
        const lastName = player.lastName?.trim() || undefined;
        const alias = player.alias?.trim() || name;
        const selectedKeys = makePlayerKeys({ name, lastName, alias });
        const alreadySeen = selectedKeys.some((key) => existingKeys.has(key) || seenSelectedKeys.has(key));

        if (alreadySeen) {
          skipped += 1;
          continue;
        }

        try {
          await createPlayer({
            name,
            lastName,
            alias,
            clubId: id,
          });
          selectedKeys.forEach((key) => {
            existingKeys.add(key);
            seenSelectedKeys.add(key);
          });
          saved += 1;
        } catch {
          skipped += 1;
        }
      }

      setSaveMessage(
        skipped > 0
          ? saved > 0
            ? `Guardados ${saved} jugadores. ${skipped} ya existían o no se pudieron guardar.`
            : `No se pudo guardar ninguno de los ${skipped} jugadores seleccionados.`
          : `Guardados ${saved} jugadores.`
      );

      if (saved > 0) {
        setPlayersRefreshToken((current) => current + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Jugadores del club"
        subtitle={id ? <ClubHeader clubId={id} /> : "Alta y edición de jugadores"}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          </>
        }
      >
        <div className={styles.page}>
          <ClubPlayerSearch
            clubId={id ?? null}
            defaultSeasonId={seasonId ?? null}
            onSave={handleSave}
            saving={saving}
            onSelectionChange={setSelectedPlayers}
          />
          <PreferredClubPlayersList clubId={id ?? null} refreshToken={playersRefreshToken} />
          {saveMessage ? <Alert severity="info">{saveMessage}</Alert> : null}         
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}