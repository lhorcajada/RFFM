# space-types Specification

## Purpose
TBD - created by archiving change personal-and-club-spaces. Update Purpose after archive.
## Requirements
### Requirement: Every club has a space type
Every club SHALL have a type, either Personal space or Club. The type SHALL default to Personal space. The user interface SHALL show the type only as "Espacio personal" or "Club", and SHALL NOT show the internal type values.

#### Scenario: New club without an explicit type
- **WHEN** a club is created without an explicit type
- **THEN** the club has the type Personal space

#### Scenario: Type shown to the user
- **WHEN** a user views the type of a club
- **THEN** the user sees "Espacio personal" for a Personal space and "Club" for a Club, never an internal value

### Requirement: Existing clubs become Personal spaces
The schema change that introduces the space type SHALL leave every existing club with the type Personal space and SHALL NOT change the ownership, membership, or data of any existing club.

#### Scenario: Migration of existing clubs
- **WHEN** the schema change is applied to a database that already holds clubs
- **THEN** every existing club has the type Personal space
- **AND** every existing membership and club-scoped record is unchanged

### Requirement: A Personal space is visible only to its members
A Personal space SHALL be visible only to the users who are its members. A Personal space SHALL NOT appear in any club search or suggestion shown to a user who is not a member of it. The name of a Personal space SHALL be allowed to match the name of another club.

#### Scenario: Non-member lists clubs
- **WHEN** a user who is not a member of a Personal space requests the club listing or a club search
- **THEN** the Personal space is not in the result

#### Scenario: Member lists clubs
- **WHEN** a member of a Personal space requests the club listing
- **THEN** the Personal space is in the result

#### Scenario: Same name as another club
- **WHEN** a coach creates a Personal space whose name matches the name of an existing club
- **THEN** the Personal space is created
- **AND** the existing club is unchanged

### Requirement: Data belongs to the space that holds it
Data entered in a space SHALL belong to that space: to the coach in a Personal space and to the club in its own Club. The system SHALL NOT offer an ownership transfer of a Personal space or a claim of a Personal space by a club.

#### Scenario: Data stays with the creating coach
- **WHEN** a club directive wants the data of a Personal space created by a coach
- **THEN** no operation moves or claims that data
- **AND** the data stays in the Personal space of the coach

### Requirement: A coach can belong to several spaces at once
A coach SHALL be able to belong to several Personal spaces and Clubs at once with one login. Each membership SHALL be isolated from the others: belonging to one space SHALL NOT grant access to the data of another.

#### Scenario: Coach with several memberships
- **WHEN** a coach is a member of a Personal space and of a Club
- **THEN** the coach can access the data of both spaces
- **AND** the coach cannot access the data of any third space

#### Scenario: Data of one space is not mixed into another
- **WHEN** a coach who belongs to two spaces reads the data of one of them
- **THEN** the result holds no data of the other space

