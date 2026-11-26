# SAI Learnings — FutbolBase

Football management monorepo: React SPA, Expo app and ASP.NET Core API under `Back/ExtractionApi`.

## Stack

## Conventions

## Avoid

- **EF Core 9 global query filters**: Do not call `IgnoreQueryFilters()` or navigate to a filtered entity inside a `HasQueryFilter` predicate. The call disables the filters of every entity expanded later in the same query and leaks data across clubs, and a navigation back to a filtered entity recurses until the test host crashes. Read the needed columns through a keyless `ToSqlQuery` type excluded from migrations, and test queries that combine two filtered entities.
  *Observed:* personal-and-club-spaces — a predicate with `Teams.IgnoreQueryFilters()` passed every single-entity test and returned another club's rows in multi-root and subquery tests.
- **SeasonEntityConfiguration.cs**: `Season.ClubId` is mapped as required while the database column accepts NULL, so reading a season row with a NULL `ClubId` throws `InvalidCastException`. Seed seasons with a club in tests.
  *Observed:* personal-and-club-spaces — tests that seeded a season without a club failed on materialization.

## Test Command
