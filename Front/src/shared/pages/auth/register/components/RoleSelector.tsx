import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import { USER_TYPE_OPTIONS, type UserType } from "../../../../constants/userTypes";
import styles from "./RoleSelector.module.css";

interface RoleSelectorProps {
  value: UserType | "";
  onChange: (value: UserType) => void;
}

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <FormControl component="fieldset" className={styles.field}>
      <FormLabel component="legend">Tipo de cuenta</FormLabel>
      <RadioGroup
        name="role"
        value={value}
        onChange={(e) => onChange(e.target.value as UserType)}
      >
        {USER_TYPE_OPTIONS.map((opt) => (
          <FormControlLabel
            key={opt.value}
            value={opt.value}
            control={<Radio />}
            label={opt.label}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}
