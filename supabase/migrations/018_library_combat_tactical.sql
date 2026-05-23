-- Blood & Bone — tactical_focus for elite striking coach rounds
-- Renumbered from 009 → 018 (duplicate prefix fix). Run after 004_library_catalog.sql

alter table public.library_combat
  add column if not exists tactical_focus text not null default 'footwork_range';

alter table public.library_combat
  drop constraint if exists library_combat_tactical_focus_check;

alter table public.library_combat
  add constraint library_combat_tactical_focus_check
  check (
    tactical_focus in (
      'footwork_range',
      'power_inside',
      'defense_counter',
      'burnout'
    )
  );

create index if not exists library_combat_tactical_focus_idx
  on public.library_combat (tactical_focus);

comment on column public.library_combat.tactical_focus is
  'Tactical intent: footwork_range | power_inside | defense_counter | burnout';
