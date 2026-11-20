## ADDED Requirements

### Requirement: The game model carries a version marker
Every game model SHALL carry a version marker that changes each time the model is saved, and the read of the model SHALL return it. A model that has no marker SHALL be given one before it is first returned, and that marker SHALL be persisted, so that repeated reads return the same marker until the next save. The update of the model SHALL accept an optional expected marker; when it is supplied and differs from the current marker, the update SHALL be refused with HTTP `409 Conflict` as `ProblemDetails` with the error code `GameModelStale`, and the model SHALL stay unchanged. An update without an expected marker SHALL behave as before.

#### Scenario: Marker changes on save
- **WHEN** a model is saved
- **THEN** a later read returns a different marker

#### Scenario: Model without a marker
- **WHEN** a model that was created before the marker existed is read
- **THEN** it is returned with a marker

#### Scenario: Marker is stable between reads
- **WHEN** a model that had no marker is read twice with no save in between
- **THEN** both reads return the same marker

#### Scenario: Matching expected marker
- **WHEN** an update carries the current marker as the expected marker
- **THEN** the update is applied

#### Scenario: Stale expected marker
- **WHEN** an update carries a marker that is no longer current
- **THEN** the update is refused with `409 Conflict` as `ProblemDetails` with the error code `GameModelStale`, and the model is unchanged

#### Scenario: No expected marker
- **WHEN** an update carries no expected marker
- **THEN** the update is applied as before
