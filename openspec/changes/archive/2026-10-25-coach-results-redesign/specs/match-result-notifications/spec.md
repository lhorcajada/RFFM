## MODIFIED Requirements

### Requirement: The Results page shows a match result notifications toggle
The Coach Results page (`/coach/results`) SHALL show, in its action bar next to «Volver», a compact 44 px bell button whose accessible name is «Avisos de resultados:» followed by «activados», «desactivados» or «sin equipo», and whose icon shows whether the notifications are on. Pressing the bell SHALL open a panel with a "Notificarme los resultados de {teamName}" switch reflecting the current user's preference when the user has a primary team, persisting changes through the preference endpoint. When the user has no primary team the panel SHALL show a hint to save their team in settings instead of the switch. The page SHALL NOT show the switch inline above the content.

#### Scenario: Compact bell
- **WHEN** a user with a primary team and preference `enabled = true` opens Results
- **THEN** the action bar shows the button «Avisos de resultados: activados» and no switch is visible until it is pressed

#### Scenario: Toggle reflects the stored preference
- **WHEN** a user with a primary team and preference `enabled = true` opens the bell panel
- **THEN** the switch "Notificarme los resultados de {teamName}" is displayed checked

#### Scenario: Turning the toggle off
- **WHEN** the user unchecks the switch
- **THEN** the page calls `PUT` with `enabled = false`, the switch stays unchecked and the bell reads «Avisos de resultados: desactivados»

#### Scenario: Save failure reverts the toggle
- **WHEN** the `PUT` request fails
- **THEN** the switch returns to its previous value and an error snackbar is shown

#### Scenario: User without primary team
- **WHEN** the preference response has `teamName = null` and the user opens the bell panel
- **THEN** no switch is shown and a hint to save their team in settings is displayed

#### Scenario: Browser without push subscription
- **WHEN** the switch is shown and the current browser has no Web Push subscription
- **THEN** a help text in the panel links to Ajustes > Notificaciones to activate notifications on this device
