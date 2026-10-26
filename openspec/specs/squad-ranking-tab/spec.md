# squad-ranking-tab Specification

## Purpose
TBD - created by archiving change squad-tabs-redesign. Update Purpose after archive.
## Requirements
### Requirement: Podium and ranking rows
The «Ranking» tab SHALL show the first three places as podium cards (place number and score) and the remaining places as rows labelled «#n» with the score. Players with the same score SHALL share a place and be labelled with the number of tied players.

#### Scenario: Tie
- **WHEN** two players have the same score
- **THEN** they appear under the same place with the label «2 empatados»

### Requirement: Unrated players
Players without a rating SHALL appear in a «Sin valorar» section, each with a «Valorar» action that opens the rating editor.

#### Scenario: Unrated player
- **WHEN** a player has no rating
- **THEN** the player appears under «Sin valorar» with a «Valorar» button

