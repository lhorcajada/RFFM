import React, { useEffect, useState } from "react";
import styles from "../PlayerDetail.module.css";
import { TeamPlayerResponse } from "../../../services/teamplayerService";
import demarcationService, {
  DemarcationOption,
} from "../../../services/demarcationService";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Radio from "@mui/material/Radio";
import FormControlLabel from "@mui/material/FormControlLabel";

type Props = {
  teamPlayer: TeamPlayerResponse;
  editing?: boolean;
  value?: string[];
  active?: string | null;
  onChange?: (vals: number[]) => void;
  onActiveChange?: (activeId: number | null) => void;
};

export default function Demarcations({
  teamPlayer,
  editing,
  value,
  active,
  onChange,
  onActiveChange,
}: Props) {
  const [options, setOptions] = useState<DemarcationOption[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const list = await demarcationService.getDemarcations();
      if (!mounted) return;
      setOptions(list);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const selected = value ?? teamPlayer.demarcation?.possibleDemarcations ?? [];
  const activeName =
    active ?? teamPlayer.demarcation?.activePositionName ?? null;

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Demarcaciones</h3>
        {!editing && (
          <>
            <div className={styles.row}>
              <div className={styles.label}>Activa</div>
              <div className={styles.value}>{activeName ?? "-"}</div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Posibles</div>
              <div className={styles.value}>
                {(selected || []).length > 0
                  ? (selected || []).join(", ")
                  : "-"}
              </div>
            </div>
          </>
        )}

        {editing && (
          <div>
            <div className={styles.autocompleteWrap}>
              <Autocomplete
                multiple
                options={options}
                getOptionLabel={(o) => o.name}
                value={options.filter((opt) =>
                  (selected || []).includes(opt.name)
                )}
                onChange={(_, v) => onChange && onChange(v.map((x) => x.id))}
                className={styles.autocomplete}
                fullWidth
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Posibles demarcaciones"
                    fullWidth
                  />
                )}
              />

              <div className={styles.instruction}>
                Seleccione la demarcación habitual
              </div>
              <div className={styles.radioList}>
                {options
                  .filter((opt) => (selected || []).includes(opt.name))
                  .map((opt) => (
                    <div key={opt.id} className={styles.radioRow}>
                      <FormControlLabel
                        control={
                          <Radio
                            checked={activeName === opt.name}
                            onChange={() =>
                              onActiveChange && onActiveChange(opt.id)
                            }
                          />
                        }
                        label={opt.name}
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
