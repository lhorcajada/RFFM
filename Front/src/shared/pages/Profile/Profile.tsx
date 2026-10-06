import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../components/ui/ContentLayout/ContentLayout";
import { useUser } from "../../context/UserContext";
import {
  getMyAccount,
  getMyMemberships,
  type MyAccount,
  type MyMemberships,
} from "../../services/profile/profileService";
import AvatarCard from "./components/AvatarCard";
import ChangePasswordCard from "./components/ChangePasswordCard";
import MembershipsCard from "./components/MembershipsCard";
import PersonalDataCard from "./components/PersonalDataCard";
import styles from "./Profile.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; account: MyAccount; memberships: MyMemberships };

const FALLBACK_RETURN_PATH = "/appSelector";

export default function Profile() {
  const { refreshAccount } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = (location.state as { from?: string } | null)?.from ?? FALLBACK_RETURN_PATH;
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [account, memberships] = await Promise.all([getMyAccount(), getMyMemberships()]);
      setState({ status: "ready", account, memberships });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateAccount = (update: (account: MyAccount) => MyAccount) => {
    setState((prev) => (prev.status === "ready" ? { ...prev, account: update(prev.account) } : prev));
    void refreshAccount();
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Mi perfil"
        className={styles.root}
        actionBar={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(returnPath)}>
            Volver
          </Button>
        }
      >
        {state.status === "loading" && (
          <div className={styles.loading}>
            <CircularProgress />
          </div>
        )}
        {state.status === "error" && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void load()}>
                Reintentar
              </Button>
            }
          >
            No se pudo cargar tu perfil.
          </Alert>
        )}
        {state.status === "ready" && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <PersonalDataCard account={state.account} onSaved={(saved) => updateAccount(() => saved)} />
            </Grid>
            <Grid item xs={12} md={6}>
              <AvatarCard
                account={state.account}
                onChanged={(avatarUrl) => updateAccount((account) => ({ ...account, avatarUrl }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <ChangePasswordCard />
            </Grid>
            <Grid item xs={12} md={6}>
              <MembershipsCard memberships={state.memberships} />
            </Grid>
          </Grid>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
