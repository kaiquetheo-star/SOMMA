-- Linear product model: subjective CNS fatigue no longer steers or persists.
alter table public.profiles
  drop column if exists cns_fatigue_score;
