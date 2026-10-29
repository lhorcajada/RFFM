import React from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { IconButton, Tooltip } from "@mui/material";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ErrorBoundary from "../../../../../shared/components/ui/ErrorBoundary/ErrorBoundary";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";
import ClubPendingWidget from "./components/ClubPendingWidget";
import ClubQuickActions from "./components/ClubQuickActions";
import ClubTeamsWidget from "./components/ClubTeamsWidget";
import { useClubPendingRequests } from "./hooks/useClubPendingRequests";
import styles from "./Dashboard.module.css";

export default function ClubsDashboard() {
  const { id } = useParams();
  const { search } = useLocation();
  const seasonId = new URLSearchParams(search).get("seasonId") ?? undefined;
  const navigate = useNavigate();
  const { count: pendingRequests } = useClubPendingRequests(id);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={id ? <ClubHeader clubId={id} /> : "Panel del club"}
        subtitle="Panel del club"
        actionBar={
          <div className={styles.actionBar}>
            <Tooltip title="Volver">
              <IconButton
                aria-label="Volver"
                className={styles.headerButton}
                onClick={() => navigate("/coach/dashboard")}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
          </div>
        }
      >
        {id && (
          <div className={styles.pageContent}>
            <div className={styles.widgetsGrid}>
              <div className={styles.mainColumn}>
                <ErrorBoundary>
                  <ClubTeamsWidget clubId={id} seasonId={seasonId} />
                </ErrorBoundary>
              </div>
              <div className={styles.sideColumn}>
                <ErrorBoundary>
                  <ClubQuickActions
                    clubId={id}
                    seasonId={seasonId}
                    pendingRequests={pendingRequests}
                  />
                </ErrorBoundary>
                <ErrorBoundary>
                  <ClubPendingWidget clubId={id} pendingRequests={pendingRequests} />
                </ErrorBoundary>
              </div>
            </div>
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
