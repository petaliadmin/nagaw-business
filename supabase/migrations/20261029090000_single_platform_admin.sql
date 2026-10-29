-- A single platform administrator (ADR-039, amends ADR-030).
--
-- The table holds at most one row: designating another administrator means
-- removing the current one first, in SQL, as before.

create unique index platform_admins_single on app.platform_admins ((true));
