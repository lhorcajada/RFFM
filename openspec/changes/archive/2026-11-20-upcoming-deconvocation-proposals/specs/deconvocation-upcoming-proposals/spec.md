## ADDED Requirements

### Requirement: Estimated proposal for each of the next 5 league matches
The deconvocation proposal screen SHALL show a tab for the current proposal and one tab for each of the next up to 5 league matches after it, in match order. Each estimated tab SHALL show the match (round, date, rival), the rival difficulty and a notice that it is an estimate. Estimated tabs SHALL NOT offer to apply the proposal. When there is no calendar or forecast to locate the next matches, only the current tab SHALL be shown.

#### Scenario: Six tabs
- **WHEN** the forecast has 5 or more league matches after the current one
- **THEN** the screen shows the current tab and 5 estimated tabs, each with its round, date and rival

#### Scenario: Fewer matches left
- **WHEN** only 2 league matches remain after the current one
- **THEN** the screen shows the current tab and 2 estimated tabs

#### Scenario: No next matches
- **WHEN** the next matches cannot be located
- **THEN** only the current proposal is shown, without tabs

#### Scenario: Estimates cannot be applied
- **WHEN** the coach opens an estimated tab
- **THEN** the tab shows the «Estimación» notice and no action to apply the proposal

### Requirement: Estimates are chained
Each estimated proposal SHALL be computed from the state after the previous proposal was applied: players proposed (not mandatory) are deconvoked by technical decision, players already out keep their absence, and the rest are called. Streaks, call surplus, technical deconvocations, minimum of calls and protection windows SHALL be recomputed before each proposal.

#### Scenario: Rested player is protected next match
- **WHEN** a player is proposed in the current proposal and the technical protection window is 8 matchdays
- **THEN** the player is protected in the next estimated tab with a deconvocation 1 matchday ago

#### Scenario: Streak grows for those called
- **WHEN** a player is not proposed in the current tab
- **THEN** the player has one more consecutive matchday in the next estimated tab

### Requirement: Estimate assumptions
The estimate SHALL assume that every player attends training, so attendance does not differentiate players; that the low-minutes rule does not apply; that only league matches count; and that no new injuries or sanctions happen. The rival difficulty of each tab SHALL come from the forecast for that match, and the matches after it SHALL be the following ones.

#### Scenario: Attendance does not decide
- **WHEN** two players tie on every criterion except season attendance
- **THEN** the estimated tabs treat their attendance as equal

#### Scenario: Difficulty per match
- **WHEN** the forecast gives a low win probability for the third next match
- **THEN** that tab is shown as a hard rival and the strong players are not proposed there

### Requirement: Injured players stay out until their return
A player injured today SHALL be out of every estimated match before the estimated recovery date of the injury, and out of all of them when there is no estimated recovery date. From the estimated recovery date the player SHALL be available, with the same recovery and rest protections as in the real proposal. Players out are listed in each tab and do not count as available for any position minimum.

#### Scenario: Recovery in the third match
- **WHEN** a player is injured with estimated recovery before the third next match
- **THEN** the player is out in the first two estimated tabs and available from the third

#### Scenario: No estimated recovery
- **WHEN** an injured player has no estimated recovery date
- **THEN** the player is out in every estimated tab

### Requirement: Estimates are responsive and use cards
The tabs and their content SHALL be usable from 360px wide to desktop, with the tabs scrolling horizontally when they do not fit, and SHALL use cards or lists, not tables.

#### Scenario: Narrow screen
- **WHEN** the screen is 360px wide
- **THEN** the tab bar scrolls and the proposal content fits without horizontal page scroll
