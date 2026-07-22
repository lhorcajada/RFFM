## ADDED Requirements

### Requirement: Drill-down navigation on narrow viewports
Below the MUI `md` breakpoint (900px), the game-model Scenario, SubPrinciple, and SubSubPrinciple levels SHALL be navigated one level at a time, in both the read view and the editor: a full-width list of items at the current level, and, once an item is selected, a full-width detail panel with a visible "back" control that returns to the list without losing sibling data.

#### Scenario: Selecting a scenario on mobile shows its detail and hides the list
- **WHEN** the viewport width is below 900px and the user taps a scenario in the scenario list
- **THEN** the scenario list is replaced by the scenario's detail panel (context, tactical principles,
  subprinciple list) and a "Volver" control is shown

#### Scenario: Back control returns to the list without losing data
- **WHEN** the user is viewing a scenario's detail panel on a viewport below 900px and taps "Volver"
- **THEN** the scenario list is shown again with all scenarios and their data unchanged (including any
  edits made while the detail panel was open, in the editor)

### Requirement: Master-detail navigation on wide viewports
At or above the MUI `md` breakpoint (900px), the game-model Scenario, SubPrinciple, and SubSubPrinciple levels SHALL render as a master-detail layout, showing the list of items at the current level alongside the detail panel for the selected item simultaneously, without a "back" navigation step.

#### Scenario: Selecting a scenario on desktop keeps the list visible
- **WHEN** the viewport width is 900px or wider and the user clicks a scenario in the scenario list
- **THEN** the scenario list remains visible alongside the scenario's detail panel, and the selected
  scenario is visually indicated as selected in the list

#### Scenario: Single item auto-selects on wide viewports
- **WHEN** the viewport width is 900px or wider and a level (scenario, subprinciple, or subsubprinciple)
  has exactly one item
- **THEN** that item is automatically selected and its detail panel is shown without requiring a click

### Requirement: Accessible reorder alternative to drag-and-drop
In the editor, reordering SubPrinciple items within a Scenario and SubSubPrinciple items within a SubPrinciple SHALL be possible both via the existing HTML5 drag-and-drop handle and via dedicated "move up"/"move down" controls, each independently sufficient to change the item's position.

#### Scenario: Moving a subprinciple down via button
- **WHEN** the editor shows a subprinciple that is not the last item in its scenario, and the user
  activates its "Mover abajo" control
- **THEN** the subprinciple moves one position later in the list and its label/order updates accordingly

#### Scenario: Move controls disabled at list boundaries
- **WHEN** a subprinciple or subsubprinciple is the first item in its list
- **THEN** its "Mover arriba" control is disabled, and if it is the last item, its "Mover abajo" control
  is disabled

### Requirement: Minimum touch target size on mobile and tablet
Interactive controls (text inputs, buttons, icon buttons) rendered by the game-model editor and read view below the MUI `md` breakpoint SHALL have a minimum touch target of 44x44 CSS pixels.

#### Scenario: Skill row fields stack and meet touch target size on narrow viewports
- **WHEN** the viewport width is below 900px and a SubSubPrinciple detail panel with essential skills is
  shown in the editor
- **THEN** each skill's name field, description field, and delete button are stacked vertically (not in
  a fixed-width row) and each has a rendered height of at least 44 CSS pixels

### Requirement: No horizontal overflow at 320px width
The game-model editor and read view SHALL NOT overflow horizontally or render illegible (clipped/overlapping) text at a 320px viewport width, across the drill-down list, detail panels, and all text content.

#### Scenario: Long scenario name does not overflow at 320px
- **WHEN** the viewport width is 320px and a scenario name longer than the available width is displayed
  in the list or detail panel
- **THEN** the name wraps or truncates within its container and does not cause the page to scroll
  horizontally

### Requirement: Sticky save/cancel bar on mobile editor
On viewports below the MUI `md` breakpoint, the game-model editor (`GameModelCreate.tsx`) SHALL present its Save and Cancel actions in a bar that remains reachable without scrolling to the very bottom of a long form, without altering the shared `ContentLayout`/`ActionBar` behavior used by other pages.

#### Scenario: Save action reachable while scrolled into a deep form
- **WHEN** the viewport width is below 900px and the user has scrolled down into a SubSubPrinciple
  detail panel deep in the form
- **THEN** a Save action remains visible on screen without requiring the user to scroll to the top or
  bottom of the page
