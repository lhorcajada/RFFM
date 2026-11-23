## ADDED Requirements

### Requirement: Exercise carries no game-model relations
The exercise API SHALL NOT expose nor edit game-model relations: `POST` and `PUT` of an exercise SHALL ignore any `modelRelations` field in the request, and the exercise list and exercise detail responses SHALL NOT return `modelRelations` nor `isAssociatedToGameModel`. Saving an exercise SHALL leave any relation rows already stored for it in the database unchanged, and no exercise feature SHALL read them. The game model of a training belongs to its session's objectives.

#### Scenario: Create ignores model relations
- **WHEN** a Coach creates an exercise with a request that carries a `modelRelations` list
- **THEN** the exercise is created and no game-model relation is stored for it

#### Scenario: Update keeps stored relations untouched
- **WHEN** a Coach updates an exercise that has game-model relation rows stored in the database
- **THEN** the exercise is updated and those relation rows remain in the database as they were

#### Scenario: Read endpoints return no relations
- **WHEN** a Coach reads the exercise list or one exercise by id
- **THEN** the response carries neither `modelRelations` nor `isAssociatedToGameModel`

#### Scenario: Exercise list shows no game-model chips
- **WHEN** the Coach app renders the exercise list
- **THEN** no exercise card shows an «Asociado al modelo» chip nor a game-model relation chip

## REMOVED Requirements

### Requirement: Exercise can reference the game model
**Reason**: One exercise can serve several principles of the game model, so the relation is no longer fixed on the exercise; the session's objectives are the one place where the focus is chosen.
**Migration**: None. Stored relation rows stay in the database, unread; the game model of a training is set through the session's objectives.

### Requirement: Exercise list distinguishes model-linked from independent exercises
**Reason**: Exercises no longer carry game-model relations, so the list has nothing to distinguish them by.
**Migration**: None; the indicator and the `IsAssociatedToGameModel` field are removed.
