## ADDED Requirements

### Requirement: Zero-minute players show why they didn't play
The live-match and match-preparation rosters (bench and on-field lists) SHALL display a status badge instead of a bare placeholder for a player with 0 accrued minutes when their convocation carries a non-attendance `AssistanceTypeId`: "No asistió" for `UnexcusedAbsence`, "No asistió (justificado)" for `ExcusedAbsence`, or "Llegó tarde" for `LateArrival`. When the convocation also carries an `ExcuseTypeId`, the resolved reason name SHALL be shown alongside the badge (as label text or a tooltip). A player with no such convocation state (never called, or `Attendance`) SHALL keep showing the existing bare placeholder.

#### Scenario: Unexcused absence shows a badge with no reason
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = UnexcusedAbsence`,
  no `ExcuseTypeId`
- **WHEN** the coach views the bench list in the live-match or preparation view
- **THEN** the player's minutes cell shows "No asistió" instead of a bare placeholder

#### Scenario: Excused absence shows a badge with the reason
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = ExcusedAbsence`,
  `ExcuseTypeId` resolving to "Lesión"
- **WHEN** the coach views the bench list
- **THEN** the player's minutes cell shows "No asistió (justificado)" with "Lesión" shown as the
  reason

#### Scenario: Late arrival shows a badge with the reason
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = LateArrival`,
  `ExcuseTypeId` resolving to a catalog reason
- **WHEN** the coach views the bench list
- **THEN** the player's minutes cell shows "Llegó tarde" with the reason shown

#### Scenario: Normal not-yet-used substitute keeps the existing placeholder
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = Attendance` (or no
  assistance recorded yet)
- **WHEN** the coach views the bench list
- **THEN** the player's minutes cell shows the existing bare placeholder, unchanged
