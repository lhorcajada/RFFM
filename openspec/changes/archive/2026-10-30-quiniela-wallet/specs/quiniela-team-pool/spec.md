## MODIFIED Requirements

### Requirement: The coach manages the pot and payments
Only the team's coach SHALL list the jornada's tickets with totals (collected, pending, prizes, team fund), mark a ticket as paid (Cash or Bizum) or pending, and see the pot movements. A ticket paid from the wallet SHALL count as collected. Marking a wallet-paid ticket as pending, or as paid by another method, SHALL refund the wallet charge to its owner.

#### Scenario: Mark as paid
- **WHEN** the coach marks a pending ticket as paid
- **THEN** the collected total increases by 1.00 and the pending total decreases by 1.00

#### Scenario: Not the coach
- **WHEN** a player requests the payments of the jornada
- **THEN** the request is rejected as forbidden

#### Scenario: Wallet-paid ticket counts as collected
- **WHEN** a ticket is paid from the wallet
- **THEN** the collected total includes its price and the ticket shows the method Wallet

#### Scenario: Wallet-paid ticket back to pending
- **WHEN** the coach marks a wallet-paid ticket as pending
- **THEN** the ticket is pending and the owner is refunded the charge

#### Scenario: Wallet is not a manual method
- **WHEN** the coach marks a ticket as paid with method Wallet
- **THEN** the request is rejected with a validation ProblemDetails
