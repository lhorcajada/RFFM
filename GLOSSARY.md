# FutbolBase

Domain language of FutbolBase, the football team management platform. Terms are added by the change that resolves them.

## Language

**Club**: "An organization space created and paid for by its directive; one of the two space types, shown to users as Club."
*Avoid*: organización (internal enum value `Organization`, never shown), Espacio de club

**Jugador asociado**: "A player of the team that a row of the team wallets list is tied to: the player the family member is linked to, or the player's own record on the row of a player user."
*Avoid*: hijo, jugador vinculado

**Monedero**: "The balance of the quiniela of one user in one team (`QuinielaWallet`), with a ledger of movements."
*Avoid*: hucha (the team fund piggy bank is a different concept), cartera

**Personal space**: "A private club created by a coach for their own work, visible only to its members and shown to users as Espacio personal."
*Avoid*: club personal, espacio privado, espacio de coach

**Rol Coach**: "The role of a user who is a coach (entrenador), distinct from the Administrator role."
*Avoid*: administrador (es otro rol)

**Ya desconvocado**: "A player of the squad that is listed in the not-called list of a convocation (`mgmtNotCalled`) before the deconvocation proposal is generated, whatever the reason."
*Avoid*: ya fuera, excluido

**Jugador protegido**: "A player the deconvocation proposal never proposes because a funnel rule keeps them called: a technical deconvocation within the protection window, an absence by injury counted as rest, a minimum of calls not reached, or a position minimum."
*Avoid*: bloqueado, intocable

**Descanso por lesión**: "An absence by injury or illness, even mild, that counts as a rest of the player for the deconvocation proposal and protects them for a configurable number of matchdays."
*Avoid*: lesión descontada

**Dificultad del rival**: "Classification of the next rival as easy, medium or hard from the own win probability of the match forecast; only a hard rival makes the level of the players break ties in the deconvocation proposal."
*Avoid*: rival fuerte

## Relationships

- A **Personal space** and a **Club** are the two types of the one club entity; every existing club becomes a **Personal space**
- A coach belongs to many **Personal space** and **Club** memberships at once, each isolated from the others
- A **Monedero** belongs to one user and one team
- A row of the wallets list of a family member has many **Jugador asociado** (one per linked player of that team)
- A row of the wallets list of a player user has one **Jugador asociado** (the player itself)
- A **Ya desconvocado** player is shown in the deconvocation proposal but is never proposed again and never counts as available
- A **Jugador protegido** is shown in the deconvocation proposal with the one rule that protects them
- A **Descanso por lesión** protects the player for the injury rest window, separate from the technical deconvocation window
