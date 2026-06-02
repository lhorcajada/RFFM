import React from "react";
import TeamManagementDialog from "./TeamManager";

interface TeamSelectorProps {
  clubId?: string | null;
  initialValue?: string | null;
  onChange: (teamId: string | null) => void;
}

const TeamSelector: React.FC<TeamSelectorProps> = ({ clubId }) => {
  return (
    <TeamManagementDialog
      inline
      clubId={clubId ?? ""}
    />
  );
};

export default TeamSelector;
