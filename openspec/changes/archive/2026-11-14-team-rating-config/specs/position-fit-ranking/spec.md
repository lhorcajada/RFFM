## MODIFIED Requirements

### Requirement: Trait weights per position
Each unified position SHALL define a weight for each trait of the team's effective catalog with three values: clave, suma and indiferente. Default weights SHALL be provided for the default traits of every position, a trait created by the team SHALL have weight suma in every position until the coach changes it, and the same weights SHALL apply to left and right sides. The coach SHALL be able to change the weights per team. A trait with weight indiferente and a hidden trait SHALL NOT contribute to the fit, and hidden traits SHALL NOT be offered in the weights.

#### Scenario: Default weights exist
- **WHEN** a team has never configured weights
- **THEN** every position has the default weight for every default trait

#### Scenario: Team override
- **WHEN** the coach sets `traitPressing` as clave for Mediocentro defensivo
- **THEN** the fit of Mediocentro defensivo candidates uses that weight for the team

#### Scenario: Custom trait weight
- **WHEN** the team creates a trait and has not changed its weights
- **THEN** the trait counts with weight suma in every position

#### Scenario: Hidden trait ignored
- **WHEN** a trait with saved levels is hidden
- **THEN** it does not count in the fit and is not listed in the weights
