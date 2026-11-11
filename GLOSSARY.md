# FutbolBase

Domain language of FutbolBase, the football team management platform. Terms are added by the change that resolves them.

## Language

**Jugador asociado**: "A player of the team that a row of the team wallets list is tied to: the player the family member is linked to, or the player's own record on the row of a player user."
*Avoid*: hijo, jugador vinculado

**Monedero**: "The balance of the quiniela of one user in one team (`QuinielaWallet`), with a ledger of movements."
*Avoid*: hucha (the team fund piggy bank is a different concept), cartera

**Rol Coach**: "The role of a user who is a coach (entrenador), distinct from the Administrator role."
*Avoid*: administrador (es otro rol)

## Relationships

- A **Monedero** belongs to one user and one team
- A row of the wallets list of a family member has many **Jugador asociado** (one per linked player of that team)
- A row of the wallets list of a player user has one **Jugador asociado** (the player itself)
