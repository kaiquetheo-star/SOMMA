-- SOMMA Elite 50-Movement Catalog Seed — NO-OP
-- Renumbered from 017 → 020 (duplicate prefix fix).
--
-- Superseded by 017_global_catalog_seed.sql (1,514 rows, already applied remotely).
-- The original elite seed used `ON CONFLICT (slug) DO UPDATE SET id = excluded.id`, which
-- breaks when performance_logs reference existing library_exercises UUIDs.
-- Keeping this migration as a no-op preserves sequential history without data churn.

select 1;
