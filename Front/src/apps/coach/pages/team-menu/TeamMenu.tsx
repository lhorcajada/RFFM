import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TextField from "@mui/material/TextField";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import useIsPlayerRole from "../../hooks/useIsPlayerRole";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import seasonService from "../../services/seasonService";
import { buildTeamSections } from "../../navigation/teamSections";
import { useTeamContextId } from "../../navigation/useTeamContextId";
import styles from "./TeamMenu.module.css";

const NO_ACCESS = () => false;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function TeamMenu() {
  useAuditPageAccess("TeamMenu");
  const isPlayer = useIsPlayerRole();
  const { loading, hasFeatureAccess } = usePermissions();
  const teamId = useTeamContextId(isPlayer);
  const { teamTitleNode } = useTeamAndClub();
  const [query, setQuery] = useState("");
  const [seasonName, setSeasonName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    seasonService
      .getActiveSeason()
      .then((season) => {
        if (!cancelled) setSeasonName(season?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setSeasonName(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const sections = buildTeamSections({
      teamId,
      isPlayer,
      hasFeatureAccess: loading ? NO_ACCESS : hasFeatureAccess,
    });
    const term = normalize(query.trim());
    if (!term) return sections;
    return sections
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => normalize(item.label).includes(term)),
      }))
      .filter((group) => group.items.length > 0);
  }, [teamId, isPlayer, loading, hasFeatureAccess, query]);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout title="Menú" subtitle={teamTitleNode ?? "Secciones del equipo"}>
        <div className={styles.page}>
          {seasonName && <span className={styles.season}>Temporada {seasonName}</span>}
          <TextField
            label="Buscar sección"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Plantilla, sanciones, resultados…"
            fullWidth
            className={styles.search}
          />
          {groups.length === 0 ? (
            <p className={styles.empty}>No hay ninguna sección con ese nombre.</p>
          ) : (
            <div className={styles.groups}>
              {groups.map((group) => (
                <section key={group.title} className={styles.group}>
                  <h2 className={styles.groupTitle}>{group.title}</h2>
                  <ul className={styles.list}>
                    {group.items.map(({ key, label, to, icon: Icon }) => (
                      <li key={key}>
                        <Link to={to} className={styles.row}>
                          <span className={styles.iconBox} aria-hidden="true">
                            <Icon fontSize="small" />
                          </span>
                          <span className={styles.label}>{label}</span>
                          <ChevronRightIcon className={styles.chevron} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
