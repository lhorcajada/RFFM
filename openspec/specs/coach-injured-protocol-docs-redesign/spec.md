# coach-injured-protocol-docs-redesign Specification

## Purpose
TBD - created by archiving change coach-injured-protocol-docs-redesign. Update Purpose after archive.
## Requirements
### Requirement: The injured page uses a segmented tab selector
The page SHALL show the tabs «Lesionados», «Protocolo» and «Documentos» as a segmented selector exposed with `tablist`/`tab` roles, each at least 44 px tall, fitting in 390 px without horizontal scroll, with `aria-selected` on the active tab.

#### Scenario: Default tab
- **WHEN** the page loads
- **THEN** «Lesionados» is the selected tab

#### Scenario: Switching tab
- **WHEN** the user presses «Documentos»
- **THEN** «Documentos» is the only selected tab and its panel is shown

### Requirement: The protocol panel is a single card with formatting and actions
The «Protocolo» tab SHALL show a card titled «Protocolo de lesiones» with a «Publicado» chip when the protocol has content, and the last update date at the bottom. For a coach it SHALL show a formatting bar (Negrita, Cursiva, Título, Lista, Lista numerada) with buttons at least 44 px, and the actions «Guardar protocolo» and «Eliminar». Users who are not coaches SHALL see neither the bar nor the actions.

#### Scenario: Published protocol
- **WHEN** the team has a protocol with content
- **THEN** the «Publicado» chip is shown

#### Scenario: Coach tools
- **WHEN** the user is a coach
- **THEN** the formatting bar and the «Guardar protocolo» and «Eliminar» buttons are shown

#### Scenario: Read-only
- **WHEN** the user is not a coach and the protocol has content
- **THEN** the content is shown without formatting bar or actions

#### Scenario: Delete needs confirmation
- **WHEN** the coach presses «Eliminar»
- **THEN** a confirmation dialog is shown and the protocol is deleted only after confirming

### Requirement: The documents panel shows upload zone and PDF cards
The «Documentos» tab SHALL show, for a coach, an upload zone with the text «Solo PDF · máximo 10 MB» and a «Subir documento» button. Each document SHALL be a card (never a table) with a PDF label, the file name, «Subido el» followed by the upload date, and the text buttons «Descargar» and, for a coach, «Eliminar», each at least 44 px tall. The cards SHALL be in one column on mobile and three columns from 900 px.

#### Scenario: Upload zone for coach
- **WHEN** the user is a coach
- **THEN** the upload zone with the PDF and size hint is shown

#### Scenario: No upload zone for others
- **WHEN** the user is not a coach
- **THEN** neither the upload zone nor «Eliminar» is shown

#### Scenario: Document card
- **WHEN** a document was uploaded on 01/01/2026
- **THEN** its card shows the PDF label, the file name and «Subido el 01/01/2026»

#### Scenario: Invalid file
- **WHEN** the coach selects a file that is not a PDF
- **THEN** the error «Solo se admiten ficheros PDF» is shown and nothing is uploaded

