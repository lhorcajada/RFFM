## MODIFIED Requirements

### Requirement: Visible book status
Each book SHALL show its status as a label translated to Spanish: «Sin asignar» for `Unassigned`, «Asignado» for `Assigned`, «Entregado al jugador» for `DeliveredToPlayer`, «Devuelto al entrenador» for `ReturnedToCoach` and «Entregado al club» for `DeliveredToClub`.

#### Scenario: Pending book
- **WHEN** a book is delivered to the player and not yet returned
- **THEN** its card shows the label «Entregado al jugador»

#### Scenario: Returned book
- **WHEN** a book has been returned to the coach
- **THEN** its card shows the label «Devuelto al entrenador»

#### Scenario: Book delivered to the club
- **WHEN** a book has been delivered to the club
- **THEN** its card shows the label «Entregado al club» and the club delivery date
