## ADDED Requirements

### Requirement: Upload photo or video for a game scenario
A coach with access to a game scenario's club/team SHALL be able to upload a photo or short video to illustrate that scenario's tactical situation, replacing any existing media for that scenario.

#### Scenario: Uploading a valid image sets the scenario media
- **WHEN** a coach uploads a JPEG, PNG, or WebP file no larger than 20 MB to a saved scenario that has no media yet
- **THEN** the scenario's media is set to that image and it is returned as `mediaType: "image"`

#### Scenario: Uploading a valid video sets the scenario media
- **WHEN** a coach uploads an MP4 or WebM file no larger than 20 MB to a saved scenario
- **THEN** the scenario's media is set to that video and it is returned as `mediaType: "video"`

#### Scenario: Uploading new media replaces the previous file
- **WHEN** a coach uploads a new photo or video to a scenario that already has media
- **THEN** the previous file is deleted from storage and the scenario now references only the new file

#### Scenario: Rejecting a disallowed file type or oversized file
- **WHEN** a coach attempts to upload a file whose content type is not JPEG/PNG/WebP/MP4/WebM, or whose size exceeds 20 MB
- **THEN** the upload is rejected and the scenario's existing media (if any) is left unchanged

#### Scenario: A coach without access to the scenario's team cannot upload media
- **WHEN** a user who is not a member of the club that owns the scenario's team attempts to upload media to it
- **THEN** the request is denied and no media is stored

### Requirement: Delete a game scenario's media
A coach with access to a game scenario's club/team SHALL be able to remove its photo or video.

#### Scenario: Deleting existing media clears it
- **WHEN** a coach deletes the media of a scenario that currently has a photo or video
- **THEN** the file is removed from storage and the scenario no longer has media

#### Scenario: Deleting media on a scenario with none is a no-op
- **WHEN** a coach requests deletion of media for a scenario that has no media
- **THEN** the request succeeds without error and no storage operation is attempted

### Requirement: Game model retrieval includes scenario media
Reading a team's game model SHALL include each scenario's media, if any, so viewers can see the tactical situation it illustrates.

#### Scenario: Scenario media is present in the game model response
- **WHEN** a game model is retrieved and one of its scenarios has an uploaded photo or video
- **THEN** that scenario's entry includes the media URL and its type (`"image"` or `"video"`)

### Requirement: Scenario media is optional and displayed responsively
A scenario's media SHALL NOT be required to save or view a scenario, and SHALL render legibly across device sizes wherever a scenario is shown.

#### Scenario: A scenario without media saves and displays normally
- **WHEN** a scenario has no photo or video
- **THEN** it can still be created, edited, and viewed without any media-related error or required field

#### Scenario: Media renders without breaking layout on narrow viewports
- **WHEN** a scenario with a photo or video is viewed on a narrow (mobile) viewport
- **THEN** the media scales to fit the available width without causing horizontal overflow, remaining sharp and legible
